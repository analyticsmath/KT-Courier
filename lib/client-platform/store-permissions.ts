export const STORE_MODULES = [
  "orders",
  "deliveries",
  "products",
  "marketing",
  "finance",
  "reviews",
  "chat",
  "settings",
] as const;
export type StoreModule = (typeof STORE_MODULES)[number];
export const STORE_ROLE_PRESETS: Record<string, readonly StoreModule[]> = {
  Operations: ["orders", "deliveries"],
  Marketing: ["marketing"],
  Finance: ["finance"],
  "Customer service": ["orders", "reviews", "chat"],
};
export function membershipAllows(
  permissions: unknown,
  section: StoreModule | null,
) {
  return (
    !!section && Array.isArray(permissions) && permissions.includes(section)
  );
}
export function moduleForPermission(key: string): StoreModule | null {
  if (/^catalog\.(read|manage|submit|pricing|inventory|imports)/.test(key))
    return "products";
  if (/^(store_orders|orders|dispatch)/.test(key)) return "orders";
  if (/^(promotions|store_promotions|advertising|managed_marketing)/.test(key))
    return "marketing";
  if (
    /^(store_subscriptions|subscriptions|store_earnings|withdrawals|payout|store_report|reports|ledger|payments)/.test(
      key,
    )
  )
    return "finance";
  return null;
}
export function moduleForStorePath(path: string): StoreModule | null {
  const p = path.replace(/^\/api\/store|^\/store/, "");
  if (/^\/(catalog|products)/.test(p)) return "products";
  if (/^\/(orders|marketplace-orders)/.test(p)) return "orders";
  if (/^\/(new-delivery|addresses)/.test(p)) return "deliveries";
  if (
    /^\/(promotions|promotion-drafts|advertising|ads|managed-marketing|marketing-media|banners|coupons|campaigns)/.test(
      p,
    )
  )
    return "marketing";
  if (/^\/(earnings|wallet|subscription|expense|reports|payout)/.test(p))
    return "finance";
  if (/^\/support-history/.test(p)) return "settings";
  if (/^\/reviews/.test(p)) return "reviews";
  if (/^\/(chat|support|notifications)/.test(p)) return "chat";
  if (/^\/(profile|pickup-address)/.test(p)) return "settings";
  return null; // Employee management and unknown modules stay owner-only.
}
