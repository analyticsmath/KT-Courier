import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), origin: vi.fn(), execute: vi.fn(), inventory: vi.fn() }));
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: mocks.auth }));
vi.mock("@/lib/security/request-origin", () => ({ enforceSameOriginRequest: mocks.origin }));
vi.mock("@/lib/processors/processor-service", () => ({ executeRegisteredProcessor: mocks.execute, getProcessorInventory: mocks.inventory }));
import { GET, POST } from "@/app/api/admin/processors/route";
import { PROCESSOR_REGISTRY } from "@/lib/processors/processor-registry";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
const request = (body: object) => new NextRequest("https://kt.example/api/admin/processors", { method: "POST", headers: { "content-type": "application/json", origin: "https://kt.example" }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks(); mocks.origin.mockResolvedValue(null);
  mocks.auth.mockResolvedValue({ user: { id: "operator", role: "ADMIN" } });
  mocks.execute.mockResolvedValue({ success: true }); mocks.inventory.mockResolvedValue([]);
});
describe("manual processor execution authority", () => {
  it("allows monitoring without granting execution", async () => {
    expect((await GET(new NextRequest("https://kt.example/api/admin/processors"))).status).toBe(200);
    expect(mocks.auth).toHaveBeenCalledOnce(); expect(mocks.auth.mock.calls[0][0]).toBe(PERMISSIONS.PROCESSORS_READ);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it.each(["APPLY", "DRY_RUN"])("requires the selected domain permission in %s mode", async mode => {
    mocks.auth.mockImplementation(async permission => permission === PERMISSIONS.PROCESSORS_READ ? { user: { id: "viewer" } } : { response: Response.json({ error: "Denied" }, { status: 403 }) });
    expect((await POST(request({ name: "release-mature-store-earnings", mode }))).status).toBe(403);
    expect(mocks.auth).toHaveBeenLastCalledWith(PERMISSIONS.STORE_EARNINGS_RECONCILE, expect.anything());
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("refuses every internal-only processor even for privileged operators", async () => {
    for (const processor of Object.values(PROCESSOR_REGISTRY).filter(p => !p.manualExecutionAllowed)) {
      expect((await POST(request({ name: processor.name, mode: "APPLY" }))).status).toBe(403);
    }
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it.each([401, 403])("rejects an unauthenticated or denied monitor before execution (%i)", async status => {
    mocks.auth.mockResolvedValue({ response: Response.json({ error: "Denied" }, { status }) });
    expect((await POST(request({ name: "release-mature-driver-earnings", mode: "APPLY" }))).status).toBe(status);
    expect(mocks.auth).toHaveBeenCalledOnce(); expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("preserves the execution identity and parameters for a properly authorized domain operator", async () => {
    const body = { name: "release-mature-driver-earnings", mode: "APPLY", batchSize: 5, operationId: "ADMIN-RELEASE-01" };
    expect((await POST(request(body))).status).toBe(200);
    expect(mocks.auth).toHaveBeenLastCalledWith(PERMISSIONS.DRIVER_EARNINGS_RECONCILE, expect.anything());
    expect(mocks.execute).toHaveBeenCalledWith({ ...body, actorUserId: "operator", partition: undefined });
  });
  it("refuses alternate singleton partitions before a caller can bypass the registered lease", async () => {
    expect((await POST(request({ name: "finalize-paid-marketplace-checkouts", mode: "APPLY", partition: "bypass" }))).status).toBe(400);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("checks origin before authorization or execution", async () => {
    mocks.origin.mockResolvedValue(Response.json({ error: "Origin denied" }, { status: 403 }));
    expect((await POST(request({ name: "release-mature-driver-earnings" }))).status).toBe(403);
    expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.execute).not.toHaveBeenCalled();
  });
});
