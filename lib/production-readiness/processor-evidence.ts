type Heartbeat = {
  observedAt?: string;
  healthy?: boolean;
  readinessBlockers?: string[];
  processors?: { name: string; status: string; itemsRetried?: number }[];
};

/** Preserve the worker-wide safety gate while explaining which part failed. */
export function evaluateProcessorEvidence(heartbeat: Heartbeat | undefined, job: string, now: Date) {
  const age = heartbeat?.observedAt ? now.getTime() - new Date(heartbeat.observedAt).getTime() : Infinity;
  const fresh = age >= 0 && age < 420_000;
  const result = heartbeat?.processors?.find((item) => item.name === job);
  const processorHealthy = !!result && ["COMPLETED", "IDLE", "PEER_LEASE"].includes(result.status) && (result.itemsRetried ?? 0) === 0;
  const blockers = heartbeat?.readinessBlockers ?? [];
  const healthy = fresh && processorHealthy && heartbeat?.healthy === true && blockers.length === 0;
  const reason = !fresh ? "PROCESSOR_HEARTBEAT_STALE" : !processorHealthy ? "PROCESSOR_FAILED_OR_RETRYING" : !healthy ? "PROCESSOR_WORKER_BLOCKED" : "PROCESSOR_HEALTHY";
  return { healthy, fresh, reason, cycleStatus: result?.status ?? "NO_CYCLE_RESULT", blockers };
}
