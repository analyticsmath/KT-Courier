import { storeAccess } from "@/lib/client-platform/store-access";
import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";

import { readPublicQuote } from "@/lib/client-platform/delivery.service";
import {
  QuoteBookingSchema,
  PlatformError,
} from "@/lib/client-platform/contracts";
import { prisma } from "@/lib/db/prisma";
import { createOrder } from "@/lib/services/orders.service";
import { CreateOrderSchema } from "@/lib/validation/order";
import { json, failure, mutation } from "@/lib/client-platform/api";
export async function POST(
  req: NextRequest,
  c: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Sign in to book your delivery." }, 401);
  if (!["CUSTOMER", "STORE"].includes(user.role))
    return json({ error: "A customer or business account is required." }, 403);
  const body = await mutation(req, `public-quote-book:${user.id}`);
  if ("response" in body) return body.response;
  const parsed = QuoteBookingSchema.safeParse(body.body);
  if (!parsed.success)
    return json(
      {
        error:
          "Provide sender and recipient contact details and a future collection time if scheduled.",
      },
      422,
    );
  try {
    const id = (await c.params).id;
    const quote = await readPublicQuote(id, user.id);
    const business =
      user.role === "STORE" || req.headers.get("X-KT-Workspace") === "STORE";
    const store = business
      ? (await storeAccess(user.id, "deliveries")).store
      : null;
    if (business && !store)
      throw new PlatformError("STORE_NOT_FOUND", "Business not found.", 403);
    if (
      quote.ownerId === user.id &&
      (quote.storeId ?? null) !== (store?.id ?? null)
    )
      throw new PlatformError(
        "QUOTE_WORKSPACE_MISMATCH",
        "Request a new quote in this workspace.",
        409,
      );
    const claimed = await prisma.pricingQuote.updateMany({
      where: {
        id,
        ownerId: quote.ownerId,
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
        calculationVersion: "client-delivery-v1",
      },
      data: {
        ownerId: user.id,
        ownerType: business ? "STORE" : "CUSTOMER",
        storeId: store?.id ?? null,
      },
    });
    if (claimed.count !== 1)
      throw new PlatformError(
        "QUOTE_EXPIRED",
        "Request a new quote before booking.",
        409,
      );
    const m = quote.metadata as {
      bookingInput: {
        deliveryType: "PARCEL_DOCUMENT";
        pickupAddress: Record<string, unknown>;
        dropoffAddress: Record<string, unknown>;
        actualWeightKg: string;
      };
    };
    const { pickupContactName, pickupContactPhone, ...booking } = parsed.data;
    const input = CreateOrderSchema.parse({
      ...m.bookingInput,
      ...booking,
      pickupAddress: {
        ...m.bookingInput.pickupAddress,
        contactName: pickupContactName,
        contactPhone: pickupContactPhone,
      },
      pricingQuoteId: id,
      parcelCount: 1,
    });
    // Strict order schema excludes sender helper fields rather than accepting extra client facts.
    return json(await createOrder(user, input, business), 201);
  } catch (e) {
    return failure(e);
  }
}
