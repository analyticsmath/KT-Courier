/**
 * Normalizes Next.js App Router file paths to public URL patterns.
 * - Strips route groups in parentheses like (admin), (public), (auth).
 * - Converts dynamic parameters like [id] or [campaignRef] to :param.
 * - Converts catch-all parameters like [...slug] or [[...path]] to *.
 * - Removes trailing /route.ts or /route.js.
 */
export function normalizeRouteFilePathToPublicPattern(filePath: string): string {
  let normalized = filePath.replace(/\\/g, "/");

  // Remove leading app/ or ./app/
  normalized = normalized.replace(/^(\.\/)?app\//, "");

  // Remove trailing route.ts or route.js
  normalized = normalized.replace(/\/route\.(ts|js)$/, "");

  // Split path segments
  const segments = normalized.split("/").filter(Boolean);

  const publicSegments = segments
    .filter((segment) => !/^\([A-Za-z0-9_-]+\)$/.test(segment)) // Remove (routeGroup)
    .map((segment) => {
      // Catch-all [[...param]] or [...param]
      if (/^\[{1,2}\.\.\.[A-Za-z0-9_-]+\]{1,2}$/.test(segment)) {
        return "*";
      }
      // Dynamic [param]
      if (/^\[[A-Za-z0-9_-]+\]$/.test(segment)) {
        const paramName = segment.slice(1, -1);
        return `:${paramName}`;
      }
      return segment;
    });

  return "/" + publicSegments.join("/");
}
