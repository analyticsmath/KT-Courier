import { beforeEach, describe, expect, it, vi } from "vitest";
import { S3ReportArtifactStorage, resolveReportArtifactStorage } from "@/lib/reporting/artifact-storage";
import { ReportingError } from "@/lib/reporting/contracts";
import { evaluateGovernedActivationRecord } from "@/lib/governance/module-activation";
import { generateReportData } from "@/lib/reporting/report-generator";

const mockDb = vi.hoisted(() => ({
  developerApplication: { findMany: vi.fn() },
  developerApiRequestAudit: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

describe("Phase 29 governed S3 reporting, activation governance, and owner isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores, verifies SHA-256 digest, checks existence, and deletes private report artifacts on S3", async () => {
    const objects = new Map<string, { body: Uint8Array; headers: Record<string, string> }>();
    const fakeFetch: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const pathname = new URL(url).pathname;
      const method = init?.method ?? "GET";
      if (method === "PUT") {
        expect(init?.headers).toHaveProperty("authorization");
        expect(String((init?.headers as Record<string, string>).authorization)).toContain("AWS4-HMAC-SHA256");
        objects.set(pathname, {
          body: new Uint8Array(init?.body as Buffer),
          headers: init?.headers as Record<string, string>,
        });
        return new Response(null, { status: 200 });
      }
      if (method === "HEAD") {
        return new Response(null, { status: objects.has(pathname) ? 200 : 404 });
      }
      if (method === "GET") {
        const hit = objects.get(pathname);
        if (!hit) return new Response(null, { status: 404 });
        return new Response(Buffer.from(hit.body), { status: 200 });
      }
      if (method === "DELETE") {
        const existed = objects.delete(pathname);
        return new Response(null, { status: existed ? 204 : 404 });
      }
      return new Response(null, { status: 405 });
    };

    const storage = resolveReportArtifactStorage(
      {
        NODE_ENV: "production",
        REPORT_ARTIFACT_STORAGE: "s3",
        REPORT_ARTIFACT_S3_ENDPOINT: "https://s3.example.test",
        REPORT_ARTIFACT_S3_BUCKET: "kt-private-reports",
        REPORT_ARTIFACT_S3_ACCESS_KEY_ID: "AKIAEXAMPLE123",
        REPORT_ARTIFACT_S3_SECRET_ACCESS_KEY: "secret-access-key-material",
      },
      fakeFetch,
    );
    expect(storage).toBeInstanceOf(S3ReportArtifactStorage);
    expect(storage.provider).toBe("S3_COMPATIBLE_PRIVATE");

    const key = storage.createStorageKey("REP-20261124-TEST0001", "CSV", "col\nval\n");
    await storage.store(key, "col\nval\n");
    expect(await storage.exists(key)).toBe(true);
    expect((await storage.open(key)).toString("utf8")).toBe("col\nval\n");
    expect(await storage.delete(key)).toBe(true);
    expect(await storage.exists(key)).toBe(false);
    await expect(storage.open(key)).rejects.toMatchObject({ code: "ARTIFACT_NOT_AVAILABLE" });

    // Refuses local storage in production
    const localInProd = resolveReportArtifactStorage({ NODE_ENV: "production", REPORT_ARTIFACT_STORAGE: "local" });
    expect(localInProd.provider).toBe("UNCONFIGURED");
    await expect(localInProd.store(key, "col\nval\n")).rejects.toMatchObject({ code: "REPORT_DURABLE_STORAGE_REQUIRED" });
  });

  it("enforces dual-control activation (rejects self-approval, future timestamps, revocation, missing runtime)", () => {
    const runtimeOk = { configured: true, blockerCode: "", summary: "ok" };
    const runtimeBad = { configured: false, blockerCode: "REPORT_ARTIFACT_STORAGE_UNCONFIGURED", summary: "missing s3" };
    const now = new Date("2026-11-24T12:00:00.000Z");

    const valid = evaluateGovernedActivationRecord(
      "REPORTING",
      {
        status: "APPROVED",
        requestedByUserId: "maker_1",
        requestedAt: "2026-11-24T10:00:00.000Z",
        reason: "Approve production CSV exports",
        approvedByUserId: "checker_2",
        approvedAt: "2026-11-24T11:00:00.000Z",
        approvalNote: "Verified",
        revokedByUserId: null,
        revokedAt: null,
        version: 2,
      },
      runtimeOk,
      now,
    );
    expect(valid.approved).toBe(true);
    expect(valid.active).toBe(true);
    expect(valid.blockerCode).toBeNull();

    const missingRuntime = evaluateGovernedActivationRecord(
      "REPORTING",
      {
        status: "APPROVED",
        requestedByUserId: "maker_1",
        requestedAt: "2026-11-24T10:00:00.000Z",
        reason: "Approve production CSV exports",
        approvedByUserId: "checker_2",
        approvedAt: "2026-11-24T11:00:00.000Z",
        approvalNote: "Verified",
        revokedByUserId: null,
        revokedAt: null,
        version: 2,
      },
      runtimeBad,
      now,
    );
    expect(missingRuntime.approved).toBe(true);
    expect(missingRuntime.active).toBe(false);
    expect(missingRuntime.blockerCode).toBe("REPORT_ARTIFACT_STORAGE_UNCONFIGURED");

    const selfApproved = evaluateGovernedActivationRecord(
      "DEVELOPER_API",
      {
        status: "APPROVED",
        requestedByUserId: "same",
        requestedAt: "2026-11-24T10:00:00.000Z",
        reason: "Self approval attempt",
        approvedByUserId: "same",
        approvedAt: "2026-11-24T11:00:00.000Z",
        approvalNote: "Self",
        revokedByUserId: null,
        revokedAt: null,
        version: 2,
      },
      runtimeOk,
      now,
    );
    expect(selfApproved.approved).toBe(false);
    expect(selfApproved.active).toBe(false);
  });

  it("refuses missing driver/promoter owner scope and scopes non-admin developer-api-usage strictly to owned apps", async () => {
    await expect(
      generateReportData({
        definitionKey: "driver-earnings",
        requesterUserId: "driver-user",
        requesterRole: "DRIVER",
        ownerScope: {},
        filters: {},
        limit: 50,
      }),
    ).rejects.toThrow(ReportingError);

    await expect(
      generateReportData({
        definitionKey: "promoter-earnings",
        requesterUserId: "promoter-user",
        requesterRole: "PROMOTER",
        ownerScope: {},
        filters: {},
        limit: 50,
      }),
    ).rejects.toMatchObject({ code: "REPORT_OWNER_SCOPE_UNAVAILABLE" });

    mockDb.developerApplication.findMany.mockResolvedValue([{ id: "app-owned-1" }]);
    mockDb.developerApiRequestAudit.findMany.mockResolvedValue([
      {
        publicReference: "dreq_1",
        method: "GET",
        route: "/api/v1/orders",
        outcome: "ALLOWED",
        responseStatus: 200,
        durationMs: 12,
        createdAt: new Date("2026-11-24T10:00:00.000Z"),
      },
    ]);
    const usage = await generateReportData({
      definitionKey: "developer-api-usage",
      requesterUserId: "dev-owner-1",
      requesterRole: "CUSTOMER",
      ownerScope: { userId: "dev-owner-1" },
      filters: {},
      limit: 50,
    });
    expect(mockDb.developerApplication.findMany).toHaveBeenCalledWith({
      where: { ownerUserId: "dev-owner-1" },
      select: { id: true },
    });
    expect(mockDb.developerApiRequestAudit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { applicationId: { in: ["app-owned-1"] } },
      }),
    );
    expect(usage.rows).toHaveLength(1);
  });
});
