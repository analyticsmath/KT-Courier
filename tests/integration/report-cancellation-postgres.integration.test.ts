import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";

vi.mock("@/lib/reporting/report-generator", () => ({ generateReportData: vi.fn(async () => ({ headers: ["id"], rows: [{ id: "fixture" }] })) }));
vi.mock("@/lib/reporting/authorization", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/reporting/authorization")>();
  return { ...actual, authorizeReportDefinition: vi.fn(async () => {}) };
});
import { ReportJobService } from "@/lib/reporting/services";
import { expireReportArtifacts } from "@/lib/reporting/report-expiry-batch";
import { recoverExpiredReportClaims } from "@/lib/reporting/report-recovery-batch";

const marker = `report-race-${randomUUID()}`;
const jobIds: string[] = [];
let validated = false;
beforeAll(async () => {
  requireDisposableStoreSettlementDatabase();
  validated = true;
  await prisma.user.create({ data: { id: marker, email: `${marker}@example.test`, role: "CUSTOMER", status: "ACTIVE" } });
});
afterAll(async () => {
  if (!validated) return;
  await prisma.reportExportArtifact.deleteMany({ where: { jobId: { in: jobIds } } });
  await prisma.reportAuditEvent.deleteMany({ where: { entityReference: { startsWith: marker } } });
  await prisma.reportJob.deleteMany({ where: { id: { in: jobIds } } });
  await prisma.user.deleteMany({ where: { id: marker } });
  await prisma.$disconnect();
});

it("preserves cancellation and leaves no artifact when cancellation occurs during generation", async () => {
  const job = await prisma.reportJob.create({ data: { publicReference: marker, definitionKey: "customer-courier-orders", definitionVersion: 1, requesterUserId: marker, requesterRole: "CUSTOMER", ownerScope: { userId: marker }, permissionSnapshot: [], normalizedFilters: {}, filterHash: marker, requestHash: marker, status: "QUEUED", outputFormat: "JSON" } });
  jobIds.push(job.id);
  const remove = vi.fn(async () => {});
  const storage = { provider: "LOCAL_SECURE", createStorageKey: () => "disposable-report.json", store: vi.fn(async () => { await service.cancelJob(marker, marker); }), delete: remove };
  const service = new ReportJobService(storage as never);
  expect((await service.processJob(marker))?.status).toBe("CANCELLED");
  expect((await prisma.reportJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("CANCELLED");
  expect(await prisma.reportExportArtifact.count({ where: { jobId: job.id } })).toBe(0);
  expect(remove).toHaveBeenCalledOnce();
});

it("claims a queued report once across competing workers and records its completion audit", async () => {
  const reference = `${marker}-concurrent`;
  const job = await prisma.reportJob.create({ data: { publicReference: reference, definitionKey: "customer-courier-orders", definitionVersion: 1, requesterUserId: marker, requesterRole: "CUSTOMER", ownerScope: { userId: marker }, permissionSnapshot: [], normalizedFilters: {}, filterHash: reference, requestHash: reference, status: "QUEUED", outputFormat: "JSON" } });
  jobIds.push(job.id);
  const store = vi.fn(async () => {});
  const service = new ReportJobService({ provider: "LOCAL_SECURE", createStorageKey: () => "disposable-report.json", store, delete: vi.fn(async () => {}) } as never);
  await Promise.all([service.processJob(reference), service.processJob(reference)]);
  expect((await prisma.reportJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("COMPLETED");
  expect(await prisma.reportExportArtifact.count({ where: { jobId: job.id } })).toBe(1);
  expect(await prisma.reportAuditEvent.count({ where: { entityReference: reference, eventType: "REPORT_JOB_COMPLETED" } })).toBe(1);
  expect(store).toHaveBeenCalledOnce();
});

it("revokes an expired report and records one durable storage deletion receipt", async () => {
  const reference = `${marker}-expired`;
  const job = await prisma.reportJob.create({ data: { publicReference: reference, definitionKey: "customer-courier-orders", definitionVersion: 1, requesterUserId: marker, requesterRole: "CUSTOMER", ownerScope: { userId: marker }, permissionSnapshot: [], normalizedFilters: {}, filterHash: reference, requestHash: reference, status: "COMPLETED", outputFormat: "JSON" } });
  jobIds.push(job.id);
  const artifact = await prisma.reportExportArtifact.create({ data: { publicReference: `${reference}-artifact`, jobId: job.id, format: "JSON", storageProvider: "LOCAL_SECURE", storageKey: `${reference}-key`, contentType: "application/json", byteSize: 2, checksum: "test", expiresAt: new Date("2020-01-01") } });
  const remove = vi.fn(async () => true);
  const storage = { provider: "LOCAL_SECURE", delete: remove } as never;
  const result = await expireReportArtifacts({ limit: 10, storage });
  expect(result).toMatchObject({ deleted: 1, failed: 0 });
  expect((await prisma.reportJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("EXPIRED");
  expect((await prisma.reportExportArtifact.findUniqueOrThrow({ where: { id: artifact.id } })).storageDeletedAt).not.toBeNull();
  await expireReportArtifacts({ limit: 10, storage });
  expect(remove).toHaveBeenCalledOnce();
});

it("fences a stalled worker after recovery and lets a new attempt finish", async () => {
  const reference = `${marker}-restart`;
  const job = await prisma.reportJob.create({ data: { publicReference: reference, definitionKey: "customer-courier-orders", definitionVersion: 1, requesterUserId: marker, requesterRole: "CUSTOMER", ownerScope: { userId: marker }, permissionSnapshot: [], normalizedFilters: {}, filterHash: reference, requestHash: reference, status: "QUEUED", outputFormat: "JSON" } });
  jobIds.push(job.id);
  let release!: () => void;
  let started!: () => void;
  const paused = new Promise<void>((resolve) => { release = resolve; });
  const entered = new Promise<void>((resolve) => { started = resolve; });
  const oldRemove = vi.fn(async (key: string) => Boolean(key));
  const oldService = new ReportJobService({ provider: "LOCAL_SECURE", createStorageKey: (ref: string) => ref, store: async () => { started(); await paused; }, delete: oldRemove } as never);
  const oldRun = oldService.processJob(reference);
  await entered;
  await prisma.reportJob.update({ where: { id: job.id }, data: { claimExpiresAt: new Date("2020-01-01") } });
  expect((await recoverExpiredReportClaims()).recovered).toBe(1);
  const newService = new ReportJobService({ provider: "LOCAL_SECURE", createStorageKey: (ref: string) => ref, store: async () => {}, delete: vi.fn(async () => true) } as never);
  expect((await newService.retryJob(reference, marker, true))?.status).toBe("COMPLETED");
  release();
  await oldRun;
  expect(await prisma.reportExportArtifact.count({ where: { jobId: job.id } })).toBe(1);
  const artifact = await prisma.reportExportArtifact.findUniqueOrThrow({ where: { jobId: job.id } });
  expect(oldRemove).toHaveBeenCalledOnce();
  expect(oldRemove.mock.calls[0][0]).not.toBe(artifact.storageKey);
});

it("bounds repeated generation failures and leaves a permanent failure for review", async () => {
  const reference = `${marker}-failure`;
  const job = await prisma.reportJob.create({ data: { publicReference: reference, definitionKey: "customer-courier-orders", definitionVersion: 1, requesterUserId: marker, requesterRole: "CUSTOMER", ownerScope: { userId: marker }, permissionSnapshot: [], normalizedFilters: {}, filterHash: reference, requestHash: reference, status: "QUEUED", outputFormat: "JSON" } });
  jobIds.push(job.id);
  const service = new ReportJobService({ provider: "LOCAL_SECURE", createStorageKey: () => "disposable", store: async () => { throw new Error("disposable storage failure"); }, delete: async () => true } as never);
  for (let attempt = 1; attempt <= 3; attempt++) {
    await expect(service.processJob(reference)).rejects.toMatchObject({ code: "REPORT_GENERATION_FAILED" });
    const state = await prisma.reportJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(state.attemptCount).toBe(attempt);
    expect(state.status).toBe(attempt === 3 ? "FAILED_PERMANENT" : "FAILED_RETRYABLE");
    if (attempt < 3) await prisma.reportJob.update({ where: { id: job.id }, data: { nextAttemptAt: new Date("2020-01-01") } });
  }
});
