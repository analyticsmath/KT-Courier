import { createHash } from "node:crypto";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
import { assertSettlementArithmetic, parseZarToCents } from "@/lib/marketplace-checkout/policy";
import { assertMarketplaceCheckoutProductionReady } from "@/lib/marketplace-checkout/production-lock";

export type MarketplaceSettlementLineAllocation = Readonly<{ type: "SELLER_BASIS" | "COMMISSION" | "STORE_EARNING"; amount: string }>;
export type CanonicalMarketplaceSettlement = Readonly<{
  checkoutId: string;
  checkoutReference: string;
  storeOrderId: string;
  storeOrderReference: string;
  storeOrderStatus: string;
  storeId: string;
  storePublicReference: string;
  marketplaceOrderId: string;
  marketplaceOrderReference: string;
  marketplaceOrderGrandTotal: string;
  payment: Readonly<{ id: string; publicReference: string; status: string; subjectType: string; marketplaceOrderId: string | null; amount: string; currency: string }>;
  snapshot: Readonly<{ id: string; publicReference: string; settlementVersion: string; authoritativeAt: string; status: string; sellerBasis: string; commissionAmount: string; storeEarningAmount: string; deliveryFeeResidual: string; currency: string; commissionPlanReference: string | null; commissionPlanVersion: string | null; sourceEvidenceFingerprint: string; commissionBeneficiarySnapshots: readonly Readonly<{ beneficiaryType: "PROMOTER"; ownerId: string; walletId: string; commissionPayableAccountId: string; attributionReference: string; attributionVersion: string }>[]; commissionAccrualReference: string | null; storeEarningReference: string | null }>;
  storeWalletId: string;
  lines: readonly Readonly<{ allocations: readonly MarketplaceSettlementLineAllocation[] }> [];
}>;

export type SettlementOperationReceipt = Readonly<{ completed: boolean; response: { commissionAccrualReference: string; storeEarningReference: string } | null }>;

/** The repository owns persistence and invokes the Phase 14/16 transaction primitives. */
export type MarketplaceSettlementRepository = Readonly<{
  transaction<T>(work: () => Promise<T>): Promise<T>;
  resolveOperationReceipt(input: Readonly<{ marketplaceStoreOrderReference: string; operationId: string; requestHash: string }>): Promise<SettlementOperationReceipt>;
  lockCanonicalSettlement(reference: string): Promise<CanonicalMarketplaceSettlement | null>;
  accrueCommissionAndStoreEarning(input: Readonly<{ settlement: CanonicalMarketplaceSettlement; operationId: string }>): Promise<{ commissionAccrualReference: string; storeEarningReference: string }>;
  completeSettlement(input: Readonly<{ settlement: CanonicalMarketplaceSettlement; operationId: string; commissionAccrualReference: string; storeEarningReference: string }>): Promise<void>;
  recordReconciliationRequired(input: Readonly<{ marketplaceStoreOrderReference: string; operationId: string; safeError: string }>): Promise<void>;
}>;

function requestHash(reference: string, operationId: string): string {
  return createHash("sha256").update(`${reference}:${operationId}:phase20-settlement-v1`).digest("hex");
}

function sum(lines: CanonicalMarketplaceSettlement["lines"], type: MarketplaceSettlementLineAllocation["type"]): bigint {
  return lines.reduce((total, line) => total + line.allocations.filter((allocation) => allocation.type === type).reduce((lineTotal, allocation) => lineTotal + BigInt(parseZarToCents(allocation.amount)), BigInt(0)), BigInt(0));
}

export function assertCanonicalMarketplaceSettlement(settlement: CanonicalMarketplaceSettlement): void {
  const snapshot = settlement.snapshot;
  if (!["PENDING", "RECONCILIATION_REQUIRED"].includes(snapshot.status) || !["PENDING_SETTLEMENT", "RECONCILIATION_REQUIRED"].includes(settlement.storeOrderStatus)) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Marketplace store settlement is not eligible for canonical settlement.");
  if (!snapshot.commissionPlanReference || !snapshot.commissionPlanVersion || snapshot.currency !== "ZAR" || settlement.payment.currency !== "ZAR" || settlement.payment.status !== "SUCCEEDED" || settlement.payment.subjectType !== "MARKETPLACE_CHECKOUT" || settlement.payment.marketplaceOrderId !== settlement.marketplaceOrderId) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Canonical settlement payment, frozen plan, or currency evidence is invalid.");
  if (settlement.payment.amount !== settlementOrderTotal(settlement)) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Verified marketplace payment amount does not equal its parent marketplace order total.");
  assertSettlementArithmetic(snapshot);
  if (sum(settlement.lines, "SELLER_BASIS") !== BigInt(parseZarToCents(snapshot.sellerBasis)) || sum(settlement.lines, "COMMISSION") !== BigInt(parseZarToCents(snapshot.commissionAmount)) || sum(settlement.lines, "STORE_EARNING") !== BigInt(parseZarToCents(snapshot.storeEarningAmount))) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Immutable line financial allocations do not equal the store settlement snapshot.");
}

function settlementOrderTotal(settlement: CanonicalMarketplaceSettlement): string {
  if (!settlement.marketplaceOrderGrandTotal) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Marketplace order total evidence is missing.");
  return settlement.marketplaceOrderGrandTotal;
}

export async function settleMarketplaceStoreOrder(input: Readonly<{ marketplaceStoreOrderReference: string; operationId: string; testApproval?: { approved: true } }>, repository: MarketplaceSettlementRepository): Promise<{ commissionAccrualReference: string; storeEarningReference: string; replayed: boolean }> {
  assertMarketplaceCheckoutProductionReady("SETTLEMENT", input.testApproval);
  if (!input.marketplaceStoreOrderReference || !input.operationId) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "A canonical store-order reference and operation ID are required.");
  const hash = requestHash(input.marketplaceStoreOrderReference, input.operationId);
  try {
    return await repository.transaction(async () => {
      const receipt = await repository.resolveOperationReceipt({ marketplaceStoreOrderReference: input.marketplaceStoreOrderReference, operationId: input.operationId, requestHash: hash });
      if (receipt.completed && receipt.response) return { ...receipt.response, replayed: true };
      const settlement = await repository.lockCanonicalSettlement(input.marketplaceStoreOrderReference);
      if (!settlement) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "The canonical marketplace store order was not found.");
      if (["COMPLETED", "ORCHESTRATED"].includes(settlement.snapshot.status) && settlement.snapshot.commissionAccrualReference && settlement.snapshot.storeEarningReference) return { commissionAccrualReference: settlement.snapshot.commissionAccrualReference, storeEarningReference: settlement.snapshot.storeEarningReference, replayed: true };
      assertCanonicalMarketplaceSettlement(settlement);
      const result = await repository.accrueCommissionAndStoreEarning({ settlement, operationId: input.operationId });
      await repository.completeSettlement({ settlement, operationId: input.operationId, ...result });
      return { ...result, replayed: false };
    });
  } catch (error) {
    const safeError = error instanceof Error ? error.name : "SETTLEMENT_FAILURE";
    // The source production lock must not create settlement side effects. Real
    // settlement failures, by contrast, retain durable retry/reconciliation evidence.
    if ((error as { code?: string })?.code !== "CONSOLIDATED_VALIDATION_NOT_APPROVED") await repository.recordReconciliationRequired({ marketplaceStoreOrderReference: input.marketplaceStoreOrderReference, operationId: input.operationId, safeError });
    throw error;
  }
}
