import { describe, expect, it, vi } from "vitest";
import { recoverCommittedParcelBooking } from "@/lib/client-platform/parcel-booking-recovery";
import { QuoteBookingSchema } from "@/lib/client-platform/contracts";

const booking = QuoteBookingSchema.parse({
  pickupContactName: "Verified Sender",
  pickupContactPhone: "0821234567",
  pickupContactEmail: "Sender@Example.test",
  recipientName: "Verified Recipient",
  recipientPhone: "0827654321",
  recipientEmail: "Receiver@Example.test",
  parcelDescription: "Two folded shirts",
  paymentMethod: "DIGITAL_ONLY",
});

function savedOrder(mode: "DIGITAL_ONLY" | "FULL_COD" = "DIGITAL_ONLY") {
  const now = new Date("2026-11-12T12:00:00Z");
  const address = {
    id: "address-owned", type: "PICKUP", line1: "10 Verified Street",
    line2: "Rosebank", city: "Johannesburg", province: "Gauteng",
    postalCode: "2196", country: "South Africa",
    contactName: booking.pickupContactName, contactPhone: booking.pickupContactPhone,
    latitude: -26.15, longitude: 28.04, createdAt: now, updatedAt: now,
  };
  return {
    id: "order-owned", orderNumber: "KT-2026-TEST", source: "CUSTOMER",
    status: "PENDING", deliveryType: "PARCEL_DOCUMENT", currency: "ZAR",
    customerId: "user-123", storeId: null,
    recipientName: booking.recipientName, recipientPhone: booking.recipientPhone,
    recipientEmail: booking.recipientEmail, parcelDescription: booking.parcelDescription,
    parcelCount: 1, scheduledFor: null,
    pickupAddress: address,
    dropoffAddress: { ...address, id: "address-destination", type: "DROPOFF" },
    pricingSnapshot: { senderContact: { email: booking.pickupContactEmail } },
    cashOnDelivery: mode === "DIGITAL_ONLY" ? null : { policyMode: mode },
    statusHistory: [], customer: null, store: null, deliveryRegion: null,
    createdAt: now, updatedAt: now,
  };
}

function fakeDatabase(order: ReturnType<typeof savedOrder> | null) {
  const findFirst = vi.fn().mockResolvedValue(order);
  return { order: { findFirst } };
}

describe("lost parcel booking response: fail-safe canonical replay", () => {
  it("returns the exact existing customer order without a second charge or order mutation", async () => {
    const db = fakeDatabase(savedOrder());
    const result = await recoverCommittedParcelBooking(
      { quoteId: "quote-123", userId: "user-123", storeId: null, booking },
      db as never,
    );
    expect(result?.id).toBe("order-owned");
    expect(result?.orderNumber).toBe("KT-2026-TEST");
    expect(db.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        pricingQuoteId: "quote-123",
        customerId: "user-123",
        storeId: null,
        source: "CUSTOMER",
        pricingQuote: {
          ownerId: "user-123",
          ownerType: "CUSTOMER",
          storeId: null,
          status: "USED",
          calculationVersion: "client-delivery-v1",
        },
      }),
    }));
    expect(db.order.findFirst).toHaveBeenCalledTimes(1);
  });

  it("never recovers an uncommitted or inaccessible order", async () => {
    const db = fakeDatabase(null);
    await expect(recoverCommittedParcelBooking(
      { quoteId: "quote-not-owned", userId: "user-123", storeId: null, booking },
      db as never,
    )).resolves.toBeNull();
  });

  it("rejects changed recipient and sender OTP details on replay", async () => {
    for (const field of ["recipientPhone", "pickupContactEmail", "parcelDescription"] as const) {
      const db = fakeDatabase(savedOrder());
      await expect(recoverCommittedParcelBooking({
        quoteId: "quote-123", userId: "user-123", storeId: null,
        booking: { ...booking, [field]: "changed-safely@example.test" },
      }, db as never)).rejects.toMatchObject({ code: "BOOKING_REPLAY_MISMATCH", status: 409 });
    }
  });

  it("does not let a retry switch an existing digital booking into cash or vice versa", async () => {
    await expect(recoverCommittedParcelBooking({
      quoteId: "quote-123", userId: "user-123", storeId: null,
      booking: { ...booking, paymentMethod: "FULL_COD" },
    }, fakeDatabase(savedOrder()) as never)).rejects.toMatchObject({ code: "BOOKING_REPLAY_MISMATCH" });
    await expect(recoverCommittedParcelBooking({
      quoteId: "quote-123", userId: "user-123", storeId: null,
      booking,
    }, fakeDatabase(savedOrder("FULL_COD")) as never)).rejects.toMatchObject({ code: "BOOKING_REPLAY_MISMATCH" });
  });

  it("restricts staff recovery to the exact authorized store and original booking actor", async () => {
    const db = fakeDatabase(null);
    await recoverCommittedParcelBooking({
      quoteId: "store-quote", userId: "store-staff", storeId: "store-A", booking,
    }, db as never);
    expect(db.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        storeId: "store-A",
        source: "STORE",
        pricingQuote: expect.objectContaining({
          ownerId: "store-staff",
          ownerType: "STORE",
          storeId: "store-A",
        }),
      }),
    }));
  });
});
