/** Allows only the named isolated closure, browser or unique store-earning runner. */
export function requireDisposableStoreSettlementDatabase() {
  const refused = () => new Error("Named network-isolated disposable store settlement database required.");
  let url: URL;
  try { url = new URL(process.env.DATABASE_URL ?? ""); } catch { throw refused(); }
  const database = url.pathname.slice(1);
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  const closure = local && database === "kt_launch_test" && process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS === "1";
  const browser = ["db", "localhost", "127.0.0.1"].includes(url.hostname) && database === "kt_phase75_e2e" && url.username === database;
  const store = local && /^kt_store_earning_\d+_\d+$/.test(database)
    && database === process.env.POSTGRES_DB && database === url.username
    && /^kt-couriers-store-earning-(?:[a-z0-9-]+-)?\d+-\d+$/.test(process.env.KT_SMOKE_PROJECT_NAME ?? "")
    && process.env.KT_STORE_EARNING_INTEGRATION_APPROVED === "true"
    && process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS === "1";
  if (!["postgres:", "postgresql:"].includes(url.protocol) || process.env.NODE_ENV !== "test"
    || process.env.KT_RUNTIME_ENV !== "e2e" || process.env.KT_NETWORK_DISABLED !== "true"
    || (!closure && !browser && !store)) throw refused();
}
