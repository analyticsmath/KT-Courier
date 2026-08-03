import { expect, it } from "vitest";
import { assertDriverEarningsProductionReady, DRIVER_EARNINGS_PRODUCTION_VALIDATION_APPROVED } from "@/lib/driver-earnings/driver-earning-production-readiness";
it("is source locked", () => { expect(DRIVER_EARNINGS_PRODUCTION_VALIDATION_APPROVED).toBe(false); expect(() => assertDriverEarningsProductionReady()).toThrow(); });
it("allows only explicit in-process test bypass", () => expect(() => assertDriverEarningsProductionReady({ allowTestOnlyBypass: true })).not.toThrow());
