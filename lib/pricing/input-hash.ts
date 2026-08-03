import { createHash } from "node:crypto";

type AddressForPricingHash = {
  latitude?: number | null;
  longitude?: number | null;
  line1: string;
  city?: string | null;
};

type PricingHashInput = {
  deliveryType: string;
  pickupAddress: AddressForPricingHash;
  dropoffAddress: AddressForPricingHash;
  vehicleClass?: string | null;
  actualWeightKg?: string | null;
  lengthCm?: string | null;
  widthCm?: string | null;
  heightCm?: string | null;
};

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if ("toString" in value && value.constructor?.name === "Decimal") return value.toString();
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonicalize(child)]));
}

export function hashPricingInput(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(input))).digest("hex");
}

/**
 * The sole canonical representation of order details that affect a quote.
 * It intentionally excludes client totals, server route data, and rule data.
 */
export function pricingInputSnapshot(input: PricingHashInput) {
  const address = (value: AddressForPricingHash) => ({
    latitude: value.latitude ?? null,
    longitude: value.longitude ?? null,
    line1: value.line1,
    city: value.city ?? null,
  });

  return {
    deliveryType: input.deliveryType,
    pickup: address(input.pickupAddress),
    dropoff: address(input.dropoffAddress),
    vehicleClass: input.vehicleClass ?? null,
    actualWeightKg: input.actualWeightKg ?? null,
    lengthCm: input.lengthCm ?? null,
    widthCm: input.widthCm ?? null,
    heightCm: input.heightCm ?? null,
  };
}
