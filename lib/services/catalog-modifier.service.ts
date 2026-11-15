import { prisma } from "@/lib/db/prisma";
import { type Prisma } from "@prisma/client";
import { assertModifierGroup, assertModifierPrice } from "@/lib/catalog/catalog-modifier-policy";
import { catalogPublicReference } from "@/lib/catalog/catalog-normalization";
import { CatalogConflictError, CatalogOwnershipError, CatalogPolicyError } from "@/lib/catalog/errors";
import { recordCatalogEvidence, withCatalogTransaction } from "@/lib/services/catalog-service-support";

export async function listStoreModifierGroups(storeId: string) {
  return prisma.storeModifierGroup.findMany({ where: { storeId }, include: { options: { orderBy: { displayOrder: "asc" } }, offers: { include: { offer: { select: { publicReference: true, storeSku: true } } } } }, orderBy: { name: "asc" } });
}

export type ModifierGroupDraftInput = {
  name: string;
  description?: string;
  minimumSelections: number;
  maximumSelections: number;
  isRequired: boolean;
  options: Array<{ name: string; priceDelta: string; currency: "ZAR"; displayOrder: number }>;
  operationId: string;
};

function modifierDefinitionMatches(
  input: ModifierGroupDraftInput,
  existing: {
    description: string | null;
    minimumSelections: number;
    maximumSelections: number;
    isRequired: boolean;
    options: Array<{ name: string; priceDelta: Prisma.Decimal; currency: string; displayOrder: number }>;
  },
): boolean {
  if (
    (existing.description ?? "") !== (input.description ?? "") ||
    existing.minimumSelections !== input.minimumSelections ||
    existing.maximumSelections !== input.maximumSelections ||
    existing.isRequired !== input.isRequired ||
    existing.options.length !== input.options.length
  ) {
    return false;
  }
  const exSorted = [...existing.options].sort((a, b) => a.displayOrder - b.displayOrder);
  const inSorted = [...input.options].sort((a, b) => a.displayOrder - b.displayOrder);
  return inSorted.every((opt, index) => {
    const ex = exSorted[index];
    return Boolean(
      ex &&
        ex.name === opt.name &&
        ex.priceDelta.toFixed(2) === opt.priceDelta &&
        ex.currency === opt.currency &&
        ex.displayOrder === opt.displayOrder,
    );
  });
}

export async function createStoreModifierGroup(
  storeId: string,
  actorUserId: string,
  input: ModifierGroupDraftInput,
  transaction?: Prisma.TransactionClient,
) {
  assertModifierGroup(input);
  input.options.forEach((option) => assertModifierPrice({ amount: option.priceDelta, currency: option.currency }));
  const publicReference = catalogPublicReference("MG");
  return withCatalogTransaction(transaction, async (tx) => {
    const group = await tx.storeModifierGroup.create({
      data: {
        publicReference,
        storeId,
        name: input.name,
        description: input.description,
        minimumSelections: input.minimumSelections,
        maximumSelections: input.maximumSelections,
        isRequired: input.isRequired,
        options: { create: input.options.map((option) => ({ publicReference: catalogPublicReference("MO"), name: option.name, priceDelta: option.priceDelta, currency: "ZAR", displayOrder: option.displayOrder })) },
      },
      include: { options: true },
    });
    await recordCatalogEvidence(tx, { aggregateType: "OFFER", aggregateReference: publicReference, aggregateVersion: 1, action: "MODIFIER_GROUP_CREATED", eventType: "OFFER_UPDATED", actorUserId, operation: { operationId: input.operationId, storeId, request: input } });
    return group;
  });
}

/** Reuse a matching store modifier group or create a new store-scoped group. */
export async function resolveStoreModifierGroupForListing(
  storeId: string,
  actorUserId: string,
  input: ModifierGroupDraftInput,
  tx: Prisma.TransactionClient,
) {
  assertModifierGroup(input);
  input.options.forEach((option) => assertModifierPrice({ amount: option.priceDelta, currency: option.currency }));
  const existing = await tx.storeModifierGroup.findUnique({
    where: { storeId_name: { storeId, name: input.name } },
    include: { options: { where: { status: "ACTIVE" }, orderBy: { displayOrder: "asc" } } },
  });
  if (existing) {
    if (existing.status !== "ACTIVE") {
      throw new CatalogPolicyError(
        "MODIFIER_GROUP_INACTIVE",
        `Modifier group "${input.name}" is inactive on this store. Reactivate it or choose a different modifier group name.`,
      );
    }
    if (!modifierDefinitionMatches(input, existing)) {
      throw new CatalogConflictError(
        "MODIFIER_GROUP_NAME_CONFLICT",
        `A modifier group named "${input.name}" already exists on this store with different options or rules. Reuse its existing configuration or choose a different modifier group name.`,
      );
    }
    return existing;
  }
  return createStoreModifierGroup(storeId, actorUserId, input, tx);
}

export async function attachModifierGroup(storeId: string, offerId: string, groupId: string, displayOrder: number, transaction?: Prisma.TransactionClient) {
  const database = transaction ?? prisma;
  const [offer, group] = await Promise.all([database.storeCatalogOffer.findUnique({ where: { id: offerId } }), database.storeModifierGroup.findUnique({ where: { id: groupId } })]);
  if (!offer || !group || offer.storeId !== storeId || group.storeId !== storeId) throw new CatalogOwnershipError();
  return database.storeOfferModifierGroup.upsert({ where: { offerId_groupId: { offerId, groupId } }, create: { offerId, groupId, displayOrder }, update: { displayOrder } });
}
