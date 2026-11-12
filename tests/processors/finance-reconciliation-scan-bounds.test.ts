import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  paymentAttempt: { findMany: vi.fn(async () => []) },
  withdrawalPayoutAttempt: { findMany: vi.fn(async () => []) },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
import { PROCESSOR_HANDLERS } from "@/lib/processors/processor-service";

describe("bounded payment and withdrawal reconciliation processor scans", () => {
  it.each(["scan-payment-reconciliation", "scan-withdrawal-reconciliation"] as const)(
    "%s respects batch size in stable chronological order",
    async (name) => {
      vi.clearAllMocks();
      const outcome = await PROCESSOR_HANDLERS[name]({
        mode: "DRY_RUN",
        batchSize: 7,
        operationId: "audit-bounded-financial-scan",
      });
      expect(outcome.itemsExamined).toBe(0);
      expect(outcome.itemsCompleted).toBe(0);
      const findMany = name === "scan-payment-reconciliation"
        ? db.paymentAttempt.findMany
        : db.withdrawalPayoutAttempt.findMany;
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
        take: 7,
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      }));
    },
  );
});
