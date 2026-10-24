import { completeStorePickupAddress } from "../lib/marketplace-checkout/store-pickup-selection";

type SeedPickup = Readonly<{
  storeId: string | null;
  type: string;
  line1: string;
  line2?: string | null;
  city: string | null;
  province: string | null;
  postalCode?: string | null;
  country: string;
  latitude: number | { toNumber(): number } | null;
  longitude: number | { toNumber(): number } | null;
}>;

/** Produces data for a NEW, test-only pickup address owned by the new store.
 * Never link another store's Address.id as a pickup to pass a coverage gate.
 */
export function makeDisposableParcelPickupAddress(storeId: string, seed: SeedPickup) {
  if (!storeId || storeId === seed.storeId) throw new Error("Disposable test store must have a different owner from seed pickup.");
  if (seed.type !== "PICKUP") throw new Error("Disposable seed must be a pickup address.");
  if (!completeStorePickupAddress(seed)) throw new Error("Disposable pickup seed must be complete.");
  const latitude = typeof seed.latitude === "number" ? seed.latitude : seed.latitude?.toNumber();
  const longitude = typeof seed.longitude === "number" ? seed.longitude : seed.longitude?.toNumber();
  if (latitude === undefined || longitude === undefined || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("Disposable pickup seed must have verified coordinates.");
  }
  return {
    storeId, type: "PICKUP" as const, label: "Disposable independent pickup", isDefault: true,
    line1: seed.line1, line2: seed.line2 ?? null, city: seed.city,
    province: seed.province, postalCode: seed.postalCode ?? null,
    country: seed.country, latitude, longitude,
  };
}
