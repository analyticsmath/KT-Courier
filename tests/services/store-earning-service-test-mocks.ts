import { vi } from "vitest";

const delegate = () => ({ findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), createMany: vi.fn(), upsert: vi.fn() });

export function createStoreEarningTransactionMock() {
  return {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    user: delegate(),
    store: delegate(),
    wallet: delegate(),
    payment: delegate(),
    storeEarning: delegate(),
    storeEarningStatusHistory: delegate(),
    storeEarningCommissionCharge: delegate(),
    storeEarningReconciliationCase: delegate(),
    commissionAccrual: delegate(),
    commissionAllocation: delegate(),
    refundFundingAllocation: delegate(),
    paymentRefund: delegate(),
    ledgerAccount: delegate(),
    ledgerJournal: delegate(),
    ledgerEntry: delegate(),
    postLedgerJournalWithinTransaction: vi.fn(),
  };
}
