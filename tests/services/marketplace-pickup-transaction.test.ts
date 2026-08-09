import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("marketplace pickup transaction boundary", () => {
  it("uses one propagated transaction for challenge, custody, bridge and receipts", () => {
    const handoff = source("lib/store-orders/store-order.service.ts");
    expect(handoff).toContain("lockMarketplacePickup");
    expect(handoff).toContain("completeMarketplacePickupInTx");
    expect(handoff).toContain('status: "PICKED_UP"');
    expect(handoff).toContain('type: "HANDOFF_VERIFY"');
    expect(handoff).not.toContain("STORE_PICKUP_HANDOFF_CANONICAL_FAILED");
  });

  it("prevents the generic pickup endpoint from bypassing a marketplace handoff", () => {
    const custody = source("lib/services/pickup-custody.service.ts");
    expect(custody).toContain("Marketplace pickups must be completed through the verified store handoff.");
    expect(custody).toContain("createOperationReceiptInTx(tx");
    expect(custody).toContain("completeOperationReceiptInTx(tx");
  });
});
