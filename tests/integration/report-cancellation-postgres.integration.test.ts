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
  await prisma.reportAuditEvent.deleteMany({ where: { entityReference: { in: [marker, `${marker}-concurrent`] } } });
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
