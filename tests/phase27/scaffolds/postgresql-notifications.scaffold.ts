export const postgresqlNotificationScenarios = [
  "source event to inbox", "source event to channel deliveries", "duplicate replay", "payload conflict", "email acceptance", "email retry and bounce", "SMS opt-out", "push invalidation", "marketing consent", "quiet hours", "digest", "provider receipt", "cross-role privacy", "reconciliation convergence", "OTP delivery boundary",
] as const;

export const postgresqlNotificationScaffold = postgresqlNotificationScenarios.map((scenario) => ({ scenario, setup: "Create isolated users, verified destinations, an active category/template/route and a durable source event.", action: "Run the canonical Phase 27 service using a bounded operation id.", assertion: "Assert canonical records, idempotency/convergence and privacy-safe projections; never call an external provider." }));
