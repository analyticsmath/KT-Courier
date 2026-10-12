import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), readiness: vi.fn() }));
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: mocks.auth }));
vi.mock("@/lib/production-readiness/service", () => ({ getProductionReadiness: mocks.readiness }));
import { GET } from "@/app/api/admin/production-readiness/route";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { capability, configurationCapability } from "@/lib/production-readiness/contracts";

describe("production readiness authorization and classification", () => {
  beforeEach(() => { mocks.auth.mockReset(); mocks.readiness.mockReset(); });
  it.each([401, 403])("denies unauthorized/scoped actors before probing (%i)", async (status) => {
    mocks.auth.mockResolvedValue({ response: Response.json({ error: "Denied" }, { status }) });
    expect((await GET(new NextRequest("https://kt.example/api/admin/production-readiness"))).status).toBe(status);
    expect(mocks.readiness).not.toHaveBeenCalled();
  });
  it("requires exact permission and serves uncached business blockers to an authorized operator", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "operator" } });
    mocks.readiness.mockResolvedValue({ status: "BLOCKED", capabilities: [capability("cod", "BLOCKED_EXTERNAL_INPUT", "NO_POLICY", "Supply approved scope.", "FINANCE")] });
    const response = await GET(new NextRequest("https://kt.example/api/admin/production-readiness"));
    expect(mocks.auth).toHaveBeenCalledWith(PERMISSIONS.SYSTEM_READINESS_READ, expect.anything());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.json()).capabilities[0].status).toBe("BLOCKED_EXTERNAL_INPUT");
  });
  it("distinguishes ready, configuration, external, human, live and policy gates", () => {
    expect(configurationCapability("database", false, "Probe").status).toBe("BLOCKED_CONFIGURATION");
    expect(configurationCapability("database", true, "Probe").severity).toBe("INFO");
    for (const status of ["BLOCKED_EXTERNAL_INPUT", "BLOCKED_HUMAN_APPROVAL", "BLOCKED_LIVE_ACCEPTANCE"] as const) expect(capability("gate", status, "PENDING", "Evidence required.", "OPERATIONS").severity).toBe("BLOCKER");
    expect(capability("gate", "DISABLED_BY_POLICY", "DISABLED", "Future feature.", "CLIENT").severity).toBe("WARNING");
  });
});
