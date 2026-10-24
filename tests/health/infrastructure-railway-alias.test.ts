import { beforeEach, describe, expect, it, vi } from "vitest";

const probe = vi.hoisted(() => vi.fn());
vi.mock("@/lib/health/infrastructure-readiness", () => ({ checkInfrastructureReadiness: probe }));
import { GET } from "@/app/api/infrastructure_ready/route";

describe("Railway compatible infrastructure healthcheck URL", () => {
  beforeEach(() => probe.mockReset());
  it("reports healthy database and Redis without implying payments are approved", async () => {
    probe.mockResolvedValue({ status: "ready", database: "reachable", redis: "connected" });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ status: "ready", database: "reachable", redis: "connected" });
  });
  it("still fails closed for unavailable infrastructure", async () => {
    probe.mockResolvedValue({ status: "not_ready", database: "unreachable", redis: "connected" });
    expect((await GET()).status).toBe(503);
  });
});
