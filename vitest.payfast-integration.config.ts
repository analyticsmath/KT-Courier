import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
export default defineConfig({ plugins: [tsconfigPaths()], test: { environment: "node", include: ["tests/integration/payfast-*.integration.test.ts"], exclude: ["tests/integration/payfast-itn-*.integration.test.ts"], setupFiles: ["tests/setup.ts"], clearMocks: true, restoreMocks: true, fileParallelism: false, maxWorkers: 1 } });
