import { describe, expect, it } from "vitest";
import { CreateOrderSchema } from "@/lib/validation/order";
import { DeliveryType } from "@/types/db";

const parcel = {
  pricingQuoteId: "cmvl5vrkm003g3h3ml27btiub",
  deliveryType: DeliveryType.PARCEL_DOCUMENT,
  pickupAddress: { line1: "6 Watkins Street, Johannesburg" },
  dropoffAddress: { line1: "681 Esther Street, Pretoria" },
  recipientName: "Parcel recipient",
  recipientPhone: "0829999000",
  senderEmail: "sender@example.test",
  recipientEmail: "receiver@example.test",
};

describe("direct parcel booking email safety before custody enforcement", () => {
  it("accepts parcel orders with both handover destinations", () => {
    expect(CreateOrderSchema.safeParse(parcel).success).toBe(true);
  });
  it("rejects a parcel booking without a sender email", () => {
    const result = CreateOrderSchema.safeParse({ ...parcel, senderEmail: undefined });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some(i => i.path.includes("senderEmail"))).toBe(true);
  });
  it("rejects a parcel booking without a delivery recipient email", () => {
    const result = CreateOrderSchema.safeParse({ ...parcel, recipientEmail: undefined });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some(i => i.path.includes("recipientEmail"))).toBe(true);
  });
  it("does not retroactively impose parcel-specific email rules on other delivery types", () => {
    expect(CreateOrderSchema.safeParse({ ...parcel, deliveryType: DeliveryType.SAME_DAY, senderEmail: undefined, recipientEmail: undefined }).success).toBe(true);
  });
});
