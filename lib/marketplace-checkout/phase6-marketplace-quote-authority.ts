/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 20 delegates are intentionally dynamic until Prisma generation is permitted. */
import { PricingQuoteOwnerType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { MarketplaceDeliveryQuoteInput, MarketplaceDeliveryQuoteResult, Phase6MarketplaceQuoteAuthority, Phase6MarketplaceQuoteEvidence } from "@/lib/marketplace-checkout/marketplace-delivery-quote.service";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
import { createPricingQuoteForTrustedOwner } from "@/lib/services/pricing-quote.service";

type Coordinates = Readonly<{ latitude: number; longitude: number }>;
type Phase6Request = Readonly<{
  owner: { ownerType: PricingQuoteOwnerType; ownerId: string; storeId: string };
  quoteInput: any;
  serviceAreaReference: string;
}>;

function coordinates(value: unknown): Coordinates | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const latitude = record.latitude ?? record.lat;
  const longitude = record.longitude ?? record.lng ?? record.lon;
  return typeof latitude === "number" && Number.isFinite(latitude) && typeof longitude === "number" && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
}

/**
 * Binds persisted checkout/address/store evidence to the Phase 6 pricing
 * service. It does not derive zones, fees or routes itself.
 */
export function createPhase6MarketplaceQuoteAuthority(database: any = prisma): Phase6MarketplaceQuoteAuthority {
  return Object.freeze({
    async resolveEvidence(input: MarketplaceDeliveryQuoteInput): Promise<Phase6MarketplaceQuoteEvidence | null> {
      if (input.fulfilmentMode === "STORE_PICKUP") return null;
      const checkout = await database.marketplaceCheckout.findUnique({
        where: { publicReference: input.checkoutReference },
        include: {
          addressSnapshot: true,
          storeGroups: {
            where: { storeId: input.storeReference },
            include: { store: { include: { defaultPickupAddress: true } } },
          },
        },
      });
      const group = checkout?.storeGroups?.[0];
      const pickup = group?.store?.defaultPickupAddress;
      const destination = checkout?.addressSnapshot;
      const pickupCoordinates = pickup?.latitude === null || pickup?.latitude === undefined || pickup?.longitude === null || pickup?.longitude === undefined
        ? null
        : coordinates({ latitude: Number(pickup.latitude), longitude: Number(pickup.longitude) });
      const destinationCoordinates = coordinates(destination?.protectedCoordinates);
      if (!checkout || !group || !pickup || !destination || !pickupCoordinates || !destinationCoordinates || destination.serviceAreaReference !== input.serviceAreaReference) return null;
      const phase6Request: Phase6Request = Object.freeze({
        owner: {
          ownerType: PricingQuoteOwnerType.STORE,
          ownerId: group.store.ownerUserId ?? group.store.id,
          storeId: group.store.id,
        },
        quoteInput: Object.freeze({
          deliveryType: "SAME_DAY",
          pickupAddress: { line1: pickup.line1, line2: pickup.line2 ?? undefined, city: pickup.city ?? undefined, province: pickup.province ?? undefined, postalCode: pickup.postalCode ?? undefined, country: pickup.country, latitude: pickupCoordinates.latitude, longitude: pickupCoordinates.longitude },
          dropoffAddress: { line1: destination.line1, line2: destination.line2 ?? undefined, city: destination.city, province: destination.province, postalCode: destination.postalCode ?? undefined, country: destination.country, latitude: destinationCoordinates.latitude, longitude: destinationCoordinates.longitude },
        }),
        serviceAreaReference: input.serviceAreaReference,
      }) as any;
      return Object.freeze({
        checkoutReference: input.checkoutReference,
        storeReference: input.storeReference,
        pickupLocationReference: input.pickupLocationReference!,
        serviceAreaReference: input.serviceAreaReference,
        fulfilmentMode: input.fulfilmentMode,
        phase6Request,
      }) as any;
    },
    async quote(evidence: Phase6MarketplaceQuoteEvidence): Promise<MarketplaceDeliveryQuoteResult | null> {
      const request = evidence.phase6Request as Phase6Request | undefined;
      if (!request || request.serviceAreaReference !== evidence.serviceAreaReference) return null;
      const quote = await createPricingQuoteForTrustedOwner(request.owner, request.quoteInput);
      return Object.freeze({
        fee: quote.total,
        currency: "ZAR",
        publicReference: quote.id,
        version: `phase6:${quote.id}`,
        expiresAt: quote.expiresAt,
        serviceabilityReference: evidence.serviceAreaReference,
        serviceLevel: "SAME_DAY",
      });
    },
  });
}

export function phase6EvidenceRequired(): never {
  throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Canonical Phase 6 pickup, destination or serviceability evidence is unavailable.");
}
