import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/** PostgreSQL-only scaffold. It requires a uniquely named disposable Phase 21
 * database and is intentionally not included by the default test config. */
export default defineConfig({ plugins: [tsconfigPaths()], test: { environment: "node", include: ["tests/integration/store-order-*.integration.test.ts"], setupFiles: ["tests/setup.ts"], testTimeout: 30_000 } });
