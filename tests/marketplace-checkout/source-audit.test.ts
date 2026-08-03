import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const root = resolve(process.cwd());
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
describe("Phase 20 source contract", () => {
  it("uses a later additive migration and retains payment compatibility", () => { const migration = read("prisma/migrations/20260717120000_phase20_marketplace_checkout/migration.sql"); expect(migration).toMatch(/ALTER COLUMN "orderId" DROP NOT NULL/); expect(migration).toMatch(/marketplaceCheckoutId/); expect(migration).toMatch(/SALE_COMMITMENT/); });
  it("has no public mark-paid or fulfillment endpoint", () => { const routes = read("app/api/checkout/[reference]/prepare-payment/route.ts"); expect(routes).not.toMatch(/mark-paid|finali[sz]e|fulfil/i); });
  it("keeps source production lock literal and environment-independent", () => { const lock = read("lib/marketplace-checkout/production-lock.ts"); expect(lock).toMatch(/MARKETPLACE_CHECKOUT_PRODUCTION_VALIDATION_APPROVED = false/); expect(lock).not.toMatch(/process\.env/); });
  it("keeps scripts dry-run and avoids an automatic unknown-payment release", () => { const script = read("scripts/expire-checkout-reservations.mjs"); const support = read("scripts/marketplace-checkout-script-support.mjs"); expect(script).toMatch(/"status"::text='ACTIVE'/); expect(support).toMatch(/dryRun/); expect(script).not.toMatch(/PAYMENT_PENDING_HOLD/); });
});
