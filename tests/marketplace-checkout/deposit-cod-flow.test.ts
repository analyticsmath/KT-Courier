import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { assertMarketplacePaymentPlanTotals, digitalMarketplacePaymentPlan, parseMarketplacePaymentPlan, resolveMarketplacePaymentPlan } from "@/lib/marketplace-checkout/payment-plan";
import { assertMarketplaceDigitalReceipt, assertMarketplaceCashJournals } from "@/lib/marketplace-checkout/payment-funding";
import { prepareMarketplaceCheckoutPayment, type MarketplacePaymentPreparationRepository } from "@/lib/marketplace-checkout/marketplace-payment-preparation.service";
import { finalizePaidMarketplaceCheckout, type MarketplaceFinalizationRepository } from "@/lib/marketplace-checkout/marketplace-checkout-finalization.service";
import { assertCanonicalMarketplaceSettlement, settleMarketplaceStoreOrder, type CanonicalMarketplaceSettlement, type MarketplaceSettlementRepository } from "@/lib/marketplace-checkout/settlement.service";

const d = (v: string) => new Prisma.Decimal(v);
const split = { version: "marketplace-payment-v1" as const, mode: "DEPOSIT_PLUS_COD" as const, authoritativeTotal: "200.00", digitalRequired: "100.00", cashRequired: "100.00", policyId: "policy-1", policyVersion: 1, policyEvidence: {} };
const receipt = () => ({ status: "SUCCEEDED", subjectType: "MARKETPLACE_CHECKOUT", currency: "ZAR", amount: d("100.00"), successfulAttempt: { status: "SUCCEEDED" }, successWebhookEvent: { processingStatus: "APPLIED", signatureVerified: true, merchantVerified: true, amountVerified: true, providerDataVerified: true }, successLedgerJournal: { type: "EXTERNAL_PAYMENT_RECEIPT", currency: "ZAR", totalDebits: d("100.00"), totalCredits: d("100.00"), entries: [{ direction: "CREDIT", amount: d("100.00"), account: { code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR" } }] } });
const policyDb = (mode = "DEPOSIT_PLUS_COD") => ({ paymentMethodPolicy: { findMany: vi.fn().mockResolvedValue([{ id: "policy-1", versionNumber: 1, mode, storeId: "store-1", status: "ACTIVE", effectiveFrom: new Date(0), depositPercent: d("0.5"), maximumCodAmount: d("1000.00") }]) }, store: { findUnique: vi.fn().mockResolvedValue({ status: "ACTIVE", ownerUser: { status: "ACTIVE", emailVerifiedAt: new Date() } }) } });
const context = { storeId: "store-1", total: "101.01", fulfilmentMode: "COURIER_DELIVERY", groupCount: 1 };

describe("marketplace deposit COD commercial and funding flow", () => {
  it("freezes odd cents with provider receiving 50.51 and cash obligation 50.50", async () => {
    const plan = await resolveMarketplacePaymentPlan(context, policyDb() as never);
    expect(plan).toMatchObject({ digitalRequired: "50.51", cashRequired: "50.50", policyId: "policy-1", policyVersion: 1 });
    expect(() => assertMarketplacePaymentPlanTotals({ grandTotal: "101.01", digitalRequired: "50.51", cashRequired: "50.50", groups: [{ groupTotal: "101.01", fulfilmentMode: "COURIER_DELIVERY", paymentPlan: plan }] })).not.toThrow();
  });
  it.each([{ groupCount: 2 }, { fulfilmentMode: "CUSTOMER_PICKUP" }, { promotionDiscount: "0.01" }])("rejects unsupported cash shape before preparing a provider amount: %j", async patch => {
    await expect(resolveMarketplacePaymentPlan({ ...context, ...patch }, policyDb() as never)).rejects.toMatchObject({ code: "CHECKOUT_REVIEW_REQUIRED" });
  });
  it("preserves normal fully digital multi-store checkout", async () => {
    expect(await resolveMarketplacePaymentPlan({ ...context, groupCount: 2 }, policyDb("DIGITAL") as never)).toMatchObject({ digitalRequired: "101.01", cashRequired: "0.00" });
    expect(() => assertMarketplacePaymentPlanTotals({ grandTotal: "200.00", groups: [{ groupTotal: "80.00", paymentPlan: digitalMarketplacePaymentPlan("80.00") }, { groupTotal: "120.00", paymentPlan: digitalMarketplacePaymentPlan("120.00") }] })).not.toThrow();
  });
  it("rejects changed split or missing approved cash plan", () => {
    expect(() => parseMarketplacePaymentPlan({ ...split, cashRequired: "99.99" })).toThrow();
    expect(() => assertMarketplacePaymentPlanTotals({ grandTotal: "200.00", digitalRequired: "100.00", cashRequired: "100.00", groups: [{ groupTotal: "200.00", fulfilmentMode: "COURIER_DELIVERY" }] })).toThrow();
  });
  it("charges and replays the digital allocation while retaining the full commercial total", async () => {
    const checkout = { id: "checkout-1", publicReference: "checkout-ref", customerUserId: "customer-1", guestAccessTokenHash: null, status: "RESERVED", grandTotal: "200.00", digitalRequired: "100.00", cashRequired: "100.00", currency: "ZAR", acceptedFingerprint: "frozen", reservationActive: true, payment: null as null | { id: string; publicReference: string; amount: string; currency: string } };
    const repository: MarketplacePaymentPreparationRepository = { transaction: work => work(), lockCheckout: async () => checkout, linkPayment: async () => {}, transitionCheckout: async () => {} };
    const provider = vi.fn(async (input: { amount: string }) => ({ paymentId: "payment-1", paymentReference: "PAY-1", amount: input.amount, currency: "ZAR" as const, providerAction: null, replayed: false }));
    const command = { checkoutReference: "checkout-ref", payerEmail: "customer@example.test", operationId: "cod-charge-1", testApproval: { approved: true as const } };
    await expect(prepareMarketplaceCheckoutPayment(repository, { prepareMarketplacePayment: provider }, command)).resolves.toMatchObject({ amount: "100.00" });
    expect(provider).toHaveBeenCalledWith(expect.objectContaining({ amount: "100.00" }));
    checkout.payment = { id: "payment-1", publicReference: "PAY-1", amount: "100.00", currency: "ZAR" };
    await expect(prepareMarketplaceCheckoutPayment(repository, { prepareMarketplacePayment: provider }, command)).resolves.toMatchObject({ amount: "100.00", replayed: true });
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it("finalizes inventory and merchant order on verified deposit without pretending cash was received", async () => {
    const consume = vi.fn(), create = vi.fn(async () => ({ id: "order-1", publicReference: "MPO-1" }));
    const checkout = { id: "checkout-1", publicReference: "checkout-ref", cartId: "cart-1", status: "PAYMENT_PENDING", currency: "ZAR", grandTotal: "200.00", digitalRequired: "100.00", cashRequired: "100.00", commercialFingerprint: "frozen", customerUserId: "customer-1", storeGroups: [{ storeId: "store-1", groupTotal: "200.00", fulfilmentMode: "COURIER_DELIVERY", paymentPlan: split, lines: [] }] };
    const repository = { transaction: async (work: () => Promise<unknown>) => work(), lockVerifiedSuccessfulPayment: async () => ({ id: "payment-1", publicReference: "PAY-1", status: "SUCCEEDED", amount: "100.00", currency: "ZAR", marketplaceCheckoutId: "checkout-1" }), lockCheckout: async () => checkout, lockReservation: async () => ({ id: "reservation-1", status: "ACTIVE", commercialFingerprint: "frozen" }), findOrderByCheckout: async () => null, consumeReservation: consume, createMarketplaceOrder: create, createMarketplaceStoreOrder: vi.fn(async () => ({ id: "store-order-1", publicReference: "MSO-1" })), createSettlementSnapshot: vi.fn(), scheduleSettlement: vi.fn(), completeCheckoutAndConvertCart: vi.fn() } as unknown as MarketplaceFinalizationRepository;
    await expect(finalizePaidMarketplaceCheckout(repository, { paymentId: "payment-1", checkoutId: "checkout-1", operationId: "cod-finalize-1", testApproval: { approved: true } })).resolves.toEqual({ publicReference: "MPO-1", replayed: false });
    expect(consume).toHaveBeenCalledOnce(); expect(create).toHaveBeenCalledWith(expect.objectContaining({ checkout: expect.objectContaining({ grandTotal: "200.00", cashRequired: "100.00" }) }));
  });
  it("requires captured deposit receipt and exact held credit, not provider status alone", () => {
    const paid = receipt(); expect(() => assertMarketplaceDigitalReceipt(paid,"100.00")).not.toThrow();
    paid.successLedgerJournal.entries[0].amount = d("99.99"); expect(() => assertMarketplaceDigitalReceipt(paid,"100.00")).toThrow();
    expect(() => assertMarketplaceDigitalReceipt(receipt(),"200.00")).toThrow();
  });
  it("verifies driver custody and bank journals cannot be borrowed from another order", async () => {
    const entry = (code: string, direction: string) => ({ account: { code }, direction, amount: d("100.00") });
    const common = { type: "GENERAL", currency: "ZAR", totalDebits: d("100.00"), totalCredits: d("100.00") };
    const journals = [{ ...common, id: "collect-1", sourceReference: "cod:COD-1:collection", entries: [entry("DRIVER-COD-CASH-DRIVER1","DEBIT"),entry("PLATFORM-CUSTOMER-FUNDS-HELD-ZAR","CREDIT")] }, { ...common, id: "bank-1", sourceReference: "cod:COD-1:reconciliation", entries: [entry("PLATFORM-CASH-CLEARING-ZAR","DEBIT"),entry("DRIVER-COD-CASH-DRIVER1","CREDIT")] }];
    const db = { ledgerJournal: { findMany: vi.fn().mockResolvedValue(journals) } };
    const cod = { publicReference: "COD-1", collectorDriverId: "driver-1", cashCollected: d("100.00"), cashReconciled: d("100.00"), collectionJournalId: "collect-1", reconciliationJournalId: "bank-1" };
    await expect(assertMarketplaceCashJournals(db as never,cod)).resolves.toBeUndefined();
    journals[1].sourceReference = "cod:OTHER:reconciliation"; await expect(assertMarketplaceCashJournals(db as never,cod)).rejects.toThrow();
  });
});

const canonical = (): CanonicalMarketplaceSettlement => ({ checkoutId: "checkout-1", checkoutReference: "checkout-ref", storeOrderId: "store-order-1", storeOrderReference: "store-order-ref", storeOrderStatus: "PENDING_SETTLEMENT", storeId: "store-1", storePublicReference: "store-1", marketplaceOrderId: "order-1", marketplaceOrderReference: "MPO-1", marketplaceOrderGrandTotal: "200.00", digitalRequired: "100.00", cashRequired: "100.00", payment: { id: "payment-1", publicReference: "PAY-1", status: "SUCCEEDED", subjectType: "MARKETPLACE_CHECKOUT", marketplaceOrderId: "order-1", amount: "100.00", currency: "ZAR" }, snapshot: { id: "snapshot-1", publicReference: "snapshot-ref", settlementVersion: "phase20-v1", authoritativeAt: "2026-10-15T00:00:00.000Z", status: "PENDING", sellerBasis: "180.00", commissionAmount: "18.00", storeEarningAmount: "162.00", deliveryFeeResidual: "20.00", currency: "ZAR", commissionPlanReference: "plan-1", commissionPlanVersion: "1", sourceEvidenceFingerprint: "frozen", commissionBeneficiarySnapshots: [], commissionAccrualReference: null, storeEarningReference: null }, storeWalletId: "wallet-1", lines: [{ allocations: [{ type: "SELLER_BASIS", amount: "180.00" },{ type: "COMMISSION", amount: "18.00" },{ type: "STORE_EARNING", amount: "162.00" }] }], cashFunding: { status: "RECONCILED", paymentId: "payment-1", authoritativePayable: "200.00", digitalRequired: "100.00", digitalPaid: "100.00", cashObligation: "100.00", cashCollected: "100.00", cashReconciled: "100.00", remittanceDiscrepancy: "0.00", collectionJournalId: "collect-1", reconciliationJournalId: "bank-1" } });
describe("marketplace COD settlement", () => {
  it("accepts full source funding only after exact remittance", () => { expect(() => assertCanonicalMarketplaceSettlement(canonical())).not.toThrow(); });
  it.each(["READY_FOR_COLLECTION","COLLECTED","UNDER_RECONCILIATION"])("waits without creating failure or earnings when cash is %s", async status => {
    const initial = canonical(); const state = { ...initial, cashFunding: { ...initial.cashFunding!, status } };
    const accrue = vi.fn(), fail = vi.fn();
    const repository = { transaction: async (work: () => Promise<unknown>) => work(), resolveOperationReceipt: async () => ({ completed: false, response: null }), lockCanonicalSettlement: async () => state, accrueCommissionAndStoreEarning: accrue, completeSettlement: vi.fn(), recordReconciliationRequired: fail } as unknown as MarketplaceSettlementRepository;
    await expect(settleMarketplaceStoreOrder({ marketplaceStoreOrderReference: "store-order-ref", operationId: "cod-settle-1", testApproval: { approved: true } }, repository)).rejects.toMatchObject({ code: "SETTLEMENT_AWAITING_CASH" });
    expect(accrue).not.toHaveBeenCalled(); expect(fail).not.toHaveBeenCalled();
  });
  it.each([{ paymentId: "another-payment" }, { cashCollected: "99.99" }, { cashReconciled: "99.99" }, { remittanceDiscrepancy: "0.01" }, { reconciliationJournalId: null }])("rejects unrelated or incomplete bank evidence: %j", patch => { const initial = canonical(); const state = { ...initial, cashFunding: { ...initial.cashFunding!, ...patch } }; expect(() => assertCanonicalMarketplaceSettlement(state)).toThrow(); });
});
