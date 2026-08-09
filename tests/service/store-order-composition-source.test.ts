import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("store-order production composition source", () => {
  const financial = read("lib/store-orders/financial-adjustment-composition.ts");
  const root = read("lib/store-orders/composition-root.ts");
  const service = read("lib/store-orders/store-order.service.ts");

  it("uses the existing Phase 14, 16 and 15 authorities", () => {
    expect(financial).toContain("reverseCommissionInTransaction");
    expect(financial).toContain("adjustStoreEarningInTransaction");
    expect(financial).toContain("createMarketplaceRefundRequest");
  });

  it("does not add a Phase 21 journal writer", () => {
    expect(financial).not.toContain("postLedgerJournalWithinTransaction");
    expect(financial).not.toContain("ledgerJournal.create");
  });

  it("resolves concrete courier and pickup authorities before the source lock", () => {
    expect(root).toContain("ExistingCourierOrderMarketplaceBridge");
    expect(root).toContain("ExistingPhase8MarketplacePickupAuthority");
    expect(service).toContain("const dependencies = { ...resolveStoreOrderProductionComposition()");
  });

  it("keeps financial and delivery authorities outside their local staging transactions", () => {
    expect(service).toContain("await dependencies.financialAuthority.applyExactAdjustment");
    expect(service).toContain("await dependencies.deliveryAuthority.createCourierOrder");
  });

  it("executes marketplace pickup through one propagated transaction", () => {
    expect(service).toContain("const result = await transaction(async (tx) => {");
    expect(service).toContain("completeMarketplacePickupInTx");
    expect(service).toContain("projectMarketplaceCourierExecutionInTx");
    expect(service).not.toContain("dependencies.pickupAuthority.completeCanonicalPickup");
  });

  it("requires package-count evidence and does not complete delivery", () => {
    expect(service).toContain("STORE_ORDER_HANDOFF_PACKAGE_MISMATCH");
    expect(service).not.toContain("markDelivered");
  });
});
