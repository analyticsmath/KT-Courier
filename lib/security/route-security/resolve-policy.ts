import type { HttpMethod, RouteSecurityPolicy, RoutePolicyResolution } from "./types";

/**
 * Matches a normalized public URL path and HTTP method against a route security policy array.
 * Enforces exact method/pattern matching or explicit wildcards without overlapping collisions.
 */
export function resolveRoutePolicy(
  publicPath: string,
  method: HttpMethod,
  policies: RouteSecurityPolicy[]
): RoutePolicyResolution {
  const matches = policies.filter((policy) => {
    if (policy.method !== method) return false;

    if (policy.publicPathPattern === publicPath) return true;

    // Wildcard catch-all match (e.g. /api/v1/*)
    if (policy.publicPathPattern.endsWith("/*")) {
      const prefix = policy.publicPathPattern.slice(0, -2);
      return publicPath === prefix || publicPath.startsWith(prefix + "/");
    }

    // Dynamic segment pattern match (e.g. /api/store/ads/campaigns/:campaignRef)
    const policyParts = policy.publicPathPattern.split("/").filter(Boolean);
    const pathParts = publicPath.split("/").filter(Boolean);

    if (policyParts.length !== pathParts.length) return false;

    return policyParts.every((part, idx) => {
      if (part.startsWith(":")) return true; // Dynamic param match
      return part === pathParts[idx];
    });
  });

  if (matches.length === 1) {
    return {
      matchedPolicy: matches[0]!,
      status: "MATCHED",
      candidateCount: 1,
    };
  }

  if (matches.length > 1) {
    return {
      matchedPolicy: matches[0]!,
      status: "DUPLICATE_MATCH",
      candidateCount: matches.length,
    };
  }

  return {
    matchedPolicy: null,
    status: "UNCLASSIFIED",
    candidateCount: 0,
  };
}
