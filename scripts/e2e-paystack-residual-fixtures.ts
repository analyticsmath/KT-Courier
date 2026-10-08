import { prisma } from "@/lib/db/prisma";
import { requireDisposableDriverSettlementDatabase } from "./disposable-driver-settlement-guard";
import { createCommissionPlan, submitCommissionPlan, approveCommissionPlan, activateCommissionPlan } from "@/lib/services/commission-plan.service";

/** Catalog input facts only. Paid state, stock consumption and orders must be
 * produced by signed webhook application + independent Verify + consumers. */
export async function createDisposableResidualCatalog() {
  requireDisposableDriverSettlementDatabase();
  const identity = await prisma.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database() AS database, current_user AS role`;
  if (identity[0]?.database !== "kt_phase75_e2e" || identity[0]?.role !== "kt_phase75_e2e") throw new Error("Residual inputs require the named browser database and role.");
  const store = await prisma.store.findUniqueOrThrow({ where: { slug: "e2e-other-store" } });
  const maker = await prisma.user.findUniqueOrThrow({ where: { email: "superadmin@ktcouriers.local" } });
  const checker = await prisma.user.findUniqueOrThrow({ where: { email: "disposable-checkout-reviewer@example.test" } });
  const product = await prisma.catalogProduct.findUniqueOrThrow({ where: { publicReference: "CP-E2ESMARTPHONE" } });
  const location = await prisma.inventoryLocation.create({ data: { publicReference: "loc_e2e_residual", storeId: store.id, name: "Disposable residual stock", isPrimary: true, status: "ACTIVE" } });
  for (const [suffix, amount] of [["one", "0.01"], ["two", "0.02"], ["three", "0.03"], ["large", "9000000.01"]]) {
    const variant = await prisma.catalogProductVariant.create({ data: { publicReference: `CV-RESIDUAL-${suffix}`, productId: product.id, title: `Disposable cent ${suffix}`, normalizedTitle: `disposable cent ${suffix}`, optionFingerprint: `residual-${suffix}`, skuReference: `residual-${suffix}`, attributeValues: {}, status: "ACTIVE" } });
    const offer = await prisma.storeCatalogOffer.create({ data: { publicReference: `CO-RESIDUAL-${suffix}`, storeId: store.id, productId: product.id, variantId: variant.id, storeSku: `residual-${suffix}`, merchantTitle: "Disposable residual item", status: "ACTIVE", publicationStatus: "PUBLISHED", inventoryTrackingMode: "TRACKED", fulfilmentMode: "COURIER_DELIVERY", sellingUnit: "EACH", createdByUserId: store.ownerUserId! } });
    const price = await prisma.storeOfferPriceVersion.create({ data: { publicReference: `PRICE-RESIDUAL-${suffix}`, offerId: offer.id, versionNumber: 1, amount, currency: "ZAR", priceIncludesTax: true, effectiveFrom: new Date("2026-01-01"), status: "ACTIVE", createdByUserId: store.ownerUserId! } });
    await prisma.storeCatalogOffer.update({ where: { id: offer.id }, data: { currentPriceVersionId: price.id, primaryInventoryLocationId: location.id } });
    const item = await prisma.catalogInventoryItem.create({ data: { publicReference: `INV-RESIDUAL-${suffix}`, offerId: offer.id, variantId: variant.id, trackingMode: "TRACKED" } });
    await prisma.catalogInventoryMovement.create({ data: { publicReference: `MOV-RESIDUAL-${suffix}`, inventoryItemId: item.id, locationId: location.id, type: "INITIAL_STOCK", quantityDelta: 20, operationId: `residual-opening-${suffix}`, requestHash: `residual-opening-${suffix}`, reasonCode: "DISPOSABLE_INPUT_STOCK", actorUserId: store.ownerUserId!, resultingOnHand: 20 } });
    await prisma.catalogInventoryLevel.create({ data: { inventoryItemId: item.id, locationId: location.id, onHand: 20, available: 20, reserved: 0 } });
  }
  // A different frozen commission version exercises half-cent allocation on
  // tiny and larger amounts; this is synthetic, independently reviewed input.
  const plan = await createCommissionPlan({ subjectType: "MARKETPLACE_STORE_ORDER", scopeKey: `STORE:${store.id}`, basisType: "ORDER_SUBTOTAL", effectiveFrom: "2026-01-02T00:00:00.000Z", calculationVersion: "disposable-residual-v2", rules: [{ ruleCode: "DISPOSABLE_RESIDUAL", allocationType: "PLATFORM_COMMISSION_REVENUE", beneficiaryType: "PLATFORM", calculationMethod: "PERCENTAGE_BPS", rateBasisPoints: 5000, priority: 1 }], actorUserId: maker.id, operationId: "disposable-residual-plan-create" });
  await submitCommissionPlan(plan.id, maker.id, "disposable-residual-plan-submit");
  await approveCommissionPlan(plan.id, checker.id, "disposable-residual-plan-review");
  await activateCommissionPlan(plan.id, checker.id, "disposable-residual-plan-activate", { allowTestOnlyBypass: true });
}
