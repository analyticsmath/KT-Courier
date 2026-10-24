export type MarketplaceStoreOrderInitializationReadiness = Readonly<{
  hasWork: boolean;
  blocker: "STORE_ORDER_OPERATIONAL_POLICY_REQUIRED" | "STORE_ORDER_SNAPSHOT_RECONCILIATION_REQUIRED" | null;
}>;

export async function checkMarketplaceStoreOrderInitializationReadiness(input: Readonly<{
  hasPendingOrder: () => Promise<boolean>;
  hasReconciliationOrder: () => Promise<boolean>;
  hasActivePolicy: () => Promise<boolean>;
}>): Promise<MarketplaceStoreOrderInitializationReadiness> {
  const hasReconciliation = await input.hasReconciliationOrder();
  const blocker = hasReconciliation ? "STORE_ORDER_SNAPSHOT_RECONCILIATION_REQUIRED" as const : null;
  if (!await input.hasPendingOrder()) return { hasWork: false, blocker };
  if (!await input.hasActivePolicy()) return { hasWork: false, blocker: "STORE_ORDER_OPERATIONAL_POLICY_REQUIRED" };
  return { hasWork: true, blocker };
}
