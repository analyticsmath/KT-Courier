import { expect, it } from "vitest";
import { hashDriverEarningCalculation } from "@/lib/driver-earnings/driver-earning-idempotency";
import { settlement } from "./fixtures";
it("hashes canonical sorted charge evidence", () => expect(hashDriverEarningCalculation(settlement())).toBe(hashDriverEarningCalculation(settlement())));
it("changes when assignment version changes", () => expect(hashDriverEarningCalculation(settlement({ assignmentVersion: "8" }))).not.toBe(hashDriverEarningCalculation(settlement())));
