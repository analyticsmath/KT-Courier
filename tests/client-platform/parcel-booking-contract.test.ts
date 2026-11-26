import { describe, expect, it } from "vitest";
import { QuoteBookingSchema } from "@/lib/client-platform/contracts";

const contacts = {
  pickupContactName: "Disposable sender", pickupContactPhone: "+27820000000",
  pickupContactEmail: "sender@ktcouriers.local", recipientName: "Disposable recipient",
  recipientPhone: "+27820000001", recipientEmail: "recipient@ktcouriers.local",
};

describe("public personal parcel booking contract", () => {
  it("rejects discontinued 100% FULL_COD selection on new public bookings", () => {
    expect(QuoteBookingSchema.safeParse({ ...contacts, paymentMethod: "FULL_COD" }).success).toBe(false);
  });

  it("parses a 50/50 request, leaving actual permission to the independently approved server policy", () => {
    expect(QuoteBookingSchema.safeParse({ ...contacts, paymentMethod: "DEPOSIT_PLUS_COD" }).success).toBe(true);
    expect(QuoteBookingSchema.safeParse({ ...contacts, paymentMethod: "DIGITAL_ONLY" }).success).toBe(true);
  });

  it("requires both sender and recipient email addresses", () => {
    expect(QuoteBookingSchema.safeParse({ ...contacts, recipientEmail: "" }).success).toBe(false);
    expect(QuoteBookingSchema.safeParse({ ...contacts, pickupContactEmail: "" }).success).toBe(false);
  });
});
