"use client";

import { useEffect, useSyncExternalStore } from "react";

type MarketplaceCart = {
  itemCount?: number;
  version?: number;
  storeGroups?: Array<{ lines?: Array<{ quantity: number }> }>;
};

type MarketplaceCartResponse = { ok: boolean; cart?: MarketplaceCart };

let cartCount = 0;
let cartRequest: Promise<MarketplaceCartResponse> | null = null;
const listeners = new Set<() => void>();

function countItems(cart: MarketplaceCart): number {
  if (typeof cart.itemCount === "number") return cart.itemCount;
  return (cart.storeGroups ?? []).reduce(
    (total, group) => total + (group.lines ?? []).reduce((sum, line) => sum + line.quantity, 0),
    0,
  );
}

function notifyCartCount(next: number): void {
  if (next === cartCount) return;
  cartCount = next;
  listeners.forEach((listener) => listener());
}

/** Shares concurrent cart reads across the desktop header, mobile navigation and Quick Buy. */
export function getMarketplaceCart(): Promise<MarketplaceCartResponse> {
  if (cartRequest) return cartRequest;
  const request = fetch("/api/cart", { cache: "no-store" })
    .then(async (response): Promise<MarketplaceCartResponse> => {
      if (!response.ok) return { ok: false };
      const payload = await response.json() as { cart?: MarketplaceCart };
      if (payload.cart) notifyCartCount(countItems(payload.cart));
      return { ok: true, cart: payload.cart };
    })
    .catch((): MarketplaceCartResponse => ({ ok: false }))
    .finally(() => {
      if (cartRequest === request) cartRequest = null;
    });
  cartRequest = request;
  return request;
}

function refreshMarketplaceCart(): void {
  if (!cartRequest) {
    void getMarketplaceCart();
    return;
  }
  void cartRequest.then(() => getMarketplaceCart());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): number {
  return cartCount;
}

export function useMarketplaceCartCount(enabled = true): number {
  const count = useSyncExternalStore(subscribe, getSnapshot, () => 0);

  useEffect(() => {
    if (!enabled) return;
    void getMarketplaceCart();
    window.addEventListener("kt-cart-updated", refreshMarketplaceCart);
    return () => window.removeEventListener("kt-cart-updated", refreshMarketplaceCart);
  }, [enabled]);

  return count;
}
