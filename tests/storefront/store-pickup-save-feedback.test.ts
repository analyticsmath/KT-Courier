import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("merchant collection save never implies live checkout", () => {
  it("executes an independent server-side preflight after saving without undoing a committed pickup", () => {
    const handler = readFileSync("app/api/store/pickup-address/route.ts", "utf8");
    expect(handler).toContain("await upsertStorePickupAddress(user.id, parsed.data)");
    expect(handler).toContain("await getStorePickupOperationalPreflight(savedState.store.id)");
    expect(handler).toContain("return ok({ pickupAddress, readiness })");
    expect(handler).not.toMatch(/await setStoreStatus\(/);
  });
  it("explains status on the merchant page and never labels pickup-area evidence as a completed checkout", () => {
    const component = readFileSync("components/store/StorePickupAddressManager.tsx", "utf8");
    expect(component).toContain("Collection area check:");
    expect(component).toContain("Saving an address does not activate your store.");
    expect(component).toContain("the actual destination road route");
    expect(component).toContain("PICKUP_COVERAGE_UNVERIFIED");
  });
});
