import { describe, expect, it } from "vitest";
import { validateStoreSettlementSnapshot } from "@/lib/store-earnings/store-settlement-snapshot";
import { settlementSnapshot } from "./fixtures";

describe("authoritative store settlement snapshot", () => {
  it("normalizes exact ZAR values and preserves opaque subject evidence", () => {
    const snapshot = validateStoreSettlementSnapshot(settlementSnapshot({ sellerSettlementBasisAmount: "100", attributedCommissionAmount: "10", netStoreEarningAmount: "90" }));
    expect(snapshot).toMatchObject({ subjectType: "MARKETPLACE_ORDER", sellerSettlementBasisAmount: "100.00", attributedCommissionAmount: "10.00", netStoreEarningAmount: "90.00" });
    expect(Object.isFrozen(snapshot)).toBe(true);
  });
  it("rejects a client-like formula mismatch", () => expect(() => validateStoreSettlementSnapshot(settlementSnapshot({ netStoreEarningAmount: "89.99" }))).toThrow(/basis minus attributed commission/i));
  it("requires canonical authoritative time", () => expect(() => validateStoreSettlementSnapshot(settlementSnapshot({ authoritativeAt: "2026-07-18" }))).toThrow(/canonical ISO/i));
});
