export const playwrightNotificationScenarios = [
  "customer notification centre", "store notification centre", "driver notification centre", "promoter notification centre", "applicant notification centre", "admin notification operations", "preference updates", "marketing revocation", "push opt-in", "cross-user denial", "OTP delivery flow",
] as const;

export const playwrightNotificationScaffold = playwrightNotificationScenarios.map((scenario) => ({ scenario, setup: "Seed a deterministic Phase 27 inbox and authenticated role-specific browser session.", action: "Navigate through the shared canonical notification API and product surface.", assertion: "Verify ownership, accessibility labels, mobile navigation and no raw destination or token disclosure." }));
