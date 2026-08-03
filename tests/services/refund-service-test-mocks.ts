import { vi } from "vitest";

/**
 * Complete Phase 15 transaction surface used by focused service tests. Values
 * are supplied per scenario; every financial write and lock is observable.
 */
export function createRefundTransactionMock() {
  const delegate = () => ({ findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn(), create: vi.fn(), createMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() });
  return {
    $queryRaw: vi.fn(),
    payment: delegate(), paymentRefund: delegate(), refundExecutionAttempt: delegate(),
    refundFundingAllocation: delegate(), refundStatusHistory: delegate(), refundReconciliationCase: delegate(),
    commissionAccrual: delegate(), commissionAllocation: delegate(), ledgerAccount: delegate(),
    ledgerJournal: delegate(), ledgerEntry: delegate(), wallet: delegate(), user: delegate(),
    operationLog: delegate(), auditLog: delegate(),
  };
}

export function createRefundPrismaMock() {
  const tx = createRefundTransactionMock();
  const commit = vi.fn();
  const rollback = vi.fn();
  const transaction = vi.fn(async (work: unknown) => {
    try {
      const value = typeof work === "function" ? await (work as (client: typeof tx) => unknown)(tx) : await Promise.all(work as Promise<unknown>[]);
      commit();
      return value;
    } catch (error) {
      rollback();
      throw error;
    }
  });
  return { tx, commit, rollback, prisma: { ...createRefundTransactionMock(), $transaction: transaction } };
}
