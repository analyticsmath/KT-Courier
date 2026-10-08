import { prisma } from "../lib/db/prisma";
import { assertDisposablePaystackAcceptance, assertDisposablePaystackEmail } from "../lib/testing/disposable-paystack-policy";
import { saveParcelProfile, listParcelProfileVersions } from "../lib/commercial/parcel-profiles";
import { saveDeliveryMatrix, actOnDeliveryMatrix, listDeliveryMatrices } from "../lib/marketplace-checkout/delivery-policy-configuration";
import { listTrustedPackageVersions, classifyPersistedCheckoutParcel, actOnTrustedPackageVersion } from "../lib/marketplace-checkout/parcel-configuration.service";
import { createCommissionPlan, submitCommissionPlan, approveCommissionPlan, activateCommissionPlan } from "../lib/services/commission-plan.service";
import type { TrustedPackageVersion } from "../lib/marketplace-checkout/parcel-classification";
import type { DeliveryPolicyVersion } from "../lib/marketplace-checkout/delivery-policy";

type Fixture = { storeId: string; makerId: string; reviewerId: string; makerEmail: string; reviewerEmail: string; email: string; entries: TrustedPackageVersion["packages"]; initialTariffs: DeliveryPolicyVersion["rules"]; originalStoreIds: string[]; tariffVersions: number[]; packageStartingVersion: number };
const fixtureKey = (tag: string) => `e2e-trusted-parcel:${tag}`;
async function fixture(tag: string) { return (await prisma.systemSetting.findUniqueOrThrow({ where: { key: fixtureKey(tag) } })).value as unknown as Fixture; }
async function saveFixture(tag: string, value: Fixture) { await prisma.systemSetting.update({ where: { key: fixtureKey(tag) }, data: { value: JSON.parse(JSON.stringify(value)) } }); }

/** Named isolated DB input facts and canonical policy commands only. No payment
 * provider, finance status, ledger or stock-consumption mutation is reachable. */
async function main() {
  assertDisposablePaystackAcceptance();
  const identity = await prisma.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database() AS database, current_user AS role`;
  if (identity[0]?.database !== "kt_phase75_e2e" || identity[0]?.role !== "kt_phase75_e2e") throw new Error("Named disposable parcel database and role required.");
  const [action, tag, reference] = process.argv.slice(2);
  if (!/^parcel-(1440|390)-[a-f0-9]{8}$/.test(tag ?? "")) throw new Error("Independent synthetic parcel namespace required.");
  if (action === "setup") {
    const base = await prisma.store.findUniqueOrThrow({ where: { slug: "e2e-store" }, include: { defaultPickupAddress: true } });
    const password = (await prisma.user.findUniqueOrThrow({ where: { email: "superadmin@ktcouriers.local" }, select: { passwordHash: true } })).passwordHash;
    const makerEmail = `e2e-${tag}-maker@ktcouriers.local`, reviewerEmail = `e2e-${tag}-reviewer@ktcouriers.local`, email = `e2e-paystack-${tag}@ktcouriers.local`;
    const maker = await prisma.user.create({ data: { email: makerEmail, name: "Disposable packaging maker", role: "SUPER_ADMIN", status: "ACTIVE", passwordHash: password, emailVerifiedAt: new Date() } });
    const reviewer = await prisma.user.create({ data: { email: reviewerEmail, name: "Disposable packaging reviewer", role: "SUPER_ADMIN", status: "ACTIVE", passwordHash: password, emailVerifiedAt: new Date() } });
    const customer = await prisma.user.create({ data: { email, name: "Disposable packaging customer", role: "CUSTOMER", status: "ACTIVE", passwordHash: password, emailVerifiedAt: new Date() } });
    await prisma.customerProfile.create({ data: { userId: customer.id, displayName: "Disposable packaging customer" } });
    const existing = await prisma.store.findMany({ select: { id: true } });
    const store = await prisma.store.create({ data: { slug: `e2e-${tag}`, name: "Disposable measured packaging store", ownerUserId: maker.id, status: "ACTIVE", defaultPickupAddressId: base.defaultPickupAddressId } });
    await prisma.storeSellerLegalIdentity.create({ data: { storeId: store.id, publicReference: `DISPOSABLE-SELLER-${tag}`, identityVersion: "disposable-measurements-v1", legalName: "Disposable packaging fixture; not a real legal entity", vatRegistrationStatus: "NOT_REGISTERED", status: "APPROVED", effectiveFrom: new Date("2026-01-01") } });
    const plan = await createCommissionPlan({ subjectType: "MARKETPLACE_STORE_ORDER", scopeKey: `STORE:${store.id}`, basisType: "ORDER_SUBTOTAL", effectiveFrom: "2026-01-01T00:00:00.000Z", calculationVersion: `disposable-${tag}`, rules: [{ ruleCode: "DISPOSABLE_PLATFORM", allocationType: "PLATFORM_COMMISSION_REVENUE", beneficiaryType: "PLATFORM", calculationMethod: "FIXED_AMOUNT", fixedAmount: "1.00", priority: 1 }], actorUserId: maker.id, operationId: `${tag}:commission-create` });
    await submitCommissionPlan(plan.id, maker.id, `${tag}:commission-submit`); await approveCommissionPlan(plan.id, reviewer.id, `${tag}:commission-approve`); await activateCommissionPlan(plan.id, reviewer.id, `${tag}:commission-activate`, { allowTestOnlyBypass: true });
    const product = await prisma.catalogProduct.findUniqueOrThrow({ where: { publicReference: "CP-E2ESMARTPHONE" } });
    const location = await prisma.inventoryLocation.create({ data: { publicReference: `IL-${tag}`, storeId: store.id, name: "Disposable parcel input inventory", status: "ACTIVE", isPrimary: true } });
    const entries: Fixture["entries"] = [];
    for (const [suffix, lengthCm, widthCm, heightCm, weightKg] of [["small", 10, 20, 15, 5], ["medium", 20, 40, 30, 10], ["large", 40, 80, 60, 20], ["oversize", 40, 80.0001, 60, 20], ["overweight", 40, 80, 60, 20.0001], ["stale", 10, 20, 15, 5]] as const) {
      const variant = await prisma.catalogProductVariant.create({ data: { publicReference: `CV-${tag}-${suffix}`, productId: product.id, title: `Disposable parcel ${suffix}`, normalizedTitle: `${tag}-${suffix}`, optionFingerprint: `${tag}-${suffix}`, attributeValues: {}, status: "ACTIVE" } });
      const offer = await prisma.storeCatalogOffer.create({ data: { publicReference: `CO-${tag}-${suffix}`, storeId: store.id, productId: product.id, variantId: variant.id, storeSku: `${tag}-${suffix}`, merchantTitle: "Disposable parcel item", status: "DRAFT", publicationStatus: "DRAFT", fulfilmentMode: "COURIER_DELIVERY", sellingUnit: "EACH", inventoryTrackingMode: "TRACKED", createdByUserId: maker.id } });
      const price = await prisma.storeOfferPriceVersion.create({ data: { publicReference: `PRICE-${tag}-${suffix}`, offerId: offer.id, versionNumber: 1, amount: "10.00", currency: "ZAR", priceIncludesTax: true, effectiveFrom: new Date("2026-01-01"), status: "ACTIVE", createdByUserId: maker.id } });
      await prisma.storeCatalogOffer.update({ where: { id: offer.id }, data: { currentPriceVersionId: price.id, primaryInventoryLocationId: location.id, status: "ACTIVE", publicationStatus: "PUBLISHED" } });
      await prisma.catalogPublicationSnapshot.create({ data: { publicReference: `PUB-${tag}-${suffix}`, productId: product.id, variantId: variant.id, offerId: offer.id, versionNumber: 1, publicationVersion: `disposable-${tag}-pub1`, snapshot: { synthetic: true }, status: "PUBLISHED", createdByUserId: maker.id } });
      const item = await prisma.catalogInventoryItem.create({ data: { publicReference: `INV-${tag}-${suffix}`, offerId: offer.id, variantId: variant.id, trackingMode: "TRACKED" } });
      await prisma.catalogInventoryMovement.create({ data: { publicReference: `MOV-${tag}-${suffix}`, inventoryItemId: item.id, locationId: location.id, type: "INITIAL_STOCK", quantityDelta: 20, operationId: `${tag}:opening:${suffix}`, requestHash: `${tag}:opening:${suffix}`, reasonCode: "DISPOSABLE_PARCEL_INPUT", actorUserId: maker.id, resultingOnHand: 20 } });
      await prisma.catalogInventoryLevel.create({ data: { inventoryItemId: item.id, locationId: location.id, onHand: 20, available: 20, reserved: 0 } });
      entries.push({ storeId: store.id, offerReference: offer.publicReference, variantReference: variant.publicReference, publicationVersion: String(offer.version), modifiers: [], packingRule: "SINGLE_PREPACKAGED_UNIT", lengthCm, widthCm, heightCm, weightKg, authorityReference: `disposable:${tag}:measured-${suffix}` });
    }
    // Canonical version commands close earlier effective versions; synthetic
    // limits govern only this destroyed browser database, never production.
    for (const [stableKey, lengthCm, widthCm, heightCm, maximumWeightKg] of [["SMALL", 20, 15, 10, 5], ["MEDIUM", 40, 30, 20, 10], ["LARGE", 80, 60, 40, 20]] as const) {
      const latest = (await listParcelProfileVersions()).filter(profile => profile.stableKey === stableKey).sort((a, b) => b.versionNumber - a.versionNumber)[0];
      await saveParcelProfile(maker.id, { stableKey, displayName: `Disposable ${stableKey}`, lengthCm, widthCm, heightCm, maximumWeightKg, status: "ACTIVE", effectiveFrom: new Date().toISOString(), effectiveTo: null, expectedVersion: latest?.versionNumber ?? 0, reason: "Disposable measured limits; no production acceptance or commercial approval." });
    }
    const tariffs = (await listDeliveryMatrices()).filter(v => v.status === "ACTIVE").sort((a, b) => b.version - a.version)[0];
    if (!tariffs) throw new Error("Existing synthetic canonical tariff authority required.");
    const data: Fixture = { storeId: store.id, makerId: maker.id, reviewerId: reviewer.id, makerEmail, reviewerEmail, email, entries, initialTariffs: tariffs.rules, originalStoreIds: existing.map(s => s.id), tariffVersions: [], packageStartingVersion: Math.max(0, ...(await listTrustedPackageVersions()).map(p => p.version)) };
    await prisma.systemSetting.create({ data: { key: fixtureKey(tag), label: "Disposable measured parcel fixture", type: "JSON", value: JSON.parse(JSON.stringify(data)) } });
    console.log(`PARCEL_RECEIPT ${JSON.stringify(data)}`); return;
  }
  const f = await fixture(tag);
  if (action === "tariff-size" || action === "tariff-any") {
    const versions = await listDeliveryMatrices();
    // Preserve all originally seeded stores' prior tariffs. Restrict the old
    // unscoped ANY to those stores so the new owned store can prove NO tariff.
    const rules = f.initialTariffs.flatMap((rule, index) => rule.storeId ? [rule] : f.originalStoreIds.map((storeId, number) => ({ ...rule, key: `PARCEL_PRIOR_${index}_${number}`, storeId })));
    for (const [sizeClass, fee] of [["SMALL", "11.00"], ["MEDIUM", "22.00"], ["LARGE", "33.00"], ...(action === "tariff-any" ? [["ANY", "44.00"]] : [])] as Array<["SMALL" | "MEDIUM" | "LARGE" | "ANY", string]>) rules.push({ key: `PARCEL_${sizeClass}`, sizeClass, minDistanceKm: 0, maxDistanceKm: 50, province: "Gauteng", regionId: null, storeId: f.storeId, fee, highRiskSurcharge: "0.00", minimumFee: fee, maximumFee: fee });
    const draft = await saveDeliveryMatrix(f.makerId, { expectedVersion: Math.max(0, ...versions.map(v => v.version)), effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveTo: null, reason: `Disposable ${tag} ${action} tariff; values are synthetic.`, rules });
    const row = () => prisma.systemSetting.findUniqueOrThrow({ where: { key: `production_marketplace_delivery_matrix_v${draft.version}` } });
    for (const next of ["APPROVE", "ACTIVATE"] as const) await actOnDeliveryMatrix(f.reviewerId, { version: draft.version, expectedUpdatedAt: (await row()).updatedAt.toISOString(), action: next, reason: `Independent disposable ${tag} tariff governance.` });
    f.tariffVersions.push(draft.version); await saveFixture(tag, f); console.log(`PARCEL_RECEIPT ${JSON.stringify({ tariffVersion: draft.version, status: "ACTIVE" })}`); return;
  }
  if (action === "stale-offer") {
    const owned = f.entries.find(e => e.offerReference.endsWith("-stale"))!;
    const offer = await prisma.storeCatalogOffer.update({ where: { publicReference: owned.offerReference }, data: { version: { increment: 1 } } });
    console.log(`PARCEL_RECEIPT ${JSON.stringify({ offerVersion: offer.version })}`); return;
  }
  if (action === "cleanup") {
    for (const version of await listTrustedPackageVersions()) if (version.createdByUserId === f.makerId && version.status !== "RETIRED") await actOnTrustedPackageVersion(f.reviewerId, { version: version.version, expectedUpdatedAt: version.updatedAt, action: "RETIRE", reason: `Retire completed disposable ${tag} packaging test.` });
    for (const version of await listDeliveryMatrices()) if (f.tariffVersions.includes(version.version) && version.status !== "RETIRED") await actOnDeliveryMatrix(f.reviewerId, { version: version.version, expectedUpdatedAt: version.updatedAt, action: "RETIRE", reason: `Retire completed disposable ${tag} tariff test.` });
    console.log(`PARCEL_RECEIPT ${JSON.stringify({ restoredTariffAuthority: true })}`); return;
  }
  if (action !== "snapshot") throw new Error("Unsupported disposable parcel action.");
  const checkout = await prisma.marketplaceCheckout.findUniqueOrThrow({ where: { publicReference: reference }, include: { customer: true, storeGroups: { include: { lines: true } } } });
  assertDisposablePaystackEmail(checkout.customer?.email ?? "");
  if (checkout.customer?.email !== f.email || checkout.storeGroups.some(group => group.storeId !== f.storeId)) throw new Error("Owned parcel checkout required.");
  const quoteIds = checkout.storeGroups.map(group => group.deliveryQuoteReference).filter((id): id is string => !!id);
  const quotes = await prisma.pricingQuote.findMany({ where: { id: { in: quoteIds }, storeId: f.storeId }, select: { id: true, subtotal: true, taxAmount: true, total: true, ruleSnapshot: true } });
  const stock = await prisma.catalogInventoryLevel.findMany({ where: { inventoryItem: { offer: { storeId: f.storeId } } }, select: { onHand: true, reserved: true, available: true } });
  console.log(`PARCEL_RECEIPT ${JSON.stringify({ checkout: { status: checkout.status, version: checkout.version, reviewVersion: checkout.reviewVersion }, classification: await classifyPersistedCheckoutParcel(reference, f.storeId), quotes, stock, paymentCount: await prisma.payment.count({ where: { marketplaceCheckoutId: checkout.id } }), orderCount: await prisma.marketplaceOrder.count({ where: { checkoutId: checkout.id } }), audit: await prisma.adminActivityLog.findMany({ where: { actorUserId: { in: [f.makerId, f.reviewerId] }, entityType: "MarketplaceTrustedPackaging" }, select: { action: true, actorUserId: true, metadata: true } }) })}`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Disposable parcel control failed."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
