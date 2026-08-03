import { expect, it } from "vitest";
import { validateDriverSettlementSnapshot } from "@/lib/driver-earnings/driver-settlement-snapshot";
import { settlement } from "./fixtures";
it("validates exact assignment delivery arithmetic", () => expect(validateDriverSettlementSnapshot(settlement()).netDriverEarningAmount).toBe("90.00"));
it("rejects payment-total-style or charge mismatch inference", () => expect(() => validateDriverSettlementSnapshot(settlement({ netDriverEarningAmount: "91.00" }))).toThrow());
