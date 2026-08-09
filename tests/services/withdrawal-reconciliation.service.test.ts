import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    withdrawalReconciliationCase: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
  recordAdminActivity: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/services/admin-activity.service", () => ({ recordAdminActivity: mocks.recordAdminActivity }));

import { listWithdrawalReconciliation, getWithdrawalReconciliation } from "@/lib/services/withdrawal-query.service";
import { executeUnifiedRecoveryCommand } from "@/lib/reconciliation/service";

describe("withdrawal reconciliation service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("covers idempotent unknown and stale payout cases", async () => {
    const mockCase = {
      publicReference: "WRC-100",
      reason: "UNKNOWN_PAYOUT_OUTCOME",
      status: "OPEN",
      priority: "HIGH",
      safeSummary: "Outcome unknown",
      observationCount: 1,
      openedAt: new Date("2026-01-01T00:00:00Z"),
      lastObservedAt: new Date("2026-01-01T00:00:00Z"),
      resolvedAt: null,
      resolutionCode: null,
      withdrawal: { publicReference: "WD-100", amount: new Prisma.Decimal(200) },
      payoutAttempt: { publicReference: "WPA-100" },
    };

    mocks.prisma.$transaction.mockResolvedValue([1, [mockCase]]);

    const list = await listWithdrawalReconciliation({ page: 1, pageSize: 10 });
    expect(list.data).toHaveLength(1);
    expect(list.data[0].publicReference).toBe("WRC-100");
    expect(list.data[0].amount).toBe("200.00");
  });

  it("retrieves single reconciliation case detail", async () => {
    const mockCaseDetail = {
      publicReference: "WRC-100",
      reason: "UNKNOWN_PAYOUT_OUTCOME",
      status: "OPEN",
      priority: "HIGH",
      safeSummary: "Outcome unknown",
      safeEvidence: null,
      observationCount: 1,
      openedAt: new Date("2026-01-01T00:00:00Z"),
      lastObservedAt: new Date("2026-01-01T00:00:00Z"),
      resolvedAt: null,
      resolutionCode: null,
      withdrawal: { publicReference: "WD-100", amount: new Prisma.Decimal(200) },
      payoutAttempt: { publicReference: "WPA-100", status: "UNKNOWN" },
    };

    mocks.prisma.withdrawalReconciliationCase.findUnique.mockResolvedValue(mockCaseDetail);

    const detail = await getWithdrawalReconciliation("WRC-100");
    expect(detail?.publicReference).toBe("WRC-100");
    expect(detail?.attempt?.status).toBe("UNKNOWN");
  });

  it("refuses recovery execution without permission", async () => {
    await expect(
      executeUnifiedRecoveryCommand("admin-1", new Set(), {
        domain: "withdrawals",
        reference: "WRC-100",
        actionKey: "RETRY",
        actorUserId: "admin-1",
        operationId: "op-rec-1",
        reasonCode: "RECONCILED",
      })
    ).rejects.toThrow("Unauthorized to execute recovery action");
  });
});
