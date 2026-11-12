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
import { requireParcelProfile } from "@/lib/commercial/parcel-profiles";
import { assertStoreParcelPickupMatches } from "@/lib/client-platform/store-parcel-pickup-authority";
import { getStorePickupAddressForStore } from "@/lib/services/store-addresses.service";
import { recoverCommittedParcelBooking } from "@/lib/client-platform/parcel-booking-recovery";
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
    const business = user.role === "STORE" || req.headers.get("X-KT-Workspace") === "STORE";
    const store = business ? (await storeAccess(user.id, "deliveries")).store : null;
    if (business && !store) throw new PlatformError("STORE_NOT_FOUND", "Business not found.", 403);
    const replayInput = { quoteId: id, userId: user.id, storeId: store?.id ?? null, booking: parsed.data };
    // The first POST may have committed even if the HTTP response was lost.
    // Recovery is read-only, owner-scoped and checks identical booking facts.
    const recovered = await recoverCommittedParcelBooking(replayInput);
    if (recovered) return json(recovered, 200);
    let quote;
    try {
      quote = await readPublicQuote(id, user.id);
    } catch (cause) {
      // Concurrent completion between the recovery lookup and the quote read.
      if (cause instanceof PlatformError && cause.code === "QUOTE_EXPIRED") {
        const committed = await recoverCommittedParcelBooking(replayInput);
        if (committed) return json(committed, 200);
      }
      throw cause;
    }
    const parcel = quote.ruleSnapshot as { parcelSize: string; parcelProfileId?: string };
    const profile = await requireParcelProfile(parcel.parcelSize, String((quote.metadata as { bookingInput?: { actualWeightKg?: string } }).bookingInput?.actualWeightKg ?? "0"));
    if (profile.id !== parcel.parcelProfileId) throw new PlatformError("PARCEL_PROFILE_CHANGED", "Parcel acceptance limits changed. Request a new quote.", 409);
    if (
      quote.ownerId === user.id &&
      (quote.storeId ?? null) !== (store?.id ?? null)
    )
      throw new PlatformError(
        "QUOTE_WORKSPACE_MISMATCH",
        "Request a new quote in this workspace.",
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
    if (store) {
      const savedPickup = await getStorePickupAddressForStore(store.id);
      const quotePickup = (quote.metadata as {
        bookingInput?: { pickupAddress?: { line1?: string; line2?: string; city?: string; province?: string; postalCode?: string; placeId?: string } }
      }).bookingInput?.pickupAddress ?? {};
      assertStoreParcelPickupMatches(quotePickup, savedPickup?.pickupAddress);
    }
    const negotiated=(quote.ruleSnapshot as {personalizedRate?:{ownerType?:string;ownerId?:string}}).personalizedRate;
    if(negotiated && (
      negotiated.ownerType !== (business?"STORE":"CUSTOMER") ||
      negotiated.ownerId !== (business?store?.id:user.id)
    )) throw new PlatformError("PERSONALIZED_RATE_OWNER_MISMATCH","This delivery tariff belongs to another account or workspace. Request a new quote.",403);
    const { pickupContactName, pickupContactPhone, pickupContactEmail, ...booking } = parsed.data;
    const input = CreateOrderSchema.parse({
      ...m.bookingInput,
      ...booking,
      senderEmail: pickupContactEmail,
      pickupAddress: {
        ...m.bookingInput.pickupAddress,
        contactName: pickupContactName,
        contactPhone: pickupContactPhone,
      },
      pricingQuoteId: id,
      parcelCount: 1,
    });
    // Strict order schema excludes sender helper fields rather than accepting extra client facts.
    let order;
    try {
      order = await prisma.$transaction(async tx => {
        const claimed = await tx.pricingQuote.updateMany({
          where: { id, ownerId: quote.ownerId, status: "ACTIVE", expiresAt: { gt: new Date() }, calculationVersion: "client-delivery-v1" },
          data: { ownerId: user.id, ownerType: business ? "STORE" : "CUSTOMER", storeId: store?.id ?? null },
        });
        if (claimed.count !== 1) throw new PlatformError("QUOTE_EXPIRED", "Request a new quote before booking.", 409);
        // Ownership, consumption, contacts and the canonical order commit together.
        // A refused payment policy must leave the anonymous quote usable by its owner.
        return createOrder(user, input, business, tx);
      });
    } catch (cause) {
      // Another concurrent POST can win the single-use quote race after our
      // initial read. Recover only the exact committed owner/order tuple.
      if (cause instanceof PlatformError && cause.code === "QUOTE_EXPIRED") {
        const committed = await recoverCommittedParcelBooking(replayInput);
        if (committed) return json(committed, 200);
      }
      throw cause;
    }
    return json(order, 201);
  } catch (e) {
    return failure(e);
  }
}
