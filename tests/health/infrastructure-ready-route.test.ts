import { beforeEach, describe, expect, it, vi } from "vitest";
const probe = vi.hoisted(() => vi.fn());
vi.mock("@/lib/health/infrastructure-readiness", () => ({ checkInfrastructureReadiness: probe }));
import { GET } from "@/app/api/infrastructure/ready/route";
describe("Railway infrastructure probe", () => {
  beforeEach(() => probe.mockReset());
  it("accepts available database and redis, without claiming financial activation", async () => {
    probe.mockResolvedValue({ status: "ready", database: "reachable", redis: "connected" });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ status: "ready", database: "reachable", redis: "connected" });
  });
  it("returns HTTP 503 if either infrastructure dependency fails", async () => {
    probe.mockResolvedValue({ status: "not_ready", database: "reachable", redis: "unreachable" });
    const res = await GET();
    expect(res.status).toBe(503);
  });
});
