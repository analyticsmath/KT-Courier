import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({ plugins: [tsconfigPaths()], test: { include: ["tests/integration/store-earning-*.integration.test.ts"], environment: "node", testTimeout: 30_000, maxWorkers: 1 } });
