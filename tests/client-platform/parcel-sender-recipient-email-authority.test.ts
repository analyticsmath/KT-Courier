import { describe, expect, it, vi } from "vitest";
import { QuoteBookingSchema } from "@/lib/client-platform/contracts";
import { CreateOrderSchema } from "@/lib/validation/order";
import { resolvePickupOtpSender } from "@/lib/services/delivery-recipient.service";
import { readFileSync } from "node:fs";

const booking = {
  pickupContactName: "Parcel Origin",
  pickupContactPhone: "0821234567",
  recipientName: "Parcel Destination",
  recipientPhone: "0827654321",
  recipientEmail: "receiver@example.test",
};

describe("parcel sender and recipient have independent required mailboxes", () => {
  it("requires distinct sender email input in the public booking contract", () => {
    expect(QuoteBookingSchema.safeParse(booking).success).toBe(false);
    expect(QuoteBookingSchema.safeParse({ ...booking, pickupContactEmail: "sender@example.test" }).success).toBe(true);
    expect(QuoteBookingSchema.safeParse({ ...booking, pickupContactEmail: "not-email" }).success).toBe(false);
    expect(CreateOrderSchema.shape.senderEmail.safeParse("sender@example.test").success).toBe(true);
  });

  it("keeps the sender address with the booking's non-financial snapshot", () => {
    const service = readFileSync(new URL("../../lib/services/orders.service.ts", import.meta.url), "utf8");
    const bookingRoute = readFileSync(new URL("../../app/api/public/delivery-quotes/[id]/book/route.ts", import.meta.url), "utf8");
    const ui = readFileSync(new URL("../../components/forms/PublicDeliveryQuoteForm.tsx", import.meta.url), "utf8");
    expect(service).toContain("senderContact: { email: input.senderEmail ?? null }");
    expect(bookingRoute).toContain("senderEmail: pickupContactEmail");
    expect(ui).toContain('"pickupContactEmail", "Sender email for pickup code"');
    expect(ui).toContain('"recipientEmail", "Recipient email for delivery code"');
  });

  it("never silently substitutes the booking account for an explicit third-party sender", async () => {
    const row = {
      id: "order-new", status: "PICKUP_SCHEDULED", customerId: "booker",
      pickupAddress: { contactName: "True Parcel Sender" },
      pricingSnapshot: { senderContact: { email: "true-sender@example.test" } },
      customer: { id: "booker", email: "booker@example.test", name: "Booker", status: "ACTIVE", emailVerifiedAt: new Date() },
    };
    const db = {
      order: { findUnique: vi.fn().mockResolvedValue(row) },
      marketplaceStoreOrderDeliveryBridge: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const recipient = await resolvePickupOtpSender("order-new", db as never);
    expect(recipient).toMatchObject({ kind: "SHIPMENT_SENDER", email: "true-sender@example.test", name: "True Parcel Sender" });
    expect(recipient.subjectUserId).not.toContain("booker");
    expect(recipient.subjectUserId).toContain("pickup-sender:order-new:");
  });

  it("rejects the parcel sender resolver for marketplace bridge orders", async () => {
    const db = {
      order: { findUnique: vi.fn().mockResolvedValue({ id: "order", status: "PICKUP_SCHEDULED", pricingSnapshot: { senderContact: { email: "x@example.test" } } }) },
      marketplaceStoreOrderDeliveryBridge: { findUnique: vi.fn().mockResolvedValue({ id: "bridge" }) },
    };
    await expect(resolvePickupOtpSender("order", db as never)).rejects.toThrow();
  });
});
