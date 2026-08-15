import { NextResponse, type NextRequest } from "next/server";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { storefrontPrivateCacheHeaders, storefrontPublicCacheHeaders } from "@/lib/storefront/cache/storefront-cache-policy";
import { StorefrontProductionLockedError } from "@/lib/storefront/storefront-production-lock";

export function storefrontJson(data: unknown, status = 200, options: { private?: boolean } = {}): NextResponse {
  return NextResponse.json(data, { status, headers: options.private ? storefrontPrivateCacheHeaders() : storefrontPublicCacheHeaders() });
}
export function storefrontUnavailable(): NextResponse {
  return storefrontJson({ error: "The shop catalogue is not available yet. Please browse again later." }, 503, { private: true });
}
export function storefrontNotFound(): NextResponse { return storefrontJson({ error: "This shop page is unavailable." }, 404, { private: true }); }
export function storefrontError(error: unknown): NextResponse {
  if (error instanceof StorefrontProductionLockedError) return storefrontUnavailable();
  return storefrontJson({ error: "The shop could not complete this request." }, 503, { private: true });
}
export async function enforceStorefrontRateLimit(request: NextRequest, kind: "search" | "suggestions" | "location"): Promise<NextResponse | null> {
  const config = kind === "search" ? RATE_LIMITS.STOREFRONT_SEARCH : kind === "suggestions" ? RATE_LIMITS.STOREFRONT_SUGGESTIONS : RATE_LIMITS.STOREFRONT_LOCATION;
  const result = await checkIpRateLimit(request, `storefront:${kind}`, config);
  return result.ok ? null : storefrontJson({ error: "Too many shop requests. Please wait and try again." }, 429, { private: true });
}
export async function readBoundedStorefrontJson(request: NextRequest, limit = 2048): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.toLocaleLowerCase("en-US");
  if (contentType !== "application/json") throw new Error("Invalid content type.");
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") < 2 || Buffer.byteLength(text, "utf8") > limit) throw new Error("Invalid request body.");
  return JSON.parse(text) as unknown;
}

