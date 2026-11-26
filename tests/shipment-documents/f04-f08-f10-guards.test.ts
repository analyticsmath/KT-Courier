import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { QuoteBookingSchema } from "@/lib/client-platform/contracts";
import { CreateOrderSchema } from "@/lib/validation/order";
import {
  assertParcelPaymentChoice,
  assertSelectedPaymentMode,
} from "@/lib/payments/parcel-payment-method-selection";
import { PaymentConfigurationSchema } from "@/lib/client-platform/payment-configuration.service";
import { isOrderNumberUniqueConstraintError } from "@/lib/utils/order-number";

describe("F04, F08 & F10 Commercial Integrity Guards", () => {
  it("F04: detects Prisma P2002 orderNumber unique collisions vs other unique keys", () => {
    const orderNumErr = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "5.22.0",
      meta: { target: ["orderNumber"] },
    });
    const otherErr = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "5.22.0",
      meta: { target: ["pricingQuoteId"] },
    });
    expect(isOrderNumberUniqueConstraintError(orderNumErr)).toBe(true);
    expect(isOrderNumberUniqueConstraintError(otherErr)).toBe(false);
  });

  it("F08: rejects unpriced parcelCount > 1 on CreateOrderSchema while permitting parcelCount === 1", () => {
    const base = {
      pricingQuoteId: "cm12345678901234567890123",
      deliveryType: "SAME_DAY" as const,
      pickupAddress: { line1: "14 Commissioner Street", city: "Johannesburg" },
      dropoffAddress: { line1: "72 Rivonia Road", city: "Sandton" },
      recipientName: "Recipient Test",
      recipientPhone: "+27821234567",
      paymentMethod: "DIGITAL_ONLY" as const,
    };

    expect(CreateOrderSchema.safeParse({ ...base, parcelCount: 1 }).success).toBe(true);
    expect(CreateOrderSchema.safeParse({ ...base, parcelCount: 2 }).success).toBe(false);
    expect(CreateOrderSchema.safeParse({ ...base, parcelCount: 5 }).success).toBe(false);
  });

  it("F10: retires FULL_COD across contracts, validation, selection, and policy creation while preserving 50/50 DEPOSIT_PLUS_COD", () => {
    const quoteContacts = {
      pickupContactName: "Sender Test",
      pickupContactPhone: "+27821112222",
      pickupContactEmail: "sender@example.com",
      recipientName: "Recipient Test",
      recipientPhone: "+27823334444",
      recipientEmail: "recipient@example.com",
    };

    expect(
      QuoteBookingSchema.safeParse({ ...quoteContacts, paymentMethod: "DIGITAL_ONLY" }).success,
    ).toBe(true);
    expect(
      QuoteBookingSchema.safeParse({ ...quoteContacts, paymentMethod: "DEPOSIT_PLUS_COD" }).success,
    ).toBe(true);
    expect(
      QuoteBookingSchema.safeParse({ ...quoteContacts, paymentMethod: "FULL_COD" }).success,
    ).toBe(false);

    expect(() => assertParcelPaymentChoice("PARCEL_DOCUMENT", "FULL_COD")).toThrow(
      /discontinued/i,
    );
    expect(() => assertParcelPaymentChoice("PARCEL_DOCUMENT", "DEPOSIT_PLUS_COD")).not.toThrow();
    expect(() => assertSelectedPaymentMode("FULL_COD", "FULL_COD")).toThrow(/discontinued/i);

    const valid5050Policy = {
      storeId: null,
      deliveryServiceId: "CLIENT_PARCEL_DOCUMENT",
      provinces: ["Gauteng"],
      regionId: null,
      orderId: null,
      orderType: "PARCEL_DOCUMENT" as const,
      mode: "DEPOSIT_PLUS_COD" as const,
      depositPercent: "0.5000",
      maximumCodAmount: "1500.00",
      active: false,
      expectedVersion: 0,
      reason: "Configure approved 50% online + 50% driver cash scheme.",
    };
    expect(PaymentConfigurationSchema.safeParse(valid5050Policy).success).toBe(true);
    expect(
      PaymentConfigurationSchema.safeParse({
        ...valid5050Policy,
        mode: "FULL_COD",
        depositPercent: null,
      }).success,
    ).toBe(false);
  });
});
