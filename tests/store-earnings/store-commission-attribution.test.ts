import { describe, expect, it } from "vitest";
import { validateStoreSettlementSnapshot } from "@/lib/store-earnings/store-settlement-snapshot";
import { settlementSnapshot } from "./fixtures";

describe("store commission attribution", () => {
  it("accepts multiple exact charge links", () => expect(validateStoreSettlementSnapshot(settlementSnapshot({ commissionCharges: [{ commissionAllocationId: "a-1", commissionAllocationPublicReference: "CA-1", amount: "4.00", currency: "ZAR" }, { commissionAllocationId: "a-2", commissionAllocationPublicReference: "CA-2", amount: "6.00", currency: "ZAR" }] })).commissionCharges).toHaveLength(2));
  it("rejects duplicate allocation attribution", () => expect(() => validateStoreSettlementSnapshot(settlementSnapshot({ commissionCharges: [{ commissionAllocationId: "a-1", commissionAllocationPublicReference: "CA-1", amount: "5.00", currency: "ZAR" }, { commissionAllocationId: "a-1", commissionAllocationPublicReference: "CA-1", amount: "5.00", currency: "ZAR" }] }))).toThrow(/only once/i));
  it("rejects charge totals different from attributed commission", () => expect(() => validateStoreSettlementSnapshot(settlementSnapshot({ commissionCharges: [{ commissionAllocationId: "a-1", commissionAllocationPublicReference: "CA-1", amount: "9.99", currency: "ZAR" }] }))).toThrow(/evidence/i));
});
