const requiredPrefix = /^kt-couriers-store-earning-[a-z0-9-]+$/;

export function requireDisposableStoreEarningIntegrationEnvironment(): void {
  if (process.env.KT_STORE_EARNING_INTEGRATION_APPROVED !== "true") throw new Error("Store earning integration approval is absent.");
  if (!requiredPrefix.test(process.env.KT_SMOKE_PROJECT_NAME ?? "")) throw new Error("Store earning integration requires a unique disposable Compose project.");
  if (!/^kt_store_earning_/.test(process.env.POSTGRES_DB ?? "")) throw new Error("Store earning integration refuses a non-disposable database.");
  if (process.env.KT_NETWORK_DISABLED !== "true") throw new Error("Store earning integration requires deterministic network-disabled fixtures.");
}
