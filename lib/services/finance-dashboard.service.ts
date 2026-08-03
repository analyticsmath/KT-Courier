import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { summarizeStoreEarnings } from "./store-earning-summary.service";
import { summarizeDriverEarnings } from "./driver-earning-summary.service";

function stringAmount(value: Prisma.Decimal | null | undefined): string { return (value ?? new Prisma.Decimal(0)).toFixed(2); }

export async function getFinanceDashboard() {
  const storeEarnings = await summarizeStoreEarnings();
  const driverEarnings = await summarizeDriverEarnings();
  const [byStatus, held, paid, cases, platformWallet, platformCommission, beneficiaryPayable, commissionAccrued, commissionReversed, commissionCases, commissionByPlan] = await Promise.all([
    prisma.withdrawalRequest.groupBy({ by: ["status"], _sum: { amount: true }, _count: { _all: true } }),
    prisma.ledgerAccount.aggregate({ where: { purpose: "WITHDRAWAL_HELD", category: "LIABILITY", currency: "ZAR", status: "ACTIVE" }, _sum: { currentBalance: true } }),
    prisma.withdrawalRequest.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
    prisma.withdrawalReconciliationCase.count({ where: { status: { in: ["OPEN", "MONITORING"] } } }),
    prisma.wallet.findUnique({ where: { ownerType_ownerId_currency: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" } }, select: { id: true } }),
    prisma.commissionAllocation.aggregate({ where: { allocationType: "PLATFORM_COMMISSION_REVENUE", status: "ACCRUED", currency: "ZAR" }, _sum: { amount: true } }),
    prisma.commissionAllocation.aggregate({ where: { allocationType: "BENEFICIARY_COMMISSION_PAYABLE", status: "ACCRUED", currency: "ZAR" }, _sum: { amount: true } }),
    prisma.commissionAccrual.aggregate({ where: { status: { in: ["ACCRUED", "RECONCILIATION_REQUIRED"] }, currency: "ZAR" }, _sum: { totalAmount: true } }),
    prisma.commissionAccrual.aggregate({ where: { status: "REVERSED", currency: "ZAR" }, _sum: { totalAmount: true } }),
    prisma.commissionReconciliationCase.count({ where: { status: { in: ["OPEN", "MONITORING"] } } }),
    prisma.commissionAccrual.groupBy({ by: ["planId", "planVersionNumber"], where: { status: { in: ["ACCRUED", "RECONCILIATION_REQUIRED"] }, currency: "ZAR" }, _sum: { totalAmount: true }, orderBy: { _sum: { totalAmount: "desc" } }, take: 10 }),
  ]);
  const cash = platformWallet ? await prisma.ledgerAccount.findUnique({ where: { walletId_purpose_currency: { walletId: platformWallet.id, purpose: "CASH_CLEARING", currency: "ZAR" }, }, select: { currentBalance: true } }) : null;
  const status = Object.fromEntries(byStatus.map((item) => [item.status, Object.freeze({ count: item._count._all, amount: stringAmount(item._sum.amount) })]));
  const oldestPending = await prisma.withdrawalRequest.findMany({ where: { status: { in: ["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING", "RECONCILIATION_REQUIRED"] } }, select: { id: true, publicReference: true, ownerType: true, amount: true, status: true, createdAt: true, payoutDestination: { select: { maskedLabel: true } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 10 });
  const recentCompleted = await prisma.withdrawalRequest.findMany({ where: { status: "PAID" }, select: { id: true, publicReference: true, amount: true, completedAt: true, payoutDestination: { select: { maskedLabel: true } } }, orderBy: [{ completedAt: "desc" }, { id: "desc" }], take: 10 });
  const [commissionPlans, oldestUnreconciled] = await Promise.all([
    prisma.commissionPlan.findMany({ where: { id: { in: commissionByPlan.map((row) => row.planId) } }, select: { id: true, publicReference: true } }),
    prisma.commissionAccrual.findMany({ where: { OR: [{ status: "RECONCILIATION_REQUIRED" }, { reconciliationCases: { some: { status: { in: ["OPEN", "MONITORING"] } } } }] }, select: { publicReference: true, totalAmount: true, createdAt: true, plan: { select: { publicReference: true } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 10 }),
  ]);
  const periodStart = new Date(); periodStart.setUTCDate(1); periodStart.setUTCHours(0, 0, 0, 0);
  const [refundByStatus, walletLiability, refundHeldLiability, walletRefunds, externalRefunds, refundedByPeriod, refundCases, commissionClawbacks, oldestPendingRefunds, refundablePayments] = await Promise.all([
    prisma.paymentRefund.groupBy({ by: ["status"], _sum: { amount: true }, _count: { _all: true } }),
    prisma.ledgerAccount.aggregate({ where: { purpose: "CUSTOMER_WALLET_AVAILABLE", category: "LIABILITY", currency: "ZAR", status: "ACTIVE" }, _sum: { currentBalance: true } }),
    prisma.ledgerAccount.aggregate({ where: { purpose: "CUSTOMER_REFUND_HELD", category: "LIABILITY", currency: "ZAR", status: "ACTIVE" }, _sum: { currentBalance: true } }),
    prisma.paymentRefund.aggregate({ where: { status: "SUCCEEDED", method: "CUSTOMER_WALLET" }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.paymentRefund.aggregate({ where: { status: "SUCCEEDED", method: "ORIGINAL_PAYMENT_METHOD" }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.paymentRefund.aggregate({ where: { status: "SUCCEEDED", completedAt: { gte: periodStart } }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.refundReconciliationCase.count({ where: { status: { in: ["OPEN", "MONITORING"] } } }),
    prisma.refundFundingAllocation.aggregate({ where: { sourceType: { in: ["PLATFORM_COMMISSION_REVENUE", "BENEFICIARY_COMMISSION_PAYABLE"] }, refund: { status: { notIn: ["REJECTED", "CANCELLED"] } } }, _sum: { amount: true } }),
    prisma.paymentRefund.findMany({ where: { status: { in: ["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING", "RECONCILIATION_REQUIRED"] } }, select: { id: true, publicReference: true, amount: true, method: true, status: true, createdAt: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 10 }),
    prisma.payment.findMany({ where: { status: "SUCCEEDED", currency: "ZAR" }, select: { amount: true, totalRefundedAmount: true, totalRefundReservedAmount: true } }),
  ]);
  const refundStatus = Object.fromEntries(refundByStatus.map((item) => [item.status, Object.freeze({ count: item._count._all, amount: stringAmount(item._sum.amount) })]));
  const remainingRefundableLiabilities = refundablePayments.reduce((total, payment) => {
    const remaining = payment.amount.sub(payment.totalRefundedAmount).sub(payment.totalRefundReservedAmount);
    return total.add(remaining.isNegative() ? new Prisma.Decimal(0) : remaining);
  }, new Prisma.Decimal(0));
  const planReferences = new Map(commissionPlans.map((plan) => [plan.id, plan.publicReference]));
  return Object.freeze({
    currency: "ZAR" as const,
    status,
    totalHeld: stringAmount(held._sum.currentBalance),
    totalPaid: stringAmount(paid._sum.amount),
    reconciliationCount: cases,
    cashClearingBalance: stringAmount(cash?.currentBalance),
    oldestPending: Object.freeze(oldestPending.map((row) => Object.freeze({ id: row.id, publicReference: row.publicReference, ownerType: row.ownerType, amount: row.amount.toFixed(2), status: row.status, requestedAt: row.createdAt.toISOString(), destinationLabel: row.payoutDestination.maskedLabel }))),
    recentCompleted: Object.freeze(recentCompleted.map((row) => Object.freeze({ id: row.id, publicReference: row.publicReference, amount: row.amount.toFixed(2), completedAt: row.completedAt?.toISOString() ?? null, destinationLabel: row.payoutDestination.maskedLabel }))),
    commissions: Object.freeze({
      accruedPlatformRevenue: stringAmount(platformCommission._sum.amount),
      beneficiaryPayable: stringAmount(beneficiaryPayable._sum.amount),
      accrued: stringAmount(commissionAccrued._sum.totalAmount),
      reversed: stringAmount(commissionReversed._sum.totalAmount),
      openReconciliationCases: commissionCases,
      byPlanVersion: Object.freeze(commissionByPlan.map((row) => Object.freeze({ planReference: planReferences.get(row.planId) ?? "UNKNOWN", versionNumber: row.planVersionNumber, amount: stringAmount(row._sum.totalAmount) }))),
      oldestUnreconciled: Object.freeze(oldestUnreconciled.map((row) => Object.freeze({ publicReference: row.publicReference, amount: row.totalAmount.toFixed(2), planReference: row.plan.publicReference, accruedAt: row.createdAt.toISOString() }))),
    }),
    refunds: Object.freeze({
      walletLiabilities: stringAmount(walletLiability._sum.currentBalance),
      refundHeldLiabilities: stringAmount(refundHeldLiability._sum.currentBalance),
      status: refundStatus,
      requested: refundStatus.REQUESTED ?? Object.freeze({ count: 0, amount: "0.00" }),
      approved: refundStatus.APPROVED ?? Object.freeze({ count: 0, amount: "0.00" }),
      processing: refundStatus.PROCESSING ?? Object.freeze({ count: 0, amount: "0.00" }),
      successfulWallet: Object.freeze({ count: walletRefunds._count._all, amount: stringAmount(walletRefunds._sum.amount) }),
      successfulExternal: Object.freeze({ count: externalRefunds._count._all, amount: stringAmount(externalRefunds._sum.amount) }),
      refundedByPeriod: Object.freeze({ from: periodStart.toISOString(), count: refundedByPeriod._count._all, amount: stringAmount(refundedByPeriod._sum.amount) }),
      openReconciliationCases: refundCases,
      commissionClawbacks: stringAmount(commissionClawbacks._sum.amount),
      remainingRefundableLiabilities: remainingRefundableLiabilities.toFixed(2),
      oldestPending: Object.freeze(oldestPendingRefunds.map((row) => Object.freeze({ id: row.id, publicReference: row.publicReference, amount: row.amount.toFixed(2), method: row.method, status: row.status, requestedAt: row.createdAt.toISOString() }))),
    }),
    storeEarnings,
    driverEarnings,
  });
}
