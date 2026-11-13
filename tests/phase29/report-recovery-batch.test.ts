import { expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ findMany: vi.fn(), updateMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { reportJob: mock } }));
import { recoverExpiredReportClaims } from "@/lib/reporting/report-recovery-batch";

it("requeues only the observed expired claim and fences its former owner", async () => {
  const now = new Date("2026-11-13T00:00:00Z");
  mock.findMany.mockResolvedValueOnce([{ id: "job", claimToken: "old", attemptCount: 1 }]);
  mock.updateMany.mockResolvedValueOnce({ count: 1 });
  expect(await recoverExpiredReportClaims({ now, limit: 10 })).toEqual({ examined: 1, recovered: 1 });
  expect(mock.updateMany).toHaveBeenCalledWith({ where: { id: "job", status: "RUNNING", claimToken: "old", claimExpiresAt: { lte: now } }, data: { status: "FAILED_RETRYABLE", claimToken: null, claimExpiresAt: null, failedAt: now, nextAttemptAt: new Date(now.getTime() + 60_000), errorMessage: "REPORT_WORKER_LEASE_EXPIRED" } });
});
