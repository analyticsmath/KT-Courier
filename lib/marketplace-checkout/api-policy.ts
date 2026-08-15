import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { hashMarketplaceGuestSecret, MARKETPLACE_CART_COOKIE, MARKETPLACE_CHECKOUT_COOKIE } from "@/lib/marketplace-checkout/tokens";
import type { CartOwner } from "@/lib/marketplace-checkout/cart.service";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
import { MARKETPLACE_CHECKOUT_PRODUCTION_BLOCK_REASON } from "@/lib/marketplace-checkout/production-lock";

export const marketplaceNoStoreHeaders = { "Cache-Control": "private, no-store, max-age=0" };

export async function marketplaceOwner(request: NextRequest, scope: "cart" | "checkout" = "cart"): Promise<CartOwner | null> {
  const user = await getCurrentUser();
  if (user && user.role === "CUSTOMER") return { type: "CUSTOMER", userId: user.id };
  const raw = request.cookies.get(scope === "cart" ? MARKETPLACE_CART_COOKIE : MARKETPLACE_CHECKOUT_COOKIE)?.value;
  return raw ? { type: "GUEST", guestTokenHash: hashMarketplaceGuestSecret(raw) } : null;
}

export function marketplaceJson(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: marketplaceNoStoreHeaders });
}

export async function enforceMarketplaceMutation(request: NextRequest, kind: "cart" | "checkout" | "reservation"): Promise<NextResponse | null> {
  const originFailure = await enforceSameOriginRequest(request, { path: request.nextUrl.pathname });
  if (originFailure) return originFailure;
  const policy = kind === "cart" ? RATE_LIMITS.MARKETPLACE_CART_MUTATION : kind === "checkout" ? RATE_LIMITS.MARKETPLACE_CHECKOUT_MUTATION : RATE_LIMITS.MARKETPLACE_RESERVATION;
  const result = await checkIpRateLimit(request, `marketplace:${kind}`, policy);
  return result.ok ? null : marketplaceJson({ error: "Too many checkout requests. Please wait and try again." }, 429);
}

export async function readMarketplaceJson(request: NextRequest, limit = 4096): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.toLocaleLowerCase("en-US");
  if (contentType !== "application/json") throw new MarketplaceCheckoutError("CART_LINE_INVALID", "Invalid request body.");
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > limit)) throw new MarketplaceCheckoutError("CART_LINE_INVALID", "Invalid request body.");
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") < 2 || Buffer.byteLength(raw, "utf8") > limit) throw new MarketplaceCheckoutError("CART_LINE_INVALID", "Invalid request body.");
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new MarketplaceCheckoutError("CART_LINE_INVALID", "Invalid request body.");
  return parsed as Record<string, unknown>;
}

export function assertExactKeys(body: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(body).some((key) => !keys.includes(key))) throw new MarketplaceCheckoutError("CART_LINE_INVALID", "Invalid request body.");
}

export function stringField(body: Record<string, unknown>, key: string, max = 200): string {
  const value = body[key];
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new MarketplaceCheckoutError("CART_LINE_INVALID", "Invalid request body.");
  return value.trim();
}

export function integerField(body: Record<string, unknown>, key: string): number {
  const value = body[key];
  if (!Number.isSafeInteger(value)) throw new MarketplaceCheckoutError("CART_LINE_INVALID", "Invalid request body.");
  return value as number;
}

export function marketplaceError(error: unknown): NextResponse {
  if ((error as { code?: unknown })?.code === MARKETPLACE_CHECKOUT_PRODUCTION_BLOCK_REASON) {
    return marketplaceJson({ error: "Marketplace checkout is awaiting consolidated validation.", code: MARKETPLACE_CHECKOUT_PRODUCTION_BLOCK_REASON }, 503);
  }
  if (error instanceof MarketplaceCheckoutError) {
    const status = error.code.includes("ACCESS") ? 404 : error.code.includes("CONFLICT") ? 409 : error.code.includes("LOCKED") || error.code.includes("BLOCKED") ? 503 : 422;
    return marketplaceJson({ error: error.message, code: error.code }, status);
  }
  return marketplaceJson({ error: "The cart or checkout request could not be completed." }, 503);
}
