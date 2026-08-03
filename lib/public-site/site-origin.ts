const REPOSITORY_CANONICAL_ORIGIN = "https://ktcouriers.com";

function normalizeOrigin(value: string): URL {
  let origin: URL;

  try {
    origin = new URL(value);
  } catch {
    throw new Error("KT Couriers canonical origin must be a valid absolute URL.");
  }

  if (origin.protocol !== "https:" && origin.protocol !== "http:") {
    throw new Error("KT Couriers canonical origin must use HTTP or HTTPS.");
  }

  if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("KT Couriers canonical origin must not include credentials, a path, a query, or a fragment.");
  }

  return new URL(origin.origin);
}

/**
 * The repository's established production-origin authority. A deployment may
 * provide a verified server-side override, but request Host headers are never
 * used to derive canonical URLs.
 */
export const canonicalSiteOrigin = normalizeOrigin(
  process.env.KT_COURIERS_SITE_ORIGIN?.trim() || REPOSITORY_CANONICAL_ORIGIN,
);

export function canonicalUrl(pathname = "/"): string {
  if (!pathname.startsWith("/")) {
    throw new Error("Canonical paths must start with '/'.");
  }

  const url = new URL(pathname, canonicalSiteOrigin);
  url.search = "";
  url.hash = "";
  return url.toString();
}

