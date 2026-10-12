/** Local normalized uploads require the named, network-isolated browser database. */
export function disposableBrowserCatalogMediaAllowed(env: Readonly<Record<string, string | undefined>> = process["env"]): boolean {
  if (env.NODE_ENV !== "test" || env.KT_RUNTIME_ENV !== "e2e" || env.KT_NETWORK_DISABLED !== "true" || env.CATALOG_MEDIA_STORAGE !== "filesystem" || env.CATALOG_MEDIA_LOCAL_DIR !== "/tmp/kt-couriers-e2e-catalog-media" || env.KT_DATABASE_CLASSIFICATION === "production") return false;
  try {
    const url = new URL(env.DATABASE_URL ?? "");
    return ["postgres:", "postgresql:"].includes(url.protocol) && ["db", "localhost", "127.0.0.1"].includes(url.hostname)
      && url.pathname === "/kt_phase75_e2e" && url.username === "kt_phase75_e2e";
  } catch { return false; }
}
