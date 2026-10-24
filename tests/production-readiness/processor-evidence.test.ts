import { describe, expect, it } from "vitest";
import { evaluateProcessorEvidence } from "@/lib/production-readiness/processor-evidence";

const now = new Date("2026-10-24T20:30:00Z");
const heartbeat = { observedAt: now.toISOString(), healthy: true, processors: [{ name: "payments", status: "IDLE", itemsRetried: 0 }] };
describe("processor readiness diagnostics", () => {
  it("keeps a successful payment processor blocked when marketplace reconciliation blocks the worker", () => {
    expect(evaluateProcessorEvidence({ ...heartbeat, healthy: false, readinessBlockers: ["STORE_ORDER_SNAPSHOT_RECONCILIATION_REQUIRED"] }, "payments", now)).toMatchObject({ healthy: false, fresh: true, reason: "PROCESSOR_WORKER_BLOCKED", cycleStatus: "IDLE", blockers: ["STORE_ORDER_SNAPSHOT_RECONCILIATION_REQUIRED"] });
  });
  it("accepts a fresh healthy worker", () => expect(evaluateProcessorEvidence(heartbeat, "payments", now)).toMatchObject({ healthy: true, reason: "PROCESSOR_HEALTHY" }));
  it("does not hide retry work behind a completed status or healthy flag", () => expect(evaluateProcessorEvidence({ ...heartbeat, processors: [{ name: "payments", status: "COMPLETED", itemsRetried: 1 }] }, "payments", now)).toMatchObject({ healthy: false, reason: "PROCESSOR_FAILED_OR_RETRYING" }));
  it.each([undefined, "invalid", "2026-10-24T20:31:00Z", "2026-10-24T20:23:00Z"])("rejects missing, invalid, future or stale heartbeat %s", (observedAt) => expect(evaluateProcessorEvidence({ ...heartbeat, observedAt }, "payments", now)).toMatchObject({ healthy: false, reason: "PROCESSOR_HEARTBEAT_STALE" }));
  it("rejects a missing processor result", () => expect(evaluateProcessorEvidence(heartbeat, "missing", now)).toMatchObject({ healthy: false, reason: "PROCESSOR_FAILED_OR_RETRYING" }));
  it("retains explicit blockers even if a contradictory heartbeat claims health", () => expect(evaluateProcessorEvidence({ ...heartbeat, readinessBlockers: ["STORE_ORDER_OPERATIONAL_POLICY_REQUIRED"] }, "payments", now)).toMatchObject({ healthy: false, reason: "PROCESSOR_WORKER_BLOCKED" }));
});
