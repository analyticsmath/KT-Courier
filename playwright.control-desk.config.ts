import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "control-desk.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [["list"], ["json", { outputFile: "output/playwright/control-desk-results.json" }]],
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3200", channel: "chrome", screenshot: "only-on-failure", trace: "retain-on-failure" },
});
