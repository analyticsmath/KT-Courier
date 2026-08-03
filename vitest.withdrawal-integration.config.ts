import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({ plugins: [tsconfigPaths()], test: { include: ["tests/integration/withdrawal-*.integration.test.ts"], environment: "node", setupFiles: ["tests/setup.ts"], testTimeout: 30_000 } });
