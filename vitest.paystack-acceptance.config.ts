import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
export default defineConfig({ plugins: [tsconfigPaths()], test: { include: ["tests/integration/marketplace-payment.integration.test.ts"], pool: "forks", maxWorkers: 1, testTimeout: 90_000 } });
