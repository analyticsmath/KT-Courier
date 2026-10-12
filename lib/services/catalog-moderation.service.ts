import { prisma } from "@/lib/db/prisma";
import { assertProductTransition, assertOfferTransition } from "@/lib/catalog/catalog-state-machines";
import { CatalogConflictError, CatalogNotFoundError, CatalogPolicyError } from "@/lib/catalog/errors";
import { recordCatalogEvidence } from "@/lib/services/catalog-service-support";
import { type Prisma } from "@prisma/client";
import { catalogRequestHash } from "@/lib/catalog/catalog-normalization";

export async function listCatalogModerationCases(filters: { status?: string } = {}) {
  return prisma.catalogModerationCase.findMany({ where: filters.status ? { status: filters.status as never } : undefined, include: { product: { include: { variants: true, primaryCategory: true, productTypeDefinition: true } }, offer: { include: { priceVersions: true, inventoryItem: { include: { levels: true } } } }, history: { orderBy: { createdAt: "asc" } } }, orderBy: [{ priority: "desc" }, { openedAt: "asc" }] });
}

export async function getCatalogModerationCase(id: string) {
  const moderationCase = await prisma.catalogModerationCase.findUnique({
    where: { id },
    include: {
      product: { include: { variants: true, media: true, primaryCategory: true, productTypeDefinition: true } },
      offer: {
        include: {
          product: true,
          variant: true,
          priceVersions: true,
          inventoryItem: { include: { levels: { include: { location: true } } } },
        },
      },
      history: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!moderationCase) throw new CatalogNotFoundError("Catalog moderation case was not found.");
  return moderationCase;
}

type ModerationAction = "APPROVE" | "REQUEST_CHANGES" | "REJECT" | "SUSPEND";
type ModerationInput = { version: number; operationId: string; reasonCode: string; safeNote?: string };

async function moderationReceipt(tx: Prisma.TransactionClient, kind: "PRODUCT" | "OFFER", id: string, actorUserId: string, action: ModerationAction, input: ModerationInput) {
  // Lock operation identity before subject identity; only then read canonical
  // facts. This serializes retries and competing moderation commands.
  await tx.$queryRaw`SELECT TRUE AS locked FROM pg_advisory_xact_lock(hashtextextended(${`catalog-moderation:${actorUserId}:${action}:${input.operationId}`}, 0))`;
  await tx.$queryRaw`SELECT TRUE AS locked FROM pg_advisory_xact_lock(hashtextextended(${`catalog-moderation:${kind}:${id}`}, 0))`;
  const request = { kind, id, action, version: input.version, reasonCode: input.reasonCode, safeNote: input.safeNote ?? null };
  const receipt = await tx.catalogOperationReceipt.findUnique({ where: { actorUserId_action_operationId: { actorUserId, action: `MODERATION:${action}`, operationId: input.operationId } } });
  if (receipt && receipt.requestHash !== catalogRequestHash(request)) throw new CatalogConflictError("OPERATION_REPLAY_MISMATCH", "This operation was already used for different moderation facts.");
  return { request, receipt };
}

export async function moderateCatalogProduct(id: string, actorUserId: string, action: ModerationAction, input: ModerationInput) {
  return prisma.$transaction(async (tx) => {
    const { request, receipt } = await moderationReceipt(tx, "PRODUCT", id, actorUserId, action, input);
    const product = await tx.catalogProduct.findUnique({ where: { id }, include: { moderationCases: { orderBy: [{ openedAt: "desc" }, { id: "desc" }], take: 1 } } });
    if (!product) throw new CatalogNotFoundError("Catalog product was not found.");
    if (receipt) {
      if (receipt.aggregateReference !== product.publicReference) throw new CatalogConflictError("OPERATION_REPLAY_MISMATCH", "Moderation receipt does not match this product.");
      return tx.catalogProduct.findUniqueOrThrow({ where: { id } });
    }
    if (product.version !== input.version) throw new CatalogConflictError("CATALOG_VERSION_CONFLICT", "Product changed; reload before moderating.");
    const target = { APPROVE: "APPROVED", REQUEST_CHANGES: "NEEDS_CHANGES", REJECT: "ARCHIVED", SUSPEND: "SUSPENDED" }[action] as "APPROVED" | "NEEDS_CHANGES" | "ARCHIVED" | "SUSPENDED";
    assertProductTransition(product.status, target);
    if (action === "APPROVE" && product.status !== "SUBMITTED") throw new CatalogPolicyError("PRODUCT_NOT_SUBMITTED", "Only submitted products may be approved.");
    const moderationStatus = { APPROVE: "APPROVED", REQUEST_CHANGES: "NEEDS_CHANGES", REJECT: "REJECTED", SUSPEND: "SUSPENDED" }[action] as never;
    const moderationCase = product.moderationCases[0];
    const result = await tx.catalogProduct.updateMany({ where: { id, version: input.version, status: product.status }, data: { status: target, moderationStatus, approvedByUserId: action === "APPROVE" ? actorUserId : undefined, suspendedByUserId: action === "SUSPEND" ? actorUserId : undefined, suspensionReasonCode: action === "SUSPEND" ? input.reasonCode : undefined, version: { increment: 1 } } });
    if (result.count !== 1) throw new CatalogConflictError("CATALOG_VERSION_CONFLICT", "Product changed; reload before moderating.");
    if (moderationCase) {
      const caseStatus = { APPROVE: "APPROVED", REQUEST_CHANGES: "NEEDS_CHANGES", REJECT: "REJECTED", SUSPEND: "SUSPENDED" }[action] as never;
      await tx.catalogModerationCase.update({ where: { id: moderationCase.id }, data: { status: caseStatus, reviewedByUserId: actorUserId, resolvedAt: action === "REQUEST_CHANGES" ? null : new Date() } });
      await tx.catalogModerationHistory.create({ data: { caseId: moderationCase.id, fromStatus: moderationCase.status, toStatus: caseStatus, action, reasonCode: input.reasonCode, safeNote: input.safeNote, actorUserId, aggregateVersion: product.version + 1 } });
    }
    await recordCatalogEvidence(tx, { aggregateType: "MODERATION", aggregateReference: product.publicReference, aggregateVersion: product.version + 1, action, eventType: action === "SUSPEND" ? "PRODUCT_SUSPENDED" : "MODERATION_RECORDED", actorUserId, reasonCode: input.reasonCode, operation: { operationId: input.operationId, request } });
    return tx.catalogProduct.findUniqueOrThrow({ where: { id } });
  });
}

export async function moderateCatalogOffer(id: string, actorUserId: string, action: Exclude<ModerationAction, "REJECT">, input: ModerationInput) {
  return prisma.$transaction(async (tx) => {
    const { request, receipt } = await moderationReceipt(tx, "OFFER", id, actorUserId, action, input);
    const offer = await tx.storeCatalogOffer.findUnique({ where: { id }, include: { moderationCases: { orderBy: [{ openedAt: "desc" }, { id: "desc" }], take: 1 } } });
    if (!offer) throw new CatalogNotFoundError("Catalog offer was not found.");
    if (receipt) {
      if (receipt.aggregateReference !== offer.publicReference) throw new CatalogConflictError("OPERATION_REPLAY_MISMATCH", "Moderation receipt does not match this offer.");
      return tx.storeCatalogOffer.findUniqueOrThrow({ where: { id } });
    }
    if (offer.version !== input.version) throw new CatalogConflictError("CATALOG_VERSION_CONFLICT", "Offer changed; reload before moderating.");
    const target = action === "APPROVE" ? offer.status : ({ REQUEST_CHANGES: "NEEDS_CHANGES", SUSPEND: "SUSPENDED" }[action] as "NEEDS_CHANGES" | "SUSPENDED");
    if (action === "APPROVE") {
      if (offer.status !== "SUBMITTED") throw new CatalogPolicyError("OFFER_NOT_SUBMITTED", "Only submitted offers may be approved for later activation.");
    } else {
      assertOfferTransition(offer.status, target);
    }
    const moderationCase = offer.moderationCases[0];
    const result = await tx.storeCatalogOffer.updateMany({ where: { id, version: input.version, status: offer.status }, data: { status: target, approvedByUserId: action === "APPROVE" ? actorUserId : undefined, suspendedByUserId: action === "SUSPEND" ? actorUserId : undefined, version: { increment: 1 } } });
    if (result.count !== 1) throw new CatalogConflictError("CATALOG_VERSION_CONFLICT", "Offer changed; reload before moderating.");
    if (moderationCase) {
      const caseStatus = { APPROVE: "APPROVED", REQUEST_CHANGES: "NEEDS_CHANGES", SUSPEND: "SUSPENDED" }[action] as never;
      await tx.catalogModerationCase.update({ where: { id: moderationCase.id }, data: { status: caseStatus, reviewedByUserId: actorUserId, resolvedAt: action === "REQUEST_CHANGES" ? null : new Date() } });
      await tx.catalogModerationHistory.create({ data: { caseId: moderationCase.id, fromStatus: moderationCase.status, toStatus: caseStatus, action, reasonCode: input.reasonCode, safeNote: input.safeNote, actorUserId, aggregateVersion: offer.version + 1 } });
    }
    await recordCatalogEvidence(tx, { aggregateType: "MODERATION", aggregateReference: offer.publicReference, aggregateVersion: offer.version + 1, action, eventType: "MODERATION_RECORDED", actorUserId, reasonCode: input.reasonCode, operation: { operationId: input.operationId, storeId: offer.storeId, request } });
    return tx.storeCatalogOffer.findUniqueOrThrow({ where: { id } });
  });
}
