import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ status: "QUEUED", artifacts: 0 }));
const job = { id: "report-id", publicReference: "REP-test", status: "QUEUED", definitionKey: "customer-courier-orders", requesterUserId: "owner", requesterRole: "CUSTOMER", ownerScope: {}, normalizedFilters: {}, rowCountLimit: 100, outputFormat: "JSON", expiresAt: new Date("2030-01-01") };
vi.mock("@/lib/db", () => {
  const client = {
    reportJob: {
      findUnique: vi.fn(async () => ({ ...job, status: state.status })),
      updateMany: vi.fn(async ({ where, data }: { where: { status: string | { in: string[] } }; data: { status: string } }) => {
        const allowed = typeof where.status === "string" ? [where.status] : where.status.in;
        if (!allowed.includes(state.status)) return { count: 0 };
        state.status = data.status; return { count: 1 };
      }),
      update: vi.fn(async ({ data }: { data: { status: string } }) => { state.status = data.status; return { ...job, status: state.status }; }),
    },
    reportExportArtifact: { create: vi.fn(async () => { state.artifacts++; return {}; }) },
    reportAuditEvent: { create: vi.fn(async () => ({})) },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(client)),
  };
  return { db: client };
});
vi.mock("@/lib/reporting/report-generator", () => ({ generateReportData: vi.fn(async () => ({ headers: ["id"], rows: [{ id: "test" }] })) }));
vi.mock("@/lib/observability/telemetry", () => ({ recordTelemetry: vi.fn(async () => {}) }));
import { ReportJobService } from "@/lib/reporting/services";

beforeEach(() => { state.status = "QUEUED"; state.artifacts = 0; });

it("does not publish a report cancelled while its file is being generated", async () => {
  const remove = vi.fn(async () => {});
  const storage = { provider: "LOCAL", createStorageKey: () => "disposable-report.json", store: vi.fn(async () => { state.status = "CANCELLED"; }), delete: remove };
  const service = new ReportJobService(storage as never);
  const result = await service.processJob(job.publicReference);
  expect(result?.status).toBe("CANCELLED");
  expect(state.artifacts).toBe(0);
  expect(remove).toHaveBeenCalledOnce();
});

it("publishes the artifact and completes an uncancelled report", async () => {
  const remove = vi.fn(async () => {});
  const storage = { provider: "LOCAL", createStorageKey: () => "disposable-report.json", store: vi.fn(async () => {}), delete: remove };
  const result = await new ReportJobService(storage as never).processJob(job.publicReference);
  expect(result?.status).toBe("COMPLETED");
  expect(state.artifacts).toBe(1);
  expect(remove).not.toHaveBeenCalled();
});

it("does not cancel a report that completed before the cancellation write", async () => {
  state.status = "COMPLETED";
  await expect(new ReportJobService({} as never).cancelJob(job.publicReference, "owner")).rejects.toMatchObject({ code: "CANNOT_CANCEL_REPORT_JOB" });
});
