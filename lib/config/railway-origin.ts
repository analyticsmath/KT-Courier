/** Server-side edge configuration. Never export through NEXT_PUBLIC_*. */
export function railwayProductionOrigin(value = process.env.RAILWAY_PRODUCTION_ORIGIN): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/" || !url.hostname.includes(".") || !/^[a-z0-9.-]+$/i.test(url.hostname) || url.hostname.endsWith(".") || url.hostname.includes("..")) return null;
    return url.origin;
  } catch { return null; }
}
