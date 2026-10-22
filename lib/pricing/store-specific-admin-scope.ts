/**
 * Admin-only presentation scope. Never infer identity from a browser-supplied
 * owner ID: only an ACTIVE store resolved by the server can be selected.
 * Rate writes still require pricing.manage and server-side ownership checks.
 */
export function limitPricingToStore<T extends { ownerType: string; ownerId: string }>(
  requestedStoreId: string | undefined,
  resolvedStore: { id: string; name: string; status: string } | null,
  owners: readonly { type: string; id: string; label: string }[],
  rates: readonly T[],
) {
  if (requestedStoreId === undefined) return { owners: [...owners], rates: [...rates] };
  if (!resolvedStore || resolvedStore.status !== "ACTIVE" || resolvedStore.id !== requestedStoreId) {
    return { owners: [], rates: [] };
  }
  return {
    owners: [{ type: "STORE", id: resolvedStore.id, label: `Store: ${resolvedStore.name}` }],
    rates: rates.filter(rate => rate.ownerType === "STORE" && rate.ownerId === resolvedStore.id),
  };
}
