import { SIZES } from "@/lib/client-platform/contracts";

/**
 * Client's illustrative parcel measurements, not signed operating limits.
 * Admin-editable drafts use the exact stable keys accepted by ParcelProfileSchema.
 * Never mark these records ACTIVE in an initializer.
 */
export const INITIAL_CLIENT_PARCEL_DRAFTS = [
  { stableKey: "SMALL", displayName: "Small", lengthCm: 30, widthCm: 20, heightCm: 10, maximumWeightKg: 5 },
  { stableKey: "MEDIUM", displayName: "Medium", lengthCm: 50, widthCm: 40, heightCm: 30, maximumWeightKg: 15 },
  { stableKey: "LARGE", displayName: "Large", lengthCm: 70, widthCm: 50, heightCm: 50, maximumWeightKg: 30 },
] as const satisfies readonly {
  stableKey: (typeof SIZES)[number];
  displayName: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  maximumWeightKg: number;
}[];
