import { runSafePostgresIntegrationSuite } from "./safe-postgres-runner.mjs";

const result = await runSafePostgresIntegrationSuite({
  suiteKey: "STORE_ORDER",
  configFile: "vitest.store-order-integration.config.ts",
  runnerMode: "cli",
});

process.exit(result.exitCode);
