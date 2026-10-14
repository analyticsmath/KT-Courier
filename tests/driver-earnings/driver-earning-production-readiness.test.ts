import { expect, it } from "vitest";
import { assertDriverEarningsProductionReady, DRIVER_EARNINGS_PRODUCTION_VALIDATION_APPROVED } from "@/lib/driver-earnings/driver-earning-production-readiness";
it("releases reviewed driver earnings without an environment bypass", () => { expect(DRIVER_EARNINGS_PRODUCTION_VALIDATION_APPROVED).toBe(true); expect(() => assertDriverEarningsProductionReady()).not.toThrow(); });
it("allows only explicit in-process test bypass", () => expect(() => assertDriverEarningsProductionReady({ allowTestOnlyBypass: true })).not.toThrow());
