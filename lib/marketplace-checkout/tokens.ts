import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const MARKETPLACE_CART_COOKIE = "kt_marketplace_cart";
export const MARKETPLACE_CHECKOUT_COOKIE = "kt_marketplace_checkout";
export const MARKETPLACE_ORDER_COOKIE = "kt_marketplace_order";
export const MARKETPLACE_GUEST_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function createMarketplaceGuestSecret(): string { return randomBytes(32).toString("base64url"); }
export function hashMarketplaceGuestSecret(secret: string): string { return createHash("sha256").update(secret).digest("hex"); }
export function verifyMarketplaceGuestSecret(secret: string | undefined, hash: string | undefined | null): boolean {
  if (!secret || !hash) return false;
  const expected = Buffer.from(hashMarketplaceGuestSecret(secret));
  const received = Buffer.from(hash);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
export const marketplaceGuestCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MARKETPLACE_GUEST_COOKIE_MAX_AGE_SECONDS,
};
