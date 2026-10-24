import { describe, expect, it, vi } from "vitest";
import { checkInfrastructureReadiness } from "@/lib/health/infrastructure-readiness";

const liveRedis = () => Promise.resolve({ configured: true, connected: true, status: "HEALTHY" } as const);

describe("deployment infrastructure readiness (not financial approval)", () => {
  it("passes with a reachable database and Redis", async () => {
    const db = { $queryRaw: vi.fn().mockResolvedValue([{ result: 1 }]) };
    expect(await checkInfrastructureReadiness(db as never, liveRedis)).toMatchObject({ status: "ready", database: "reachable", redis: "connected" });
  });
  it("blocks a deployment with inaccessible PostgreSQL", async () => {
    const db = { $queryRaw: vi.fn().mockRejectedValue(new Error("db down")) };
    expect(await checkInfrastructureReadiness(db as never, liveRedis)).toMatchObject({ status: "not_ready", database: "unreachable" });
  });
  it("blocks a deployment with inaccessible Redis", async () => {
    const db = { $queryRaw: vi.fn().mockResolvedValue(1) };
    const redis = () => Promise.resolve({ configured: true, connected: false, status: "UNREACHABLE" } as const);
    expect(await checkInfrastructureReadiness(db as never, redis)).toMatchObject({ status: "not_ready", redis: "unreachable" });
  });
  it("fails closed if an infrastructure probe hangs", async () => {
    const db = { $queryRaw: vi.fn().mockImplementation(() => new Promise(() => {})) };
    expect(await checkInfrastructureReadiness(db as never, liveRedis, 10)).toMatchObject({ status: "not_ready", database: "unreachable" });
  });
});
