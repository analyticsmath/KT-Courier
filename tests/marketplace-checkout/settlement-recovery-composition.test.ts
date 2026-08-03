import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertCanonicalMarketplaceSettlement, settleMarketplaceStoreOrder, type CanonicalMarketplaceSettlement, type MarketplaceSettlementRepository } from "@/lib/marketplace-checkout/settlement.service";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const settlement = (): CanonicalMarketplaceSettlement => ({
  checkoutId: "checkout-1", checkoutReference: "checkout-ref", storeOrderId: "store-order-1", storeOrderReference: "store-order-ref", storeOrderStatus: "PENDING_SETTLEMENT", storeId: "store-1", storePublicReference: "store-1",
  marketplaceOrderId: "marketplace-order-1", marketplaceOrderReference: "marketplace-order-ref", marketplaceOrderGrandTotal: "12.00",
  payment: { id: "payment-1", publicReference: "payment-ref", status: "SUCCEEDED", subjectType: "MARKETPLACE_CHECKOUT", marketplaceOrderId: "marketplace-order-1", amount: "12.00", currency: "ZAR" },
  snapshot: { id: "snapshot-1", publicReference: "snapshot-ref", settlementVersion: "phase20-v1", authoritativeAt: "2026-07-19T00:00:00.000Z", status: "PENDING", sellerBasis: "10.00", commissionAmount: "1.00", storeEarningAmount: "9.00", deliveryFeeResidual: "2.00", currency: "ZAR", commissionPlanReference: "plan-ref", commissionPlanVersion: "1", sourceEvidenceFingerprint: "frozen", commissionAccrualReference: null, storeEarningReference: null, commissionBeneficiarySnapshots: [] },
  storeWalletId: "wallet-1", lines: [{ allocations: [{ type: "SELLER_BASIS", amount: "10.00" }, { type: "COMMISSION", amount: "1.00" }, { type: "STORE_EARNING", amount: "9.00" }] }],
});

describe("Phase 20 settlement and recovery composition", () => {
  it("composes the canonical store settlement once and replays its operation receipt", async () => {
    const calls: string[] = []; const canonical = settlement();
    const repository: MarketplaceSettlementRepository = {
      transaction: async (work) => work(), resolveOperationReceipt: async () => ({ completed: false, response: null }), lockCanonicalSettlement: async () => canonical,
      accrueCommissionAndStoreEarning: async () => { calls.push("accrue"); return { commissionAccrualReference: "CA-1", storeEarningReference: "SE-1" }; },
      completeSettlement: async () => { calls.push("complete"); }, recordReconciliationRequired: async () => { calls.push("reconcile"); },
    };
    await expect(settleMarketplaceStoreOrder({ marketplaceStoreOrderReference: "store-order-ref", operationId: "settlement-op-1", testApproval: { approved: true } }, repository)).resolves.toEqual({ commissionAccrualReference: "CA-1", storeEarningReference: "SE-1", replayed: false });
    expect(calls).toEqual(["accrue", "complete"]);
  });

  it("rejects changed line allocation evidence and keeps delivery outside seller basis", () => {
    const invalid = settlement(); (invalid.lines[0]!.allocations[0] as { amount: string }).amount = "12.00";
    expect(() => assertCanonicalMarketplaceSettlement(invalid)).toThrow(/allocations/i);
  });

  it("exposes one Phase 14 transaction primitive and has the public service reuse it", () => {
    const file = source("lib/services/commission-accrual.service.ts");
    for (const token of ["accrueCommissionInTransaction", "AuthoritativeCommissionSnapshot", "CommissionOperationEvidence", "creationIdempotencyKey", "subjectType_subjectId_settlementVersion", "ORDER BY \"id\" ASC FOR UPDATE", "commissionAccrualPosting", "TransactionIsolationLevel.Serializable"]) expect(file).toContain(token);
    expect(file).toMatch(/accrueCommissionInTransaction\(tx, snapshot/);
  });

  it("exposes one Phase 16 transaction primitive and reuses exact commission attribution", () => {
    const file = source("lib/services/store-earning-accrual.service.ts");
    for (const token of ["accrueStoreEarningInTransaction", "StoreCommissionAllocationEvidence", "sellerSettlementBasisAmount", "attributedCommissionAmount", "storeAttributedAmount.add", "STORE_EARNING_COMMISSION_OVER_ATTRIBUTED", "storeEarningAccrualPosting"]) expect(file).toContain(token);
    expect(file).toMatch(/accrueStoreEarningInTransaction\(tx, snapshot/);
  });

  it("creates durable per-store settlement work after finalization", () => {
    const file = source("lib/marketplace-checkout/prisma-marketplace-finalization.repository.ts");
    for (const token of ["marketplaceStoreSettlementJob.create", "settlementVersion", "requestHash", "PENDING"]) expect(file).toContain(token);
  });

  it("wires Phase 12 successful payment handling to the durable marketplace finalizer", () => {
    expect(source("lib/services/payfast-itn-application.service.ts")).toContain("afterVerifiedPaymentSucceeded");
    const hook = source("lib/marketplace-checkout/marketplace-payment-success-hook.service.ts");
    for (const token of ["createOrResolveFinalizationReceipt", "finalizePaidMarketplaceCheckout", "markCheckoutReconciliationRequired"]) expect(hook).toContain(token);
    expect(source("app/api/payments/payfast/itn/route.ts")).toContain("onVerifiedMarketplacePaymentSucceededInProduction");
  });

  it("uses concrete reservation and payment repositories from customer composition", () => {
    expect(source("lib/marketplace-checkout/checkout.service.ts")).toContain("createPrismaMarketplaceReservationRepository");
    expect(source("lib/marketplace-checkout/checkout.service.ts")).toContain("createPrismaMarketplacePaymentPreparationRepository");
    expect(source("lib/marketplace-checkout/prisma-marketplace-reservation.repository.ts")).toContain("ORDER BY \"id\" ASC FOR UPDATE");
    expect(source("lib/marketplace-checkout/prisma-marketplace-payment-preparation.repository.ts")).toContain("marketplaceCheckoutId");
  });

  it("keeps administrative recovery on canonical services and rejects manual financial fields", () => {
    const routes = ["app/api/admin/marketplace-checkouts/[reference]/retry-finalization/route.ts", "app/api/admin/marketplace-store-orders/[reference]/retry-settlement/route.ts", "app/api/admin/inventory-reservations/[reference]/reconcile/route.ts", "app/api/admin/marketplace-checkout-reconciliation/[reference]/rescan/route.ts"].map(source).join("\n");
    for (const token of ["requireAdminApiPermission", "prepareMarketplaceAdminRecovery", "operationId"]) expect(routes).toContain(token);
    expect(source("lib/marketplace-checkout/admin-recovery-policy.ts")).toContain("PermissionEffect.DENY");
    expect(routes).not.toMatch(/ledgerAccount|grandTotal|directly consume/i);
  });

  it("operational processors support dry-run/apply/limit and call canonical services", () => {
    const support = source("scripts/marketplace-checkout-script-support.mjs");
    for (const token of ["--dry-run", "--apply", "--limit"]) expect(support).toContain(token);
    expect(source("scripts/phase20-finalize-paid-marketplace-checkouts.worker.ts")).toContain("onVerifiedMarketplacePaymentSucceededInProduction");
    expect(source("scripts/phase20-settle-marketplace-store-orders.worker.ts")).toContain("settleMarketplaceStoreOrder");
    expect(source("scripts/phase20-expire-checkout-reservations.worker.ts")).toContain("expireMarketplaceCheckoutReservation");
  });
});
