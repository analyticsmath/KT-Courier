import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";

vi.mock("@/lib/reporting/report-generator", () => ({ generateReportData: vi.fn(async () => ({ headers: ["id"], rows: [{ id: "fixture" }] })) }));
import { ReportJobService } from "@/lib/reporting/services";

const marker = `report-race-${randomUUID()}`;
let jobId = "";
let validated = false;
beforeAll(async () => { requireDisposableStoreSettlementDatabase(); validated = true; });
afterAll(async () => {
  if (!validated) return;
  await prisma.reportExportArtifact.deleteMany({ where: { jobId } });
  await prisma.reportAuditEvent.deleteMany({ where: { entityReference: marker } });
  if (jobId) await prisma.reportJob.delete({ where: { id: jobId } });
  await prisma.$disconnect();
});

it("preserves cancellation and leaves no artifact when cancellation occurs during generation", async () => {
  const job = await prisma.reportJob.create({ data: { publicReference: marker, definitionKey: "customer-courier-orders", definitionVersion: 1, requesterUserId: "disposable-owner", requesterRole: "CUSTOMER", ownerScope: {}, permissionSnapshot: [], normalizedFilters: {}, filterHash: marker, requestHash: marker, status: "QUEUED", outputFormat: "JSON" } });
  jobId = job.id;
  const remove = vi.fn(async () => {});
  const storage = { provider: "LOCAL_SECURE", createStorageKey: () => "disposable-report.json", store: vi.fn(async () => { await service.cancelJob(marker, "disposable-owner"); }), delete: remove };
  const service = new ReportJobService(storage as never);
  expect((await service.processJob(marker))?.status).toBe("CANCELLED");
  expect((await prisma.reportJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("CANCELLED");
  expect(await prisma.reportExportArtifact.count({ where: { jobId: job.id } })).toBe(0);
  expect(remove).toHaveBeenCalledOnce();
});
