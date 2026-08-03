import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
export default defineConfig({ plugins: [tsconfigPaths()], test: { environment: "node", include: ["tests/integration/driver-earning-*.integration.test.ts"], setupFiles: ["tests/setup.ts"], fileParallelism: false, maxWorkers: 1, testTimeout: 60_000, hookTimeout: 60_000 } });
