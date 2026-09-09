import { describe, expect, it } from "vitest";
import { buildOwnedPayfastCheckoutAction } from "@/lib/services/payfast-checkout.service";

describe("Payfast checkout reconstruction service", () => {
  it("fails closed indicating Payfast is no longer supported", async () => {
    await expect(buildOwnedPayfastCheckoutAction("payer-id", "pat_123")).rejects.toMatchObject({
      code: "PAYMENT_PROVIDER_NOT_SUPPORTED",
    });
  });
});

