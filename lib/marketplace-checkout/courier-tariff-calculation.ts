import { Prisma } from "@prisma/client";
import type { DeliveryConfiguration } from "@/lib/client-platform/contracts";
import { calculateDeliveryPrice } from "@/lib/pricing/calculator";
import type { PricingRegionContext, PricingTaxConfig } from "@/lib/pricing/types";
import type { TrustedParcelClassification } from "./parcel-classification";
import { MarketplaceCheckoutError } from "./errors";

export const MARKETPLACE_COURIER_CALCULATION_VERSION = "marketplace-courier-tariff-v1";

export function calculateMarketplaceCourierTariff(input: {
  service: DeliveryConfiguration & { id: string; version: number };
  parcel: TrustedParcelClassification;
  distanceMeters: number;
  durationSeconds: number;
  regionContext: PricingRegionContext;
  tax: PricingTaxConfig;
}) {
  const { service, parcel } = input;
  if (!service.active || parcel.status !== "CLASSIFIED" || !parcel.sizeClass || !Number.isFinite(parcel.weightKg) || Number(parcel.weightKg) <= 0) {
    throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "The vendor's packed dimensions and weight must be verified before courier delivery can be priced. Contact the store to arrange packaging verification.");
  }
  const tariff = service.tariffs[parcel.sizeClass];
  const d = (value: string | number) => new Prisma.Decimal(value);
  const rule = {
    id: service.id, revision: service.version, currency: "ZAR" as const, deliveryType: "PARCEL_DOCUMENT" as const, regionId: null,
    baseFee: d(tariff.baseFee), perKmRate: d(tariff.perKmRate), includedDistanceKm: d(0), distanceIncrementKm: d("0.001"),
    minimumCharge: tariff.minimumCharge === null ? null : d(tariff.minimumCharge), maximumWeightKg: tariff.maximumWeightKg === null ? null : d(tariff.maximumWeightKg),
    flatSurcharge: null, vehicleClass: null, vehicleSurcharge: null, includedWeightKg: null, perAdditionalKgRate: null, weightIncrementKg: null,
    dimensionalPricingEnabled: false, volumetricDivisor: null, maxDistanceKm: null,
  };
  const calculation = calculateDeliveryPrice({
    input: { deliveryType: "PARCEL_DOCUMENT", distanceMeters: input.distanceMeters, durationSeconds: input.durationSeconds, vehicleClass: null, actualWeightKg: d(parcel.weightKg!), lengthCm: null, widthCm: null, heightCm: null },
    rule, regionContext: input.regionContext, taxConfig: input.tax, calculationVersion: MARKETPLACE_COURIER_CALCULATION_VERSION,
  });
  return { calculation, rule };
}
