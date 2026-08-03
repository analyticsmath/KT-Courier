import { vi } from "vitest";

const repository = () => ({
  aggregate: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  groupBy: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  upsert: vi.fn(),
});

/** Complete Phase 17 transaction surface for isolated service orchestration tests. */
export function createDriverEarningTransactionMock() {
  return {
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    adminActivityLog: repository(),
    commissionAccrual: repository(),
    commissionAllocation: repository(),
    driverEarning: repository(),
    driverEarningCommissionCharge: repository(),
    driverEarningReconciliationCase: repository(),
    driverEarningStatusHistory: repository(),
    driverProfile: repository(),
    ledgerAccount: repository(),
    ledgerEntry: repository(),
    ledgerJournal: repository(),
    orderAssignment: repository(),
    payment: repository(),
    paymentRefund: repository(),
    proofOfDelivery: repository(),
    refundFundingAllocation: repository(),
    refundReconciliationCase: repository(),
    refundStatusHistory: repository(),
    user: repository(),
    wallet: repository(),
  };
}
