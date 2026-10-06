/** All write entry points share this fail-closed target gate. */
export function assertLegacyApplyAllowed(
  env: Readonly<Record<string, string | undefined>> = process.env,
): void {
  const classification = env.KT_DATABASE_CLASSIFICATION?.trim().toLowerCase();
  if (!classification || !["production", "staging", "test", "disposable", "local"].includes(classification)) {
    throw new Error("Legacy migration writes require an explicit database classification.");
  }
  const url = new URL(env.DATABASE_URL ?? "");
  if (!["postgresql:", "postgres:"].includes(url.protocol)) {
    throw new Error("Legacy migration requires a PostgreSQL target.");
  }
  const productionSignal = classification === "production" ||
    /^(production|prod|live)$/i.test(env.RAILWAY_ENVIRONMENT_NAME ?? "") ||
    /\bproduction\b/i.test(env.RAILWAY_PROJECT_NAME ?? "") ||
    /(^|[_-])(production|prod|live)([_-]|$)/i.test(url.pathname) ||
    /(^|[.-])(production|prod|live)([.-]|$)/i.test(url.hostname);
  if (productionSignal && env.KT_LEGACY_6AMMART_PRODUCTION_APPROVED !== "true") {
    throw new Error("Production legacy migration requires explicit cutover approval.");
  }
}

/** Counts alone cannot prove ownership when a mapped row was deleted. */
export function assertLegacyTargetOwnership(
  targetIds: readonly string[], mappedIds: readonly string[], model: string,
  preservedIds: readonly string[] = [],
): void {
  const mapped = new Set(mappedIds);
  if (preservedIds.some((id) => mapped.has(id))) throw new Error("Preserved and imported target identities overlap: " + model);
  for (const id of preservedIds) mapped.add(id);
  if (targetIds.length !== mapped.size || targetIds.some((id) => !mapped.has(id))) {
    throw new Error("Target contains unrelated or missing " + model + " records; reconcile in a separate clean target.");
  }
}
