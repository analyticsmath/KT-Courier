if (process.env.KT_STOREFRONT_INTEGRATION_APPROVED !== "true") {
  console.error("Storefront PostgreSQL integration is deferred until Phase 26.5 approves an isolated disposable Compose project.");
  process.exitCode = 1;
} else {
  console.error("The Phase 19 integration harness is intentionally deferred; run vitest.storefront-integration.config.ts only in its uniquely named disposable project.");
  process.exitCode = 1;
}

