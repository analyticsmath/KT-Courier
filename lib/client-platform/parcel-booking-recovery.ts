import { prisma } from "@/lib/db/prisma";
import { toOrderDetailDto, type OrderDetailDto } from "@/lib/dto/order.dto";
import { PlatformError, type QuoteBookingInput } from "@/lib/client-platform/contracts";

/**
 * Recover only a fully committed, canonical parcel order when the booking HTTP
 * response was lost. This neither creates an order nor changes a payment.
 * Caller must already have proved permission for the requested STORE workspace.
 */
export async function recoverCommittedParcelBooking(
  input: Readonly<{
    quoteId: string;
    userId: string;
    storeId: string | null;
    booking: QuoteBookingInput;
  }>,
  database: Pick<typeof prisma, "order"> = prisma,
): Promise<OrderDetailDto | null> {
  const business = input.storeId !== null;
  const order = await database.order.findFirst({
    where: {
      pricingQuoteId: input.quoteId,
      deliveryType: "PARCEL_DOCUMENT",
      source: business ? "STORE" : "CUSTOMER",
      ...(business
        ? { storeId: input.storeId }
        : { customerId: input.userId, storeId: null }),
      pricingQuote: {
        ownerId: input.userId,
        ownerType: business ? "STORE" : "CUSTOMER",
        storeId: input.storeId,
        status: "USED",
        calculationVersion: "client-delivery-v1",
      },
    },
    include: {
      pickupAddress: true,
      dropoffAddress: true,
      deliveryRegion: { select: { name: true } },
      statusHistory: {
        include: { actorUser: true },
        orderBy: { createdAt: "asc" },
      },
      customer: true,
      store: true,
      cashOnDelivery: { select: { policyMode: true } },
    },
  });
  if (!order) return null;

  const sender = order.pricingSnapshot as {
    senderContact?: { email?: string | null };
  } | null;
  const requestedSchedule = input.booking.scheduledFor
    ? new Date(input.booking.scheduledFor).toISOString()
    : null;
  const storedSchedule = order.scheduledFor?.toISOString() ?? null;
  const actualPaymentMode = order.cashOnDelivery?.policyMode ?? "DIGITAL_ONLY";
  const requestedPaymentMode = input.booking.paymentMethod ?? "DIGITAL_ONLY";

  // A quote is single-use. Do not let a changed request silently inherit the
  // original recipient, cash obligation, sender's OTP or payment destination.
  if (
    order.pickupAddress?.contactName !== input.booking.pickupContactName ||
    order.pickupAddress?.contactPhone !== input.booking.pickupContactPhone ||
    sender?.senderContact?.email !== input.booking.pickupContactEmail ||
    order.recipientName !== input.booking.recipientName ||
    order.recipientPhone !== input.booking.recipientPhone ||
    order.recipientEmail !== input.booking.recipientEmail ||
    (order.parcelDescription ?? "") !== (input.booking.parcelDescription ?? "") ||
    storedSchedule !== requestedSchedule ||
    actualPaymentMode !== requestedPaymentMode
  ) {
    throw new PlatformError(
      "BOOKING_REPLAY_MISMATCH",
      "This quote already has a booking with different contact or payment details. Open your existing orders instead of booking again.",
      409,
    );
  }
  return toOrderDetailDto(order);
}
