import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
// The payment file now requires the independent persisted provider and actual
// HTTP composition in the named E2E database; scripts/e2e-test.mjs executes it
// before focused Paystack browser acceptance. It is never a dummy or a skip.
// Browser-backed canonical cases are required separately in the certification
// browser job against its guarded database and independent offline provider.
export default defineConfig({ plugins: [tsconfigPaths()], test: { include: ["tests/integration/marketplace-*.integration.test.ts"], exclude: ["tests/integration/marketplace-payment.integration.test.ts", "tests/integration/marketplace-order.integration.test.ts", "tests/integration/marketplace-settlement.integration.test.ts", "tests/integration/marketplace-paystack-residual.integration.test.ts"], pool: "forks" } });
