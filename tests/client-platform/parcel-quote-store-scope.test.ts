import { describe, expect, it } from "vitest";
import { assertQuoteStoreScope } from "@/lib/client-platform/parcel-quote-store-scope";

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
