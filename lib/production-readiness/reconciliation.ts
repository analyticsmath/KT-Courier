import type { CapabilityMatrixEntry, CapabilityMatrixKey } from "@/lib/production-readiness/capability-matrix.service";
import type { Capability } from "@/lib/production-readiness/contracts";

export const EXCLUDED_CAPABILITY_MATRIX_KEYS = new Set<CapabilityMatrixKey>([
  "ADVERTISING",
  "PROMOTERS",
  "SUBSCRIPTIONS",
]);

export type MatrixReconciliationSummary = Readonly<{
  overallStatus: "READY" | "BLOCKED";
  registerReady: boolean;
  inScopeMatrixBlockers: readonly CapabilityMatrixKey[];
  excludedCapabilities: readonly CapabilityMatrixKey[];
}>;

export function reconcileBoardWithCapabilityMatrix(
  entries: readonly Capability[],
  capabilityMatrix: readonly CapabilityMatrixEntry[],
): MatrixReconciliationSummary {
  const registerReady = entries.every((e) => e.status === "READY" || e.status === "DISABLED_BY_POLICY");
  const excludedCapabilities = capabilityMatrix
    .filter((item) => EXCLUDED_CAPABILITY_MATRIX_KEYS.has(item.key))
    .map((item) => item.key)
    .sort();
  const inScopeMatrixBlockers = capabilityMatrix
    .filter((item) => !EXCLUDED_CAPABILITY_MATRIX_KEYS.has(item.key) && !item.eligibleForLiveUse)
    .map((item) => item.key)
    .sort();

  const overallStatus = registerReady && inScopeMatrixBlockers.length === 0 ? "READY" : "BLOCKED";
  return Object.freeze({
    overallStatus,
    registerReady,
    inScopeMatrixBlockers: Object.freeze(inScopeMatrixBlockers),
    excludedCapabilities: Object.freeze(excludedCapabilities),
  });
}
