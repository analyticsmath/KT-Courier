import { describe, expect, it } from "vitest";
import { toSafeApplicationLogEvent } from "@/lib/observability/logger";
import { recordTelemetry, registerTelemetryExporter } from "@/lib/observability/telemetry";

describe("Phase 5 observability safety", () => {
  it("redacts secrets and normalizes user-controlled log text", () => {
    const entry = toSafeApplicationLogEvent({
      level: "WARN", event: "admin\ninput", message: "hello\r\nworld", actorReference: "user-123",
      context: { password: "do-not-log", nested: { authorization: "Bearer value" }, note: "safe\ntext" },
    });
    expect(entry.message).toBe("hello world");
    expect(entry.event).toBe("admin input");
    expect(entry.context).toMatchObject({ password: "[REDACTED]", nested: { authorization: "[REDACTED]" }, note: "safe text" });
    expect(JSON.stringify(entry)).not.toContain("do-not-log");
    expect(entry.actorReference).not.toBe("user-123");
  });

  it("does not let telemetry exporter failure corrupt the caller", async () => {
    registerTelemetryExporter(() => { throw new Error("export unavailable"); });
    await expect(recordTelemetry({ name: "payment.verify", attributes: { email: "private@example.test", result: "ok" } })).resolves.toBeUndefined();
    registerTelemetryExporter(null);
  });
});
