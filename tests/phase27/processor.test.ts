import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Phase 27 processors", () => {
  it("ships the complete bounded processor inventory", () => {
    const required = ["phase27-notification-preflight.mjs", "consume-notification-source-events.mjs", "fanout-notification-messages.mjs", "deliver-notifications.mjs", "retry-notification-deliveries.mjs", "process-notification-receipts.mjs", "build-notification-digests.mjs", "expire-notifications.mjs", "deactivate-stale-notification-endpoints.mjs", "scan-notification-reconciliation.mjs", "verify-notification-invariants.mjs", "notification-integration-test.mjs"];
    for (const file of required) expect(readFileSync(join(process.cwd(), "scripts", file), "utf8")).toContain("runPhase27Processor");
  });

  it("routes apply through the production lock and dry runs through real candidate selectors", () => {
    const runner = readFileSync(join(process.cwd(), "scripts", "phase27-processor-runner.ts"), "utf8");
    const service = readFileSync(join(process.cwd(), "lib", "notifications", "processor.service.ts"), "utf8");
    expect(runner).toContain("services.processors.run");
    expect(service).toContain("assertNotificationProductionReady");
    expect(service).toContain("notificationEventIntent.findMany");
  });
});
