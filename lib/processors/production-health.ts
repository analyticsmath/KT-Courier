const MAX_HEALTH_AGE_MS = 420_000;

export interface ProductionProcessorHealthState {
  live: boolean;
  ready: boolean;
}

export function getProductionProcessorHealthState(input: {
  stopping: boolean;
  healthy: boolean;
  lastCycleAt: number;
  now?: number;
}): ProductionProcessorHealthState {
  const live = !input.stopping;
  const ready = live && input.healthy && input.lastCycleAt > 0 && (input.now ?? Date.now()) - input.lastCycleAt < MAX_HEALTH_AGE_MS;
  return { live, ready };
}

/** Railway checks process liveness during startup; operators can use /ready
 * to confirm that a healthy processor cycle has completed recently. */
export function getProductionProcessorHealthStatus(path: string, state: ProductionProcessorHealthState): number {
  if (path === "/health") return state.live ? 200 : 503;
  if (path === "/ready") return state.ready ? 200 : 503;
  return 404;
}
