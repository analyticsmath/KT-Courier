import { type NextRequest } from "next/server";
import { type ZodType } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { conflict, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { readBoundedStorefrontJson, storefrontJson } from "@/lib/storefront/storefront-api-policy";
import { StorefrontProductionLockedError } from "@/lib/storefront/storefront-production-lock";

export async function requireStorefrontAdminMutation(request: NextRequest, permission: string) {
  const auth = await requireAdminApiPermission(permission, { request });
  if ("response" in auth) return auth;
  const origin = await enforceSameOriginRequest(request, { path: request.nextUrl.pathname });
  if (origin) return { response: origin };
  const rate = await checkIpRateLimit(request, "storefront:admin:mutation", RATE_LIMITS.STOREFRONT_ADMIN_MUTATION);
  if (!rate.ok) return { response: storefrontJson({ error: "Too many storefront administration requests. Please wait and try again." }, 429, { private: true }) };
  return auth;
}

export async function parseStorefrontAdminBody<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(await readBoundedStorefrontJson(request, 16_384));
  if (!parsed.success) throw new StorefrontAdminBodyError();
  return parsed.data;
}
export class StorefrontAdminBodyError extends Error { constructor() { super("Invalid storefront administration input."); this.name = "StorefrontAdminBodyError"; } }
export function storefrontAdminError(error: unknown) {
  if (error instanceof StorefrontAdminBodyError) return unprocessable("Invalid storefront administration input.");
  if (error instanceof StorefrontProductionLockedError) return storefrontJson({ error: "Storefront production activation remains locked pending Phase 26.5 validation." }, 409, { private: true });
  if (error instanceof Error && /CONFLICT|IMMUTABLE|NOT_FOUND|INELIGIBLE|NOT_ACTIVATABLE|INVALID_LIFECYCLE/.test((error as { code?: string }).code ?? "")) return conflict("The storefront administration request could not be applied safely.");
  return storefrontJson({ error: "The storefront administration request could not be completed." }, 503, { private: true });
}
