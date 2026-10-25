import { describe, expect, it } from "vitest";
import { QuoteBookingSchema } from "@/lib/client-platform/contracts";

const contacts = {
  pickupContactName: "Disposable sender", pickupContactPhone: "+27820000000",
  pickupContactEmail: "sender@ktcouriers.local", recipientName: "Disposable recipient",
  recipientPhone: "+27820000001", recipientEmail: "recipient@ktcouriers.local",
};
describe("public personal parcel booking contract", () => {
  it("accepts fully populated contact details for 100% cash choice", () => {
    expect(QuoteBookingSchema.safeParse({ ...contacts, paymentMethod: "FULL_COD" }).success).toBe(true);
  });
  it("rejects the legacy 50/50 parcel payment choice before creating an order", () => {
    expect(QuoteBookingSchema.safeParse({ ...contacts, paymentMethod: "DEPOSIT_PLUS_COD" }).success).toBe(false);
  });
  it("requires both sender and recipient email addresses", () => {
    expect(QuoteBookingSchema.safeParse({ ...contacts, recipientEmail: "" }).success).toBe(false);
    expect(QuoteBookingSchema.safeParse({ ...contacts, pickupContactEmail: "" }).success).toBe(false);
  });
});
