import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { QuoteBookingSchema } from "@/lib/client-platform/contracts";

const booking = {
  pickupContactName: "Sender Example",
  pickupContactPhone: "0821234567",
  pickupContactEmail: "sender@example.com",
  recipientName: "Recipient Example",
  recipientPhone: "0827654321",
};

describe("parcel recipient email required for handover OTP", () => {
  it("rejects bookings missing a recipient mailbox", () => {
    expect(QuoteBookingSchema.safeParse(booking).success).toBe(false);
    expect(QuoteBookingSchema.safeParse({ ...booking, recipientEmail: "" }).success).toBe(false);
    expect(QuoteBookingSchema.safeParse({ ...booking, recipientEmail: "incorrect" }).success).toBe(false);
  });
  it("accepts a complete booking with sender and recipient contacts", () => {
    expect(QuoteBookingSchema.safeParse({ ...booking, recipientEmail: "receiver@example.com" }).success).toBe(true);
  });
  it("maintains a required recipient email field in the customer quote form", () => {
    const form = readFileSync(new URL("../../components/forms/PublicDeliveryQuoteForm.tsx", import.meta.url), "utf8");
    expect(form).toContain('"recipientEmail", "Recipient email for delivery code"');
    expect(form).toContain("required");
  });
});
