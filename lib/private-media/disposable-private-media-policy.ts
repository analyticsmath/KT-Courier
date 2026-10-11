/** Never admits production or an arbitrary database to the local browser adapter. */
export function disposableBrowserPrivateMediaAllowed(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  if (env.NODE_ENV !== "test" || env.KT_RUNTIME_ENV !== "e2e" || env.KT_NETWORK_DISABLED !== "true" || env.KT_E2E_PRIVATE_MEDIA_LOCAL !== "true" || env.PRIVATE_MEDIA_LOCAL_DIR !== "/tmp/kt-couriers-e2e-private-media") return false;
  try {
    const url = new URL(env.DATABASE_URL ?? "");
    return ["postgres:", "postgresql:"].includes(url.protocol)
      && ["db", "localhost", "127.0.0.1"].includes(url.hostname)
      && url.pathname === "/kt_phase75_e2e"
      && url.username === "kt_phase75_e2e";
  } catch {
    return false;
  }
}
