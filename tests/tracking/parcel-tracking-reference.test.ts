import { describe, expect, it } from "vitest";
import { normalizeParcelTrackingReference, parseDeliveryTrackingReference, trackingLoginReturnUrl } from "@/lib/tracking/parcel-tracking-reference";
describe("short public parcel tracking reference", () => {
  it("normalizes the owner-entered ordinary and collision-fallback references", () => {
    expect(normalizeParcelTrackingReference(" kt-2026-001234 ")).toBe("KT-2026-001234");
    expect(normalizeParcelTrackingReference("kt-2026-9a4bcde2")).toBe("KT-2026-9A4BCDE2");
  });
  it("rejects guessed primary keys, long free-text, path traversal and malformed references", () => {
    for (const value of ["", "KT-2026-123", "KT-2026-123456789", "../../../admin", "order_abc", "KT-2026-12/456", "KT-2026-100 100"]) {
      expect(normalizeParcelTrackingReference(value)).toBeNull();
    }
  });
});


describe("owner-safe tracking number lookup", () => {
  it("routes parcel numbers to parcel owner lookup", () => {
    expect(parseDeliveryTrackingReference(" kt-2026-000123 ")).toEqual({ kind: "PARCEL", reference: "KT-2026-000123" });
  });
  it("accepts canonical marketplace order confirmation references without accidentally changing their case", () => {
    const reference = "morder_" + "a".repeat(32);
    expect(parseDeliveryTrackingReference(reference)).toEqual({ kind: "MARKETPLACE", reference });
  });
  it("rejects guessable unrelated order or internal identifiers", () => {
    for (const value of ["morder_nothex", "msorder_" + "a".repeat(32), "morder_" + "a".repeat(33), "../morder_a", "KT-2026-12", "//evil.test"]) {
      expect(parseDeliveryTrackingReference(value)).toBeNull();
    }
  });
  it("preserves valid references and the requested workspace in a same-origin login return URL", () => {
    const parcel = parseDeliveryTrackingReference("kt-2026-001234")!;
    expect(trackingLoginReturnUrl(parcel, false)).toBe("/track?reference=KT-2026-001234");
    expect(trackingLoginReturnUrl(parcel, true)).toBe("/track?reference=KT-2026-001234&workspace=store");
    const marketplace = parseDeliveryTrackingReference("morder_" + "b".repeat(32))!;
    expect(trackingLoginReturnUrl(marketplace, false)).toBe("/track?reference=morder_" + "b".repeat(32));
  });
});
