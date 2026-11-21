import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateMarketplaceCheckoutPublicGate, assertMarketplaceCheckoutProductionReady } from "@/lib/marketplace-checkout/production-lock";
const root = resolve(process.cwd());
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
describe("Phase 20 source contract", () => {
  it("uses a later additive migration and retains payment compatibility", () => {
    const migration = read(
      "prisma/migrations/20260717120000_phase20_marketplace_checkout/migration.sql",
    );
    expect(migration).toMatch(/ALTER COLUMN "orderId" DROP NOT NULL/);
    expect(migration).toMatch(/marketplaceCheckoutId/);
    expect(migration).toMatch(/SALE_COMMITMENT/);
  });
  it("has no public mark-paid or fulfillment endpoint", () => {
    const routes = read(
      "app/api/checkout/[reference]/prepare-payment/route.ts",
    );
    expect(routes).not.toMatch(/mark-paid|finali[sz]e|fulfil/i);
  });
  it("enforces the canonical switch, runtime and provider readiness at checkout", () => {
    const env = { NODE_ENV: "production", KT_DATABASE_CLASSIFICATION: "production", KT_COMMERCE_ENABLED: "true", PAYSTACK_MODE: "live", PAYSTACK_SECRET_KEY: "sk_live_unit_test_secret_fixture", PAYSTACK_PUBLIC_KEY: "pk_live_unit_test_public_fixture", PAYMENT_APP_ORIGIN: "https://www.ktcouriers.com" };
    expect(evaluateMarketplaceCheckoutPublicGate(env)).toEqual({ enabled: true, blockReason: null });
    expect(evaluateMarketplaceCheckoutPublicGate({ ...env, KT_COMMERCE_ENABLED: "false", CHECKOUT_PUBLIC_ENABLED: "true" })).toEqual({ enabled: false, blockReason: "CHECKOUT_PUBLIC_DISABLED" });
    expect(evaluateMarketplaceCheckoutPublicGate({ ...env, KT_COMMERCE_ENABLED: undefined, CHECKOUT_PUBLIC_ENABLED: "true" }).enabled).toBe(true);
    expect(evaluateMarketplaceCheckoutPublicGate({ ...env, KT_RUNTIME_ENV: "e2e" }).enabled).toBe(false);
    expect(evaluateMarketplaceCheckoutPublicGate({ ...env, PAYSTACK_SECRET_KEY: "" }).enabled).toBe(false);
    expect(evaluateMarketplaceCheckoutPublicGate({ ...env, PAYSTACK_SECRET_KEY: "sk_test_mismatch" }).enabled).toBe(false);
    expect(() => assertMarketplaceCheckoutProductionReady("PAYMENT", { approved: true }, env)).toThrow(/PRODUCTION_TEST_APPROVAL_FORBIDDEN/);
  });
  it("keeps scripts dry-run and avoids an automatic unknown-payment release", () => {
    const script = read("scripts/expire-checkout-reservations.mjs");
    const support = read("scripts/marketplace-checkout-script-support.mjs");
    expect(script).toMatch(/"status"::text='ACTIVE'/);
    expect(support).toMatch(/dryRun/);
    expect(script).not.toMatch(/PAYMENT_PENDING_HOLD/);
  });
});
