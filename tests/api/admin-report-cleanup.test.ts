import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mock = vi.hoisted(() => ({ auth: vi.fn(), origin: vi.fn(), cleanup: vi.fn() }));
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: mock.auth }));
vi.mock("@/lib/security/request-origin", () => ({ enforceSameOriginRequest: mock.origin }));
vi.mock("@/lib/reporting/reconciliation", () => ({ ReportReconciliationService: class { cleanupUncommittedObject = mock.cleanup; } }));
vi.mock("@/lib/reporting/services", () => ({ ReportAdministrationService: class {} }));
import { POST } from "@/app/api/admin/reports/reconciliation/route";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

beforeEach(() => { vi.clearAllMocks(); mock.origin.mockResolvedValue(null); mock.auth.mockResolvedValue({ user: { id: "admin" } }); mock.cleanup.mockResolvedValue(undefined); });
const request = () => new NextRequest("https://local/api/admin/reports/reconciliation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "CLEANUP_ORPHAN", caseId: "case" }) });

it("requires reconciliation permission before cleanup", async () => {
  mock.auth.mockResolvedValueOnce({ response: NextResponse.json({}, { status: 403 }) });
  expect((await POST(request())).status).toBe(403);
  expect(mock.auth).toHaveBeenCalledWith(PERMISSIONS.REPORT_RECONCILIATION_RETRY, expect.anything());
  expect(mock.cleanup).not.toHaveBeenCalled();
});

it("passes the authorized actor and case to the cleanup service", async () => {
  expect((await POST(request())).status).toBe(200);
  expect(mock.cleanup).toHaveBeenCalledWith("case", "admin");
});
