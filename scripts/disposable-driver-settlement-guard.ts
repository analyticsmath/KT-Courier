/** Reject every database except the explicitly isolated closure/browser/driver runners. */
export function requireDisposableDriverSettlementDatabase() {
  let url: URL;
  try {
    url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent");
  } catch {
    throw new Error("Named network-isolated disposable driver settlement database required.");
  }
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  const closure = url.pathname === "/kt_launch_test" && process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS === "1" && local;
  const browser = url.pathname === "/kt_phase75_e2e" && ["localhost", "127.0.0.1", "db"].includes(url.hostname);
  const database = url.pathname.slice(1);
  const driver = local && /^kt_driver_earning_\d+_\d+$/.test(database)
    && database === process.env.POSTGRES_DB && database === url.username
    && /^kt-couriers-driver-earning-(?:[a-z0-9-]+-)?\d+-\d+$/.test(process.env.KT_SMOKE_PROJECT_NAME ?? "")
    && process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS === "1"
    && process.env.KT_DRIVER_EARNING_INTEGRATION_APPROVED === "true";
  if (!["postgres:", "postgresql:"].includes(url.protocol) || process.env.NODE_ENV === "production" || process.env.KT_RUNTIME_ENV !== "e2e" || process.env.KT_NETWORK_DISABLED !== "true" || (!closure && !browser && !driver)) throw new Error("Named network-isolated disposable driver settlement database required.");
}
