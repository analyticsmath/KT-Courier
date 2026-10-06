import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
export default defineConfig({ plugins: [tsconfigPaths()], test: { environment: "node", include: ["tests/security/real-redis-rate-limit.integration.test.ts"], setupFiles: ["tests/setup.ts"], fileParallelism: false, maxWorkers: 1 } });
