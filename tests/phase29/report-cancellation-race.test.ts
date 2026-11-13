import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ status: "QUEUED", artifacts: 0, claimToken: null as string | null }));
const job = { id: "report-id", publicReference: "REP-test", status: "QUEUED", definitionKey: "customer-courier-orders", requesterUserId: "owner", requesterRole: "CUSTOMER", ownerScope: { userId: "owner" }, normalizedFilters: {}, rowCountLimit: 100, outputFormat: "JSON", expiresAt: new Date("2030-01-01") };
vi.mock("@/lib/db", () => {
  const client = {
    user: { findUnique: vi.fn(async () => ({ role: "CUSTOMER", status: "ACTIVE" })) },
    reportJob: {
      findUnique: vi.fn(async () => ({ ...job, status: state.status })),
      updateMany: vi.fn(async ({ where, data }: { where: { status: string | { in: string[] }; claimToken?: string }; data: { status: string; claimToken?: string | null } }) => {
        const allowed = typeof where.status === "string" ? [where.status] : where.status.in;
        if (!allowed.includes(state.status) || (where.claimToken !== undefined && where.claimToken !== state.claimToken)) return { count: 0 };
        state.status = data.status; if (data.claimToken !== undefined) state.claimToken = data.claimToken; return { count: 1 };
      }),
      update: vi.fn(async ({ data }: { data: { status: string } }) => { state.status = data.status; return { ...job, status: state.status }; }),
    },
    reportExportArtifact: { create: vi.fn(async () => { state.artifacts++; return {}; }) },
    reportAuditEvent: { create: vi.fn(async () => ({})) },
    reportReconciliationCase: { create: vi.fn(async () => ({})) },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const before = { ...state };
      try { return await fn(client); } catch (error) { Object.assign(state, before); throw error; }
    }),
  };
  return { db: client };
});
vi.mock("@/lib/reporting/report-generator", () => ({ generateReportData: vi.fn(async () => ({ headers: ["id"], rows: [{ id: "test" }] })) }));
vi.mock("@/lib/reporting/authorization", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/reporting/authorization")>();
  return { ...actual, authorizeReportDefinition: vi.fn(async () => {}) };
});
vi.mock("@/lib/observability/telemetry", () => ({ recordTelemetry: vi.fn(async () => {}) }));
import { ReportJobService } from "@/lib/reporting/services";
import { db } from "@/lib/db";

beforeEach(() => { state.status = "QUEUED"; state.artifacts = 0; state.claimToken = null; });

it("does not publish a report cancelled while its file is being generated", async () => {
  const remove = vi.fn(async () => {});
  const storage = { provider: "LOCAL", createStorageKey: () => "disposable-report.json", store: vi.fn(async () => { state.status = "CANCELLED"; }), delete: remove };
  const service = new ReportJobService(storage as never);
  const result = await service.processJob(job.publicReference);
  expect(result?.status).toBe("CANCELLED");
  expect(state.artifacts).toBe(0);
  expect(remove).toHaveBeenCalledOnce();
});

it("fences an old attempt when a restarted worker owns the running job", async () => {
  const storage = { provider: "LOCAL", createStorageKey: vi.fn(() => "old-attempt-key"), store: vi.fn(async () => { state.claimToken = "new-attempt"; }), delete: vi.fn(async () => {}) };
  await new ReportJobService(storage as never).processJob(job.publicReference);
  expect(state.artifacts).toBe(0);
  expect(state.status).toBe("RUNNING");
  expect(storage.delete).toHaveBeenCalledWith("old-attempt-key");
});

it("records an orphan cleanup case if an abandoned upload cannot be deleted", async () => {
  const storage = { provider: "LOCAL", createStorageKey: () => "old-attempt-key", store: vi.fn(async () => { state.claimToken = "new-attempt"; }), delete: vi.fn(async () => { throw new Error("storage unavailable"); }) };
  await expect(new ReportJobService(storage as never).processJob(job.publicReference)).rejects.toMatchObject({ code: "REPORT_GENERATION_FAILED" });
  expect(db.reportReconciliationCase.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ jobId: job.id, reason: "REPORT_STORAGE_FAILURE", safeEvidence: expect.objectContaining({ storageKey: "old-attempt-key" }) }) }));
});

it("publishes the artifact and completes an uncancelled report", async () => {
  const remove = vi.fn(async () => {});
  const storage = { provider: "LOCAL", createStorageKey: () => "disposable-report.json", store: vi.fn(async () => {}), delete: remove };
  const result = await new ReportJobService(storage as never).processJob(job.publicReference);
  expect(result?.status).toBe("COMPLETED");
  expect(state.artifacts).toBe(1);
  expect(remove).not.toHaveBeenCalled();
});

it("returns the committed report when completion telemetry fails", async () => {
  const { recordTelemetry } = await import("@/lib/observability/telemetry");
  vi.mocked(recordTelemetry).mockRejectedValueOnce(new Error("telemetry unavailable"));
  const storage = { provider: "LOCAL", createStorageKey: () => "disposable-report.json", store: vi.fn(async () => {}), delete: vi.fn(async () => {}) };
  const result = await new ReportJobService(storage as never).processJob(job.publicReference);
  expect(result?.status).toBe("COMPLETED");
  expect(state.artifacts).toBe(1);
  expect(storage.delete).not.toHaveBeenCalled();
});

it("does not commit an artifact when its completion audit cannot be written", async () => {
  vi.mocked(db.reportAuditEvent.create).mockRejectedValueOnce(new Error("audit unavailable"));
  const storage = { provider: "LOCAL", createStorageKey: () => "disposable-report.json", store: vi.fn(async () => {}), delete: vi.fn(async () => {}) };
  await expect(new ReportJobService(storage as never).processJob(job.publicReference)).rejects.toMatchObject({ code: "REPORT_GENERATION_FAILED" });
  expect(state.status).toBe("FAILED_RETRYABLE");
  expect(state.artifacts).toBe(0);
  expect(storage.delete).toHaveBeenCalledOnce();
});

it("does not generate an export after the requester's permission is revoked", async () => {
  const { authorizeReportDefinition } = await import("@/lib/reporting/authorization");
  vi.mocked(authorizeReportDefinition).mockRejectedValueOnce(new Error("permission revoked"));
  const storage = { provider: "LOCAL", createStorageKey: vi.fn(), store: vi.fn(), delete: vi.fn() };
  await expect(new ReportJobService(storage as never).processJob(job.publicReference)).rejects.toMatchObject({ code: "REPORT_GENERATION_FAILED" });
  expect(storage.store).not.toHaveBeenCalled();
  expect(state.artifacts).toBe(0);
});

it("marks the third failed generation attempt permanent", async () => {
  vi.mocked(db.reportJob.findUnique).mockResolvedValueOnce({ ...job, attemptCount: 2 } as never);
  const storage = { provider: "LOCAL", createStorageKey: () => "key", store: vi.fn(async () => { throw new Error("storage unavailable"); }), delete: vi.fn(async () => {}) };
  await expect(new ReportJobService(storage as never).processJob(job.publicReference)).rejects.toMatchObject({ code: "REPORT_GENERATION_FAILED" });
  expect(state.status).toBe("FAILED_PERMANENT");
});

it("refuses a report whose stored owner scope no longer matches", async () => {
  vi.mocked(db.reportJob.findUnique).mockResolvedValueOnce({ ...job, ownerScope: { userId: "other" } } as never);
  const storage = { provider: "LOCAL", createStorageKey: vi.fn(), store: vi.fn(), delete: vi.fn() };
  await expect(new ReportJobService(storage as never).processJob(job.publicReference)).rejects.toMatchObject({ code: "REPORT_GENERATION_FAILED" });
  expect(storage.store).not.toHaveBeenCalled();
});

it("does not cancel a report that completed before the cancellation write", async () => {
  state.status = "COMPLETED";
  await expect(new ReportJobService({} as never).cancelJob(job.publicReference, "owner")).rejects.toMatchObject({ code: "CANNOT_CANCEL_REPORT_JOB" });
});

it("rolls back cancellation if its required audit write fails", async () => {
  vi.mocked(db.reportAuditEvent.create).mockRejectedValueOnce(new Error("audit unavailable"));
  await expect(new ReportJobService({} as never).cancelJob(job.publicReference, "owner")).rejects.toThrow();
  expect(state.status).toBe("QUEUED");
});

it("does not restart a failed report after another actor cancels it", async () => {
  state.status = "FAILED_RETRYABLE";
  vi.mocked(db.reportJob.findUnique).mockImplementationOnce((async () => {
    state.status = "CANCELLED";
    return { ...job, status: "FAILED_RETRYABLE" } as never;
  }) as never);
  const service = new ReportJobService({} as never);
  await expect(service.retryJob(job.publicReference, "owner")).rejects.toMatchObject({ code: "REPORT_JOB_NOT_RETRYABLE" });
  expect(state.status).toBe("CANCELLED");
});

it("leaves a failed report unqueued when the retry audit fails", async () => {
  state.status = "FAILED_RETRYABLE";
  vi.mocked(db.reportAuditEvent.create).mockRejectedValueOnce(new Error("audit unavailable"));
  await expect(new ReportJobService({} as never).retryJob(job.publicReference, "owner")).rejects.toThrow("audit unavailable");
  expect(state.status).toBe("FAILED_RETRYABLE");
});

it("refuses to process a live report with ephemeral local storage", async () => {
  vi.stubEnv("NODE_ENV", "production");
  try {
    const service = new ReportJobService({ provider: "LOCAL_SECURE" } as never);
    await expect(service.processJob(job.publicReference)).rejects.toMatchObject({ code: "REPORT_DURABLE_STORAGE_REQUIRED" });
    expect(state.status).toBe("QUEUED");
  } finally { vi.unstubAllEnvs(); }
});
