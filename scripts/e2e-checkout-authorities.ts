import { prisma } from "@/lib/db/prisma";
import { saveDeliveryConfiguration } from "@/lib/client-platform/delivery.service";
import { INITIAL_DELIVERY } from "@/lib/client-platform/initial-delivery";
import { saveDeliveryMatrix, actOnDeliveryMatrix, listDeliveryMatrices } from "@/lib/marketplace-checkout/delivery-policy-configuration";
import { createCommissionPlan, submitCommissionPlan, approveCommissionPlan, activateCommissionPlan } from "@/lib/services/commission-plan.service";
import { createLegalDocumentDraft, publishLegalDocumentVersion } from "@/lib/services/legal-documents.service";

/** Synthetic browser authority, never a production business approval or provider proof. */
export async function createDisposableCheckoutAuthorities() {
  const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent");
  if (process.env.KT_RUNTIME_ENV !== "e2e" || process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "db"].includes(url.hostname) || url.pathname !== "/kt_phase75_e2e") throw new Error("Checkout fixtures require the isolated browser database.");
  const maker = await prisma.user.findUniqueOrThrow({ where: { email: "superadmin@ktcouriers.local" } });
  const checker = await prisma.user.create({ data: { email: "disposable-checkout-reviewer@example.test", name: "Disposable checkout reviewer", role: "SUPER_ADMIN", status: "ACTIVE" } });
  const region = await prisma.deliveryRegion.findUniqueOrThrow({ where: { slug: "johannesburg-metro" } });
  const initial = INITIAL_DELIVERY[0];
  const priorService = await prisma.deliveryServiceDefinition.findFirst({ where: { stableKey: initial.stableKey }, orderBy: { versionNumber: "desc" } });
  await saveDeliveryConfiguration(maker.id, { ...initial, regionIds: [region.id], expectedVersion: priorService?.versionNumber ?? 0, reason: "Disposable service fixture; no production coverage approval implied." });

  const latest = Math.max(0, ...(await listDeliveryMatrices()).map((item) => item.version));
  const draft = await saveDeliveryMatrix(maker.id, { expectedVersion: latest, reason: "Disposable browser matrix; this amount is synthetic test data.", effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveTo: null, rules: [{ key: "DISPOSABLE_BROWSER_ANY", sizeClass: "ANY", minDistanceKm: 0, maxDistanceKm: 50, province: "Gauteng", regionId: region.id, storeId: null, fee: "23.45", highRiskSurcharge: "0.00", minimumFee: "23.45", maximumFee: "23.45" }] });
  const row = () => prisma.systemSetting.findUniqueOrThrow({ where: { key: `production_marketplace_delivery_matrix_v${draft.version}` } });
  await actOnDeliveryMatrix(checker.id, { version: draft.version, expectedUpdatedAt: (await row()).updatedAt.toISOString(), action: "APPROVE", reason: "Independent disposable fixture review; not production approval." });
  await actOnDeliveryMatrix(checker.id, { version: draft.version, expectedUpdatedAt: (await row()).updatedAt.toISOString(), action: "ACTIVATE", reason: "Activate only the isolated browser fixture matrix." });

  for (const slug of ["e2e-store", "e2e-other-store"]) {
    const store = await prisma.store.findUniqueOrThrow({ where: { slug } });
    await prisma.storeSellerLegalIdentity.create({ data: { storeId: store.id, publicReference: `DISPOSABLE-SELLER-${slug}`, identityVersion: "disposable-v1", legalName: "Disposable browser seller; not a production legal entity", vatRegistrationStatus: "NOT_REGISTERED", status: "APPROVED", effectiveFrom: new Date("2026-01-01") } });
    const residual = slug === "e2e-other-store";
    const plan = await createCommissionPlan({ subjectType: "MARKETPLACE_STORE_ORDER", scopeKey: `STORE:${store.id}`, basisType: "ORDER_SUBTOTAL", effectiveFrom: "2026-01-01T00:00:00.000Z", calculationVersion: residual ? "disposable-residual-v2" : "disposable-browser-v1", rules: [{ ruleCode: "DISPOSABLE_PLATFORM", allocationType: "PLATFORM_COMMISSION_REVENUE", beneficiaryType: "PLATFORM", ...(residual ? { calculationMethod: "PERCENTAGE_BPS" as const, rateBasisPoints: 5000 } : { calculationMethod: "FIXED_AMOUNT" as const, fixedAmount: "1.00" }), priority: 1 }], actorUserId: maker.id, operationId: `disposable-${slug}-create` });
    await submitCommissionPlan(plan.id, maker.id, `disposable-${slug}-submit`);
    await approveCommissionPlan(plan.id, checker.id, `disposable-${slug}-review`);
    await activateCommissionPlan(plan.id, checker.id, `disposable-${slug}-activate`, { allowTestOnlyBypass: true });
  }
  for (const documentType of ["TERMS_OF_SERVICE", "PRIVACY_NOTICE", "REFUND_POLICY"]) {
    const document = await createLegalDocumentDraft({ actorUserId: maker.id, documentType, jurisdiction: "ZA", version: "disposable-browser-v1", content: `Disposable ${documentType} content. This fixture is not production legal approval.` });
    await publishLegalDocumentVersion({ actorUserId: checker.id, publicReference: String(document.publicReference), operationId: `disposable-legal-${documentType}`, effectiveAt: new Date("2026-01-01") });
  }
}
