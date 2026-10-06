export type TrackingMapPoint = Readonly<{ id: string; label: string; latitude: number; longitude: number; observedAt: string }>;

function record(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function point(value: unknown, id: string, label: string): TrackingMapPoint[] {
  const location = record(value);
  if (!location || typeof location.latitude !== "number" || typeof location.longitude !== "number" || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude) || Math.abs(location.latitude) > 90 || Math.abs(location.longitude) > 180 || typeof location.observedAt !== "string" || !Number.isFinite(Date.parse(location.observedAt))) return [];
  return [{ id, label, latitude: location.latitude, longitude: location.longitude, observedAt: location.observedAt }];
}

/** Uses only the existing owner-scoped, coarsened location projection. */
export function trackingMapPoints(body: unknown, scope: "MARKETPLACE" | "PARCEL", reference: string): TrackingMapPoint[] {
  const response = record(body);
  if (!response) return [];
  if (scope === "PARCEL") {
    const data = record(response.data);
    return data?.active === true ? point(data.latestKnownLocation, reference, "Courier") : [];
  }
  if (response.marketplaceOrderReference !== reference || !Array.isArray(response.storeOrders)) return [];
  return response.storeOrders.flatMap(value => {
    const order = record(value);
    return order && typeof order.storeOrderReference === "string" && typeof order.storeName === "string" ? point(order.liveLocation, order.storeOrderReference, order.storeName.slice(0, 120)) : [];
  });
}
