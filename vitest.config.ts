import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Phase 26 disposable-database and browser suites are evidence scaffolds for
    // Phase 26.5. They must never inflate the DB-free focused verification count.
    exclude: [
      "tests/integration/**",
      "tests/e2e/**",
      "tests/phase26/integration/**",
      "tests/phase26/e2e/**",
      "tests/phase-b/**/*-postgres.test.ts",
    ],
    setupFiles: ["tests/setup.ts"],
    testTimeout: 15000,
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      reportsDirectory: "coverage",
      exclude: [
        ".next/**",
        "node_modules/**",
        "coverage/**",
        "prisma/migrations/**",
        "node_modules/.prisma/**",
        "public/**",
        "next-env.d.ts",
        "vitest.config.ts",
      ],
    },
  },
});
