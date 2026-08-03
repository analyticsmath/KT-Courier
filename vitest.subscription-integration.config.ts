import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
export default defineConfig({ plugins: [tsconfigPaths()], test: { include: ["tests/integration/subscription-*.integration.test.ts"], testTimeout: 30_000 } });
