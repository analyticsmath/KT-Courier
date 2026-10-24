export const HISTORICAL_SCOPE_MIGRATION = "20261025010000_marketplace_historical_operational_scope";
export function isKnownHistoricalScopeFailure(failure: { migration_name: string; logs: string | null; applied_steps_count: number }) {
  return failure.migration_name === HISTORICAL_SCOPE_MIGRATION && failure.applied_steps_count === 0 &&
    !!failure.logs?.includes("column p.publicReference does not exist");
}
export function assertHistoricalScopeRecoverySafe(columnCount: number, changedOriginCount: number, guardExists: boolean) {
  if (![0, 2].includes(columnCount) || changedOriginCount !== 0 || guardExists) {
    throw new Error("Historical scope migration has unexpected committed changes; recovery stopped.");
  }
}
