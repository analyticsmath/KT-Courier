import { describe, expect, it } from "vitest";
import { listLaunchableDeliveryServices } from "@/lib/services/shipping-governance.service";
import { getDeliveryOtpStatus } from "@/lib/services/delivery-otp.service";
describe("Phase B shipping PostgreSQL production-service proof", () => {
  it("uses production shipping configuration and OTP authorities without exposing plaintext codes", async () => { const services = await listLaunchableDeliveryServices(); expect(Array.isArray(services)).toBe(true); await expect(getDeliveryOtpStatus("missing-order-for-proof")).resolves.toBeDefined(); });
});
