import { describe, expect, it } from "vitest";
import { RequestDeliveryOtpSchema } from "@/lib/validation/delivery";
describe("delivery OTP API contract", () => { it("requires a replay-safe command ID", () => { expect(RequestDeliveryOtpSchema.safeParse({}).success).toBe(false); }); });
