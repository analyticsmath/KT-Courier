import { Prisma } from "@prisma/client";
import { RefundError } from "./errors";
import type { CommissionAdjustmentDelta } from "./refund-commission-adjustment";
import type { RefundFundingSourceCode } from "./types";

export type RefundFundingPlanItem = Readonly<{
  publicReference: string;
  sourceType: RefundFundingSourceCode;
  ledgerAccountId: string;
  commissionAccrualId: string | null;
  commissionAllocationId: string | null;
  commissionAllocationReference: string | null;
  storeEarningId: string | null;
  driverEarningId: string | null;
  amount: string;
}>;

export function buildRefundFundingPlan(input: Readonly<{
  refundAmount: string;
  customerFundsHeldAccountId: string;
  adjustmentDeltas: readonly CommissionAdjustmentDelta[];
  createReference: () => string;
}>): readonly RefundFundingPlanItem[] {
  const refund = new Prisma.Decimal(input.refundAmount);
  const commissionTotal = input.adjustmentDeltas.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
  const residual = refund.sub(commissionTotal);
  if (residual.isNegative()) {
    throw new RefundError("REFUND_FUNDING_UNAVAILABLE", "Commission funding exceeds the refund amount.");
  }
  const plan: RefundFundingPlanItem[] = input.adjustmentDeltas.map((delta) => Object.freeze({
    publicReference: input.createReference(),
    sourceType: delta.sourceType,
    ledgerAccountId: delta.ledgerAccountId,
    commissionAccrualId: delta.commissionAccrualId,
    commissionAllocationId: delta.commissionAllocationId,
    commissionAllocationReference: delta.commissionAllocationReference,
    storeEarningId: null,
    driverEarningId: null,
    amount: delta.amount,
  }));
  if (!residual.isZero()) {
    plan.push(Object.freeze({
      publicReference: input.createReference(),
      sourceType: "CUSTOMER_FUNDS_HELD",
      ledgerAccountId: input.customerFundsHeldAccountId,
      commissionAccrualId: null,
      commissionAllocationId: null,
      commissionAllocationReference: null,
      storeEarningId: null,
      driverEarningId: null,
      amount: residual.toFixed(2),
    }));
  }
  const planned = plan.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
  if (!planned.equals(refund) || plan.length === 0) {
    throw new RefundError("REFUND_FUNDING_UNAVAILABLE", "Refund funding plan does not equal the requested amount.");
  }
  return Object.freeze(plan);
}
