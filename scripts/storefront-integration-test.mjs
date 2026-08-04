import { runSafePostgresIntegrationSuite } from "./safe-postgres-runner.mjs";

const result = await runSafePostgresIntegrationSuite({
  suiteKey: "STOREFRONT",
  configFile: "vitest.storefront-integration.config.ts",
  runnerMode: "cli",
});

process.exit(result.exitCode);
