/** Browser visibility limits polling; a terminal order needs no continuous refresh. */
export function shouldRefreshParcelStatus(status: string): boolean {
  return !["DELIVERED", "COMPLETED", "CANCELLED"].includes(status);
}

/** A failed attempt can still be rescheduled; stop only when every store is delivered. */
export function shouldRefreshMarketplaceStatus(storeDeliveryStatuses: readonly string[]): boolean {
  return storeDeliveryStatuses.length === 0 || storeDeliveryStatuses.some((status) => status !== "DELIVERED");
}
