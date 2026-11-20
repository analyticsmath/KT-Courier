import { describe, expect, it } from "vitest";
import { assertQuoteStoreScope, resolveBookingStoreId } from "@/lib/client-platform/parcel-quote-store-scope";

describe("parcel quote store scope", () => {
  it("accepts the store bound to a quote and rejects a different or missing store", () => {
    expect(() => assertQuoteStoreScope("store-a", "store-a")).not.toThrow();
    expect(() => assertQuoteStoreScope("store-a", "store-b")).toThrow(/workspace/i);
    expect(() => assertQuoteStoreScope("store-a", null)).toThrow(/workspace/i);
  });
  it("keeps legacy quotes without a store binding usable", () => {
    expect(() => assertQuoteStoreScope(null, "store-a")).not.toThrow();
    expect(() => assertQuoteStoreScope(null, null)).not.toThrow();
  });
});

describe("booking store selection", () => {
  it("uses the server-bound store when a link omits it", () => {
    expect(resolveBookingStoreId("store-a", null)).toBe("store-a");
  });
  it("rejects a conflicting URL instead of changing the quote's store", () => {
    expect(() => resolveBookingStoreId("store-a", "store-b")).toThrow(/workspace/i);
  });
  it("requires an explicit choice for legacy quotes", () => {
    expect(resolveBookingStoreId(null, null)).toBeNull();
    expect(resolveBookingStoreId(null, "store-b")).toBe("store-b");
  });
});
