import { runSafePostgresIntegrationSuite } from "./safe-postgres-runner.mjs";

const result = await runSafePostgresIntegrationSuite({
  suiteKey: "MARKETPLACE_CHECKOUT",
  configFile: "vitest.marketplace-checkout-integration.config.ts",
  runnerMode: "cli",
});

process.exit(result.exitCode);
