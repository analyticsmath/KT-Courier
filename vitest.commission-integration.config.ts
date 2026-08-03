import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({ plugins: [tsconfigPaths()], test: { include: ["tests/integration/commission-system.integration.test.ts"], environment: "node", testTimeout: 30_000 } });
