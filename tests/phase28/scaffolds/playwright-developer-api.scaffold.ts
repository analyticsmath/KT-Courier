/** Phase 30 browser scenarios; never execute in Phase 28 focused validation. */
export const phase28PlaywrightScenarios = Object.freeze([
  "developer registration", "application submission", "admin application approval", "credential one-time display", "credential rotation", "credential revocation", "webhook registration", "webhook verification", "webhook secret rotation", "delivery history", "delivery retry", "usage and quota view", "admin request audit", "cross-user developer denial", "production-lock state",
]);
export function phase28BrowserScenario(name: string) { if (!phase28PlaywrightScenarios.includes(name)) throw new Error("Unknown Phase 28 Playwright scenario."); return { name, requiredAssertions: ["visible labelled controls", "no secret after one-time display", "safe denied state", "production locked state"], deferredTo: "Phase 30" as const }; }
