export type MarketplaceStoreOrderInitializationReadiness = Readonly<{
  hasWork: boolean;
  blocker: "STORE_ORDER_OPERATIONAL_POLICY_REQUIRED" | null;
}>;

export async function checkMarketplaceStoreOrderInitializationReadiness(input: Readonly<{
  hasPendingOrder: () => Promise<boolean>;
  hasActivePolicy: () => Promise<boolean>;
}>): Promise<MarketplaceStoreOrderInitializationReadiness> {
  if (!await input.hasPendingOrder()) return { hasWork: false, blocker: null };
  if (!await input.hasActivePolicy()) return { hasWork: false, blocker: "STORE_ORDER_OPERATIONAL_POLICY_REQUIRED" };
  return { hasWork: true, blocker: null };
}
