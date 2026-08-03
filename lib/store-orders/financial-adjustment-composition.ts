/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 21 delegates are dynamic until consolidated generation. */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { reverseCommissionInTransaction } from "@/lib/services/commission-reversal.service";
import { adjustStoreEarningInTransaction } from "@/lib/services/store-earning-reversal.service";
import { createMarketplaceRefundRequest } from "@/lib/services/refund-request.service";
import type { StoreOrderFinancialAuthority } from "@/lib/store-orders/contracts";
import { StoreOrderError } from "@/lib/store-orders/errors";

const zero = () => new Prisma.Decimal(0);

function sum(rows: readonly any[], type: string): Prisma.Decimal {
  return rows.filter((row) => row.allocationType === type).reduce((total, row) => total.add(row.amount), zero());
}

export function splitFrozenCommissionAdjustmentCents(total: Prisma.Decimal, components: readonly Readonly<{ amount: Prisma.Decimal; publicReference: string }>[]) {
  const totalCents = BigInt(total.mul(100).toFixed(0));
  const denominator = components.reduce((value, component) => value.add(component.amount), zero());
  if (totalCents < BigInt(0) || denominator.lessThanOrEqualTo(0)) throw new StoreOrderError("STORE_ORDER_FINANCIAL_ALLOCATION_INVALID", "Frozen commission allocation evidence is invalid.");
  let assigned = BigInt(0);
  return components.slice().sort((left, right) => left.publicReference.localeCompare(right.publicReference)).map((component, index, list) => {
    const amount = index === list.length - 1 ? totalCents - assigned : (totalCents * BigInt(component.amount.mul(100).toFixed(0))) / BigInt(denominator.mul(100).toFixed(0));
    assigned += amount;
    return { ...component, amount: new Prisma.Decimal(amount.toString()).div(100) };
  });
}

/**
 * Concrete Phase 21 composition over Phase 14, Phase 16 and Phase 15. This
 * coordinator does not post journals or mutate balances: those writes remain
 * inside the imported canonical authorities.
 */
export class ExistingPhaseFinancialAdjustmentAuthority implements StoreOrderFinancialAuthority {
  async applyExactAdjustment(input: Readonly<{
    adjustmentReference: string;
    storeOrderReference: string;
    operationId: string;
    frozenEvidence: Record<string, unknown>;
  }>) {
    const evidence = await prisma.$transaction(async (tx) => {
      const database = tx as any;
      const adjustmentRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "MarketplaceStoreOrderAdjustment" WHERE "publicReference" = ${input.adjustmentReference} FOR UPDATE`);
      const orderRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "MarketplaceStoreOrder" WHERE "publicReference" = ${input.storeOrderReference} FOR UPDATE`);
      if (adjustmentRows.length !== 1 || orderRows.length !== 1) throw new StoreOrderError("STORE_ORDER_ADJUSTMENT_INVALID", "Canonical adjustment or store order was not found.");
      const adjustment = await database.marketplaceStoreOrderAdjustment.findUnique({
        where: { id: adjustmentRows[0].id },
        include: {
          allocations: true,
          storeOrder: {
            include: {
              marketplaceOrder: { select: { customerUserId: true, payment: { select: { publicReference: true } } } },
              settlementSnapshots: { orderBy: { createdAt: "asc" }, take: 1 },
            },
          },
        },
      });
      if (!adjustment || adjustment.storeOrder.publicReference !== input.storeOrderReference || !["APPROVED", "APPLYING"].includes(adjustment.status)) throw new StoreOrderError("STORE_ORDER_ADJUSTMENT_INVALID", "Only an approved canonical adjustment may be applied.");
      const snapshot = adjustment.storeOrder.settlementSnapshots[0];
      if (!snapshot || snapshot.status !== "COMPLETED" || snapshot.settlementVersion !== adjustment.sourceVersion || !snapshot.commissionAccrualReference || !snapshot.storeEarningReference) throw new StoreOrderError("STORE_ORDER_ORIGINAL_SETTLEMENT_PENDING", "The original Phase 20 settlement must complete before an adjustment can be composed.");
      const sellerBasis = sum(adjustment.allocations, "SELLER_BASIS");
      const commission = sum(adjustment.allocations, "COMMISSION");
      const storeEarning = sum(adjustment.allocations, "STORE_EARNING");
      const refund = new Prisma.Decimal(adjustment.refundAmount);
      if (sellerBasis.lessThan(0) || commission.lessThan(0) || storeEarning.lessThan(0) || !sellerBasis.sub(commission).equals(storeEarning) || !refund.equals(sellerBasis.add(new Prisma.Decimal(adjustment.deliveryFeeAmount)))) throw new StoreOrderError("STORE_ORDER_FINANCIAL_ALLOCATION_INVALID", "Frozen adjustment allocations do not reconcile to seller basis, commission, store earning and refund evidence.");
      const accrual = await tx.commissionAccrual.findUnique({ where: { publicReference: snapshot.commissionAccrualReference }, include: { allocations: { orderBy: { publicReference: "asc" } } } });
      const earning = await tx.storeEarning.findUnique({ where: { publicReference: snapshot.storeEarningReference } });
      if (!accrual || !earning || accrual.totalAmount.lessThan(commission) || earning.amount.lessThan(storeEarning)) throw new StoreOrderError("STORE_ORDER_FINANCIAL_EVIDENCE_INVALID", "Original Phase 14 or Phase 16 evidence is unavailable.");
      const previous = await database.marketplaceStoreOrderAdjustment.findMany({ where: { marketplaceStoreOrderId: adjustment.marketplaceStoreOrderId, id: { not: adjustment.id }, status: { in: ["APPLIED", "REFUND_PENDING", "COMPLETED"] } }, include: { allocations: true } });
      const priorCommission = previous.reduce((total: Prisma.Decimal, item: any) => total.add(sum(item.allocations, "COMMISSION")), zero());
      const priorStoreEarning = previous.reduce((total: Prisma.Decimal, item: any) => total.add(sum(item.allocations, "STORE_EARNING")), zero());
      if (priorCommission.add(commission).greaterThan(accrual.totalAmount) || priorStoreEarning.add(storeEarning).greaterThan(earning.amount)) throw new StoreOrderError("STORE_ORDER_FINANCIAL_LIMIT_EXCEEDED", "Cumulative adjustment exceeds frozen financial evidence.");
      const components = splitFrozenCommissionAdjustmentCents(commission, accrual.allocations.map((allocation) => ({ amount: allocation.amount, publicReference: allocation.publicReference })));
      const priorComponents = splitFrozenCommissionAdjustmentCents(priorCommission, accrual.allocations.map((allocation) => ({ amount: allocation.amount, publicReference: allocation.publicReference })));
      const priorByReference = new Map(priorComponents.map((component) => [component.publicReference, component.amount]));
      const commissionReversals: string[] = [];
      for (const component of components) {
        if (component.amount.isZero()) continue;
        const source = accrual.allocations.find((allocation) => allocation.publicReference === component.publicReference)!;
        const reversed = await reverseCommissionInTransaction(tx, { accrualPublicReference: accrual.publicReference, allocationPublicReference: source.publicReference, originalAmount: source.amount.toFixed(2), previouslyReversedAmount: (priorByReference.get(source.publicReference) ?? zero()).toFixed(2) }, { amount: component.amount.toFixed(2) }, { operationId: `${input.operationId}:commission:${source.publicReference}`, reasonCode: "MARKETPLACE_STORE_ADJUSTMENT" });
        commissionReversals.push(reversed.reversalLedgerJournalReference);
      }
      const earningReversal = storeEarning.isZero() ? null : await adjustStoreEarningInTransaction(tx, { publicReference: earning.publicReference, originalSellerBasis: earning.settlementBasisAmount.toFixed(2), originalCommission: earning.attributedCommissionAmount.toFixed(2), originalAmount: earning.amount.toFixed(2), previouslyAdjustedAmount: priorStoreEarning.toFixed(2) }, { sellerBasisAmount: sellerBasis.toFixed(2), commissionAmount: commission.toFixed(2), storeEarningAmount: storeEarning.toFixed(2) }, { operationId: `${input.operationId}:store-earning`, reasonCode: "MARKETPLACE_STORE_ADJUSTMENT" });
      return { paymentReference: adjustment.storeOrder.marketplaceOrder.payment.publicReference, customerUserId: adjustment.storeOrder.marketplaceOrder.customerUserId, refundAmount: refund.toFixed(2), commissionReversalReferences: Object.freeze(commissionReversals), storeEarningReversalReference: earningReversal?.reversalLedgerJournalReference };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    const refund = new Prisma.Decimal(evidence.refundAmount).isZero() ? null : await createMarketplaceRefundRequest({ paymentPublicReference: evidence.paymentReference, customerUserId: evidence.customerUserId, guestConfirmationVerified: !evidence.customerUserId, amount: evidence.refundAmount, method: "ORIGINAL_PAYMENT_METHOD", reasonCode: "SERVICE_NOT_PROVIDED", operationId: `${input.operationId}:refund` });
    return Object.freeze({ refundReference: refund?.publicReference, commissionReversalReferences: evidence.commissionReversalReferences, storeEarningReversalReference: evidence.storeEarningReversalReference, financialStatus: refund ? "REFUND_RESERVED" as const : "REFUND_COMPLETED" as const });
  }
}
