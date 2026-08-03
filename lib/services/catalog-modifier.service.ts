import { prisma } from "@/lib/db/prisma";
import { assertModifierGroup, assertModifierPrice } from "@/lib/catalog/catalog-modifier-policy";
import { catalogPublicReference } from "@/lib/catalog/catalog-normalization";
import { CatalogOwnershipError } from "@/lib/catalog/errors";
import { recordCatalogEvidence } from "@/lib/services/catalog-service-support";

export async function listStoreModifierGroups(storeId: string) {
  return prisma.storeModifierGroup.findMany({ where: { storeId }, include: { options: { orderBy: { displayOrder: "asc" } }, offers: { include: { offer: { select: { publicReference: true, storeSku: true } } } } }, orderBy: { name: "asc" } });
}

export async function createStoreModifierGroup(storeId: string, actorUserId: string, input: {
  name: string;
  description?: string;
  minimumSelections: number;
  maximumSelections: number;
  isRequired: boolean;
  options: Array<{ name: string; priceDelta: string; currency: "ZAR"; displayOrder: number }>;
  operationId: string;
}) {
  assertModifierGroup(input);
  input.options.forEach((option) => assertModifierPrice({ amount: option.priceDelta, currency: option.currency }));
  const publicReference = catalogPublicReference("MG");
  return prisma.$transaction(async (tx) => {
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

export async function attachModifierGroup(storeId: string, offerId: string, groupId: string, displayOrder: number) {
  const [offer, group] = await Promise.all([prisma.storeCatalogOffer.findUnique({ where: { id: offerId } }), prisma.storeModifierGroup.findUnique({ where: { id: groupId } })]);
  if (!offer || !group || offer.storeId !== storeId || group.storeId !== storeId) throw new CatalogOwnershipError();
  return prisma.storeOfferModifierGroup.upsert({ where: { offerId_groupId: { offerId, groupId } }, create: { offerId, groupId, displayOrder }, update: { displayOrder } });
}
