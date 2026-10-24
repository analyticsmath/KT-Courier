import { describe, expect, it } from "vitest";
import { QuoteBookingSchema } from "@/lib/client-platform/contracts";
import { CreateOrderSchema } from "@/lib/validation/order";
const booking = { pickupContactName: "Sender Person", pickupContactPhone: "+27820000001", pickupContactEmail: "sender@example.test", recipientName: "Recipient Person", recipientPhone: "+27820000002" };
describe("parcel recipient email capture", () => {
  it("normalizes the intended recipient independently of the sender", () => {
    expect(QuoteBookingSchema.parse({ ...booking, recipientEmail: "  Receiver@Example.TEST " }).recipientEmail).toBe("receiver@example.test");
    expect(CreateOrderSchema.shape.recipientEmail.parse(" Receiver@Example.TEST ")).toBe("receiver@example.test");
  });
  it("rejects invalid and oversized addresses in both booking entry points", () => {
    for (const recipientEmail of ["invalid", "a\r\nb@example.test", `${"a".repeat(255)}@example.test`]) {
      expect(QuoteBookingSchema.safeParse({ ...booking, recipientEmail }).success).toBe(false);
      expect(CreateOrderSchema.shape.recipientEmail.safeParse(recipientEmail).success).toBe(false);
    }
  });
  it("requires an email for every new parcel booking; historical orders remain stored unchanged", () => {
    expect(QuoteBookingSchema.safeParse(booking).success).toBe(false);
  });
});

describe("parcel booking payment modes", () => {
  it("accepts full cash and full online but never a 50/50 deposit", () => {
    const details = { ...booking, recipientEmail: "receiver@example.com", pickupContactEmail: "sender@example.com" };
    expect(QuoteBookingSchema.safeParse({ ...details, paymentMethod: "FULL_COD" }).success).toBe(true);
    expect(QuoteBookingSchema.safeParse({ ...details, paymentMethod: "DIGITAL_ONLY" }).success).toBe(true);
    expect(QuoteBookingSchema.safeParse({ ...details, paymentMethod: "DEPOSIT_PLUS_COD" }).success).toBe(false);
  });
});
