import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { StoreEarningError } from "@/lib/store-earnings/errors";
import { formatStoreEarningMoney } from "@/lib/store-earnings/store-earning-money";

const zero = () => new Prisma.Decimal(0);

export async function getStoreEarningSummaryForOwner(userId: string) {
  const [user, stores] = await Promise.all([prisma.user.findUnique({ where: { id: userId }, select: { role: true, status: true } }), prisma.store.findMany({ where: { ownerUserId: userId }, select: { id: true, status: true }, take: 2 })]);
  if (!user || user.role !== "STORE" || user.status !== "ACTIVE" || stores.length !== 1 || stores[0]!.status !== "ACTIVE") throw new StoreEarningError("STORE_EARNING_FORBIDDEN", "An active uniquely-owned store is required to read earning totals.");
  return summarizeStoreEarnings(stores[0]!.id);
}

export async function summarizeStoreEarnings(storeId?: string) {
  const where: Prisma.StoreEarningWhereInput = { ...(storeId ? { storeId } : {}) };
  const periodStart = new Date(); periodStart.setUTCDate(1); periodStart.setUTCHours(0, 0, 0, 0);
  const [rows, payable, reconciliationCount, oldestUnreleasedRows, recentReleases, totalsByStore] = await Promise.all([
    prisma.storeEarning.findMany({ where, select: { amount: true, refundReservedAmount: true, refundedAmount: true, releasedAmount: true, reversedAmount: true, status: true, releaseEligibleAt: true } }),
    prisma.ledgerAccount.aggregate({ where: { purpose: "STORE_EARNINGS_PAYABLE", category: "LIABILITY", currency: "ZAR", status: "ACTIVE", ...(storeId ? { wallet: { ownerType: "STORE", ownerId: storeId } } : {}) }, _sum: { currentBalance: true } }),
    prisma.storeEarningReconciliationCase.count({ where: { status: { in: ["OPEN", "MONITORING"] }, ...(storeId ? { storeEarning: { storeId } } : {}) } }),
    prisma.storeEarning.findMany({ where: { ...where, status: { in: ["ACCRUED", "RECONCILIATION_REQUIRED"] } }, select: { publicReference: true, amount: true, createdAt: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 10 }),
    prisma.storeEarning.findMany({ where: { ...where, status: "RELEASED" }, select: { publicReference: true, releasedAmount: true, releasedAt: true }, orderBy: [{ releasedAt: "desc" }, { id: "desc" }], take: 10 }),
    prisma.storeEarning.groupBy({ by: ["storeId"], where: { ...where, createdAt: { gte: periodStart } }, _sum: { amount: true }, orderBy: { storeId: "asc" } }),
  ]);
  const stores = await prisma.store.findMany({ where: { id: { in: totalsByStore.map((row) => row.storeId) } }, select: { id: true, slug: true } });
  const storeReferences = new Map(stores.map((store) => [store.id, store.slug]));
  const now = new Date();
  const total = (field: "amount" | "refundReservedAmount" | "refundedAmount" | "releasedAmount" | "reversedAmount") => rows.reduce((sum, row) => sum.add(row[field]), zero());
  const releaseEligible = rows.filter((row) => row.status === "ACCRUED" && row.releaseEligibleAt && row.releaseEligibleAt.getTime() <= now.getTime() && row.refundReservedAmount.isZero()).reduce((sum, row) => sum.add(row.amount.sub(row.refundedAmount).sub(row.releasedAmount).sub(row.reversedAmount)), zero());
  return Object.freeze({ currency: "ZAR" as const, totalAccrued: formatStoreEarningMoney(total("amount")), payableBalance: formatStoreEarningMoney(payable._sum.currentBalance ?? zero()), refundReserved: formatStoreEarningMoney(total("refundReservedAmount")), refunded: formatStoreEarningMoney(total("refundedAmount")), releaseEligible: formatStoreEarningMoney(releaseEligible), releasedToWithdrawable: formatStoreEarningMoney(total("releasedAmount")), reversed: formatStoreEarningMoney(total("reversedAmount")), reconciliationCount, oldestUnreleased: oldestUnreleasedRows[0] ? Object.freeze({ publicReference: oldestUnreleasedRows[0].publicReference, amount: formatStoreEarningMoney(oldestUnreleasedRows[0].amount), accruedAt: oldestUnreleasedRows[0].createdAt.toISOString() }) : null, oldestUnreleasedEarnings: Object.freeze(oldestUnreleasedRows.map((row) => Object.freeze({ publicReference: row.publicReference, amount: formatStoreEarningMoney(row.amount), accruedAt: row.createdAt.toISOString() }))), recentReleases: Object.freeze(recentReleases.map((row) => Object.freeze({ publicReference: row.publicReference, amount: formatStoreEarningMoney(row.releasedAmount), releasedAt: row.releasedAt?.toISOString() ?? null }))), storeTotalsByPeriod: Object.freeze({ from: periodStart.toISOString(), stores: Object.freeze(totalsByStore.map((row) => Object.freeze({ storePublicReference: storeReferences.get(row.storeId) ?? "UNKNOWN", amount: formatStoreEarningMoney(row._sum.amount ?? zero()) }))) }) });
}
