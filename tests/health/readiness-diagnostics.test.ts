import { describe, expect, it, vi } from "vitest";
import { createReadinessWarningReporter } from "@/lib/health/readiness-diagnostics";

describe("safe production readiness diagnostics", () => {
  it("emits configuration reason codes without connection strings or arbitrary data", () => {
    const emit = vi.fn();
    const report = createReadinessWarningReporter(emit, () => 100_000);
    report({ databaseReachable: true, redisConnected: true, blockedCodes: ["PRIVATE_MEDIA_STORAGE_UNCONFIGURED", "postgresql://username:password@internal"] });
    expect(emit).toHaveBeenCalledOnce();
    const payload = JSON.parse(emit.mock.calls[0]![0]);
    expect(payload).toMatchObject({ event: "readiness.blocked", database: "reachable", redis: "connected", reasons: ["PRIVATE_MEDIA_STORAGE_UNCONFIGURED"] });
    expect(emit.mock.calls[0]![0]).not.toMatch(/username|password|internal|postgresql/);
  });
  it("limits duplicate incidents and emits when the blocker changes or five minutes elapse", () => {
    let time = 100_000;
    const emit = vi.fn();
    const report = createReadinessWarningReporter(emit, () => time);
    const snapshot = { databaseReachable: true, redisConnected: true, blockedCodes: ["PAYMENT_AUTHORITY_UNAVAILABLE"] };
    report(snapshot); report(snapshot);
    expect(emit).toHaveBeenCalledTimes(1);
    time += 60_000; report({ ...snapshot, blockedCodes: ["PRIVATE_MEDIA_STORAGE_UNCONFIGURED"] });
    expect(emit).toHaveBeenCalledTimes(2);
    report({ ...snapshot, blockedCodes: ["PRIVATE_MEDIA_STORAGE_UNCONFIGURED"] });
    expect(emit).toHaveBeenCalledTimes(2);
    time += 301_000; report({ ...snapshot, blockedCodes: ["PRIVATE_MEDIA_STORAGE_UNCONFIGURED"] });
    expect(emit).toHaveBeenCalledTimes(3);
  });
});
