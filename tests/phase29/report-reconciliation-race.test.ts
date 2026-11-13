import { expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ status: "RUNNING", casesChanged: false }));
vi.mock("@/lib/db", () => {
  const client = {
    reportJob: {
      findUnique: vi.fn(async () => { state.status = "COMPLETED"; return { id: "job", status: "RUNNING" }; }),
      updateMany: vi.fn(async () => ({ count: state.status === "RUNNING" ? 1 : 0 })),
      update: vi.fn(async () => { state.status = "CANCELLED"; }),
    },
    reportReconciliationCase: { updateMany: vi.fn(async () => { state.casesChanged = true; return { count: 1 }; }) },
    reportAuditEvent: { create: vi.fn(async () => ({})) },
    $transaction: vi.fn(async (fn: unknown) => typeof fn === "function" ? fn(client) : Promise.all(fn as Promise<unknown>[])),
  };
  return { db: client };
});

it("fences a cancelled worker and converges only stuck-job cases with an audit", async () => {
  vi.mocked(db.reportJob.findUnique).mockResolvedValueOnce({ id: "job", status: "RUNNING", publicReference: "REP-test" } as never);
  vi.mocked(db.reportJob.updateMany).mockResolvedValueOnce({ count: 1 } as never);
  await new ReportReconciliationService({} as never).cancelStuckJob("job", "admin");
  expect(db.reportJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "CANCELLED", claimToken: null, claimExpiresAt: null }) }));
  expect(db.reportReconciliationCase.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ reason: "REPORT_JOB_STUCK_RUNNING" }) }));
  expect(db.reportAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorUserId: "admin", entityReference: "REP-test" }) }));
});
import { ReportReconciliationService } from "@/lib/reporting/reconciliation";
import { ReportJobService } from "@/lib/reporting/services";
import { db } from "@/lib/db";

it("does not cancel a report that completes during reconciliation", async () => {
  state.casesChanged = false;
  await expect(new ReportReconciliationService({} as never).cancelStuckJob("job", "admin")).rejects.toThrow();
  expect(state.status).toBe("COMPLETED");
  expect(state.casesChanged).toBe(false);
});

it("does not mark a retry as reconciled when processing did not complete", async () => {
  state.casesChanged = false;
  vi.mocked(db.reportJob.findUnique).mockResolvedValueOnce({ id: "job", status: "FAILED_RETRYABLE", publicReference: "REP-test", requesterUserId: "owner" } as never);
  vi.spyOn(ReportJobService.prototype, "retryJob").mockResolvedValueOnce({ status: "CANCELLED" } as never);
  const service = new ReportReconciliationService({} as never);
  await expect(service.retryGeneration("job")).rejects.toThrow();
  expect(state.casesChanged).toBe(false);
});
