import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { PlatformError } from "@/lib/client-platform/contracts";
import { catalogRequestHash as digest } from "@/lib/catalog/catalog-normalization";
import { StoreSellerIdentityProposalSchema, StoreSellerIdentityReviewSchema, type SellerIdentityProposalInput, type SellerIdentityReviewInput } from "@/lib/validation/store-seller-identity";

type Proposal = { schemaVersion: 1; reference: string; storeId: string; makerUserId: string; requestHash: string; input: SellerIdentityProposalInput; status: "PENDING_REVIEW" | "APPROVED" | "REJECTED"; review?: SellerIdentityReviewInput; reviewerUserId?: string; identityReference?: string };
const prefix = (storeId: string) => `store_seller_identity_proposal:${storeId}:`;
function proposal(value: Prisma.JsonValue): Proposal {
  const record = value as unknown as Proposal;
  if (record?.schemaVersion !== 1 || typeof record.reference !== "string" || !/^SLP-[A-F0-9]{32}$/.test(record.reference) || typeof record.storeId !== "string" || typeof record.makerUserId !== "string" || !record.makerUserId || !["PENDING_REVIEW", "APPROVED", "REJECTED"].includes(record.status) || !StoreSellerIdentityProposalSchema.safeParse(record.input).success || record.requestHash !== digest(record.input)) throw new PlatformError("SELLER_PROPOSAL_INVALID", "Seller identity evidence could not be verified.", 409);
  return record;
}
const jsonValue = (value: Proposal) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
async function lockStore(tx: Prisma.TransactionClient, storeId: string) { await tx.$queryRaw`SELECT "id" FROM "Store" WHERE "id" = ${storeId} FOR UPDATE`; }
async function latestIdentity(tx: Prisma.TransactionClient, storeId: string) { return tx.storeSellerLegalIdentity.findFirst({ where: { storeId, status: "APPROVED" }, orderBy: [{ effectiveFrom: "desc" }, { id: "asc" }] }); }

export async function getStoreSellerIdentityState(storeId: string) {
  const [currentIdentity, pending, history] = await Promise.all([
    latestIdentity(prisma, storeId),
    prisma.systemSetting.findMany({ where: { key: { startsWith: prefix(storeId) }, value: { path: ["status"], equals: "PENDING_REVIEW" } }, orderBy: { updatedAt: "desc" }, take: 20 }),
    prisma.systemSetting.findMany({ where: { key: { startsWith: prefix(storeId) }, NOT: { value: { path: ["status"], equals: "PENDING_REVIEW" } } }, orderBy: { updatedAt: "desc" }, take: 20 }),
  ]);
  return { currentIdentity, proposals: [...pending, ...history].map(row => ({ ...proposal(row.value), updatedAt: row.updatedAt.toISOString() })) };
}

export async function submitStoreSellerIdentity(storeId: string, actorUserId: string, raw: SellerIdentityProposalInput) {
  const input = StoreSellerIdentityProposalSchema.parse(raw);
  return prisma.$transaction(async tx => {
    await lockStore(tx, storeId);
    const [store, actor] = await Promise.all([tx.store.findFirst({ where: { id: storeId, ownerUserId: actorUserId } }), tx.user.findUnique({ where: { id: actorUserId }, select: { status: true } })]);
    if (!store || actor?.status !== "ACTIVE" || !["ACTIVE", "PENDING"].includes(store.status)) throw new PlatformError("SELLER_OWNER_REQUIRED", "An active owner of this store is required.", 403);
    const key = `${prefix(storeId)}${actorUserId}:${input.operationId}`;
    const prior = await tx.systemSetting.findUnique({ where: { key } });
    if (prior) {
      const saved = proposal(prior.value);
      if (saved.storeId !== storeId || saved.makerUserId !== actorUserId || saved.requestHash !== digest(input)) throw new PlatformError("SELLER_OPERATION_CONFLICT", "This operation was used for different seller details.", 409);
      return { ...saved, updatedAt: prior.updatedAt.toISOString(), replayed: true };
    }
    if ((await latestIdentity(tx, storeId))?.publicReference !== (input.expectedIdentityReference ?? undefined)) throw new PlatformError("SELLER_IDENTITY_STALE", "Refresh the current seller identity before submitting.", 409);
    if (await tx.systemSetting.count({ where: { key: { startsWith: prefix(storeId) }, value: { path: ["status"], equals: "PENDING_REVIEW" } } }) >= 20) throw new PlatformError("SELLER_REVIEW_LIMIT", "Resolve pending seller identity reviews before adding another.", 409);
    const record: Proposal = { schemaVersion: 1, reference: `SLP-${randomUUID().replaceAll("-", "").toUpperCase()}`, storeId, makerUserId: actorUserId, requestHash: digest(input), input, status: "PENDING_REVIEW" };
    const saved = await tx.systemSetting.create({ data: { key, label: "Store seller identity proposal", type: "JSON", value: jsonValue(record) } });
    await tx.adminActivityLog.create({ data: { actorUserId, action: "CREATE", entityType: "StoreSellerIdentityProposal", entityId: record.reference, message: "Owner supplied seller identity for independent review.", metadata: { storeId, requestHash: record.requestHash } } });
    return { ...record, updatedAt: saved.updatedAt.toISOString(), replayed: false };
  }, { timeout: 15_000 });
}

export async function reviewStoreSellerIdentity(storeId: string, actorUserId: string, raw: SellerIdentityReviewInput) {
  const input = StoreSellerIdentityReviewSchema.parse(raw);
  return prisma.$transaction(async tx => {
    await lockStore(tx, storeId);
    const [store, actor] = await Promise.all([tx.store.findUnique({ where: { id: storeId } }), tx.user.findUnique({ where: { id: actorUserId }, select: { role: true, status: true } })]);
    if (!store || store.status !== "ACTIVE" || actor?.status !== "ACTIVE" || !["ADMIN", "SUPER_ADMIN"].includes(actor.role)) throw new PlatformError("SELLER_REVIEW_DENIED", "An active store and administrator are required.", 403);
    const row = await tx.systemSetting.findFirst({ where: { key: { startsWith: prefix(storeId) }, value: { path: ["reference"], equals: input.proposalReference } } });
    if (!row) throw new PlatformError("SELLER_PROPOSAL_NOT_FOUND", "Seller identity proposal was not found.", 404);
    const saved = proposal(row.value);
    if (saved.storeId !== storeId || saved.makerUserId !== store.ownerUserId) throw new PlatformError("SELLER_PROPOSAL_OWNER_CHANGED", "Seller ownership changed; request a fresh owner submission.", 409);
    if (saved.makerUserId === actorUserId || store.ownerUserId === actorUserId) throw new PlatformError("SELLER_INDEPENDENT_REVIEW_REQUIRED", "A separate administrator must review the owner's submission.", 403);
    const submission = await tx.adminActivityLog.findFirst({ where: { actorUserId: saved.makerUserId, action: "CREATE", entityType: "StoreSellerIdentityProposal", entityId: saved.reference, AND: [{ metadata: { path: ["storeId"], equals: storeId } }, { metadata: { path: ["requestHash"], equals: saved.requestHash } }] } });
    if (!submission) throw new PlatformError("SELLER_SUBMISSION_EVIDENCE_INVALID", "The owner's canonical submission evidence is missing.", 409);
    if (saved.status !== "PENDING_REVIEW") {
      if (!saved.review || saved.reviewerUserId !== actorUserId || digest(saved.review) !== digest(input)) throw new PlatformError("SELLER_REVIEW_CONFLICT", "This proposal already has a different review.", 409);
      const reviewAudit = await tx.adminActivityLog.findFirst({ where: { actorUserId, action: "STATUS_CHANGE", entityType: "StoreSellerIdentityProposal", entityId: saved.reference, AND: [{ metadata: { path: ["ownerRequestHash"], equals: saved.requestHash } }, { metadata: { path: ["reviewRequestHash"], equals: digest(input) } }] } });
      if (!reviewAudit || (saved.status === "APPROVED" && !await tx.storeSellerLegalIdentity.findFirst({ where: { storeId, publicReference: saved.identityReference ?? "" } }))) throw new PlatformError("SELLER_REVIEW_EVIDENCE_INVALID", "Canonical review evidence is missing.", 409);
      return { ...saved, updatedAt: row.updatedAt.toISOString(), replayed: true };
    }
    if (row.updatedAt.toISOString() !== input.expectedUpdatedAt) throw new PlatformError("SELLER_REVIEW_STALE", "Refresh this proposal before reviewing.", 409);
    let identityReference: string | undefined;
    if (input.action === "APPROVE") {
      const current = await latestIdentity(tx, storeId);
      if (current?.publicReference !== (saved.input.expectedIdentityReference ?? undefined)) throw new PlatformError("SELLER_IDENTITY_STALE", "The seller identity changed after submission; request a new proposal.", 409);
      const start = new Date(saved.input.effectiveFrom), end = saved.input.effectiveUntil ? new Date(saved.input.effectiveUntil) : null;
      if ((end && end <= new Date()) || (current && start <= current.effectiveFrom)) throw new PlatformError("SELLER_EFFECTIVE_WINDOW_INVALID", "Use a valid successor effective window.", 422);
      const overlap = await tx.storeSellerLegalIdentity.findFirst({ where: { storeId, status: "APPROVED", ...(current ? { id: { not: current.id } } : {}), ...(end ? { effectiveFrom: { lt: end } } : {}), OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: start } }] }, select: { id: true } });
      if (overlap) throw new PlatformError("SELLER_IDENTITY_WINDOW_OVERLAP", "Existing seller identity windows overlap; resolve their reviewed authority before approving.", 409);
      if (current && (!current.effectiveUntil || current.effectiveUntil > start)) await tx.storeSellerLegalIdentity.update({ where: { id: current.id }, data: { effectiveUntil: start } });
      identityReference = `SID-${randomUUID().replaceAll("-", "").toUpperCase()}`;
      const fields = saved.input;
      await tx.storeSellerLegalIdentity.create({ data: { storeId, publicReference: identityReference, identityVersion: fields.identityVersion, legalName: fields.legalName, tradingName: fields.tradingName, registrationReference: fields.registrationReference, vatRegistrationStatus: fields.vatRegistrationStatus, vatNumber: fields.vatNumber, countryCode: fields.countryCode, termsReference: fields.termsReference, invoiceClassification: fields.invoiceClassification, status: "APPROVED", effectiveFrom: start, effectiveUntil: end } });
    }
    const reviewed: Proposal = { ...saved, status: input.action === "APPROVE" ? "APPROVED" : "REJECTED", review: input, reviewerUserId: actorUserId, ...(identityReference ? { identityReference } : {}) };
    const updated = await tx.systemSetting.update({ where: { id: row.id }, data: { value: jsonValue(reviewed) } });
    await tx.adminActivityLog.create({ data: { actorUserId, action: "STATUS_CHANGE", entityType: "StoreSellerIdentityProposal", entityId: saved.reference, message: "Independent seller identity review recorded.", metadata: { storeId, action: input.action, identityReference: identityReference ?? null, ownerRequestHash: saved.requestHash, reviewRequestHash: digest(input) } } });
    return { ...reviewed, updatedAt: updated.updatedAt.toISOString(), replayed: false };
  }, { timeout: 15_000 });
}
