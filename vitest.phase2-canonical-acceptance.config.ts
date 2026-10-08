import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
export default defineConfig({ plugins: [tsconfigPaths()], test: { include: ["tests/integration/store-order-{acceptance,adjustment,delivery-bridge,handoff,invariants,inventory,reconciliation,refund,substitution}.integration.test.ts", "tests/integration/marketplace-{order,settlement,paystack-residual}.integration.test.ts"], pool: "forks", maxWorkers: 1, testTimeout: 180_000 } });
