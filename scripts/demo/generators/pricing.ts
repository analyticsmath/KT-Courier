/**
 * KT Couriers — Store Pricing & Assortment Generator
 */

import { SeededRNG } from "./rng";
import { DEMO_PRODUCT_TEMPLATES, type ProductTemplate } from "../fixtures/products";
import { type StoreDefinition } from "../fixtures/stores";

export interface StoreAssortmentOffer {
  productTemplate: ProductTemplate;
  sku: string;
  barcode: string;
  price: number;
  inventoryQuantity: number;
  isPublished: boolean;
}

export const STORE_VERTICAL_MAP: Record<string, string[]> = {
  GROCERIES: ["GROCERIES", "FLOWERS_PLANTS", "PET_CARE"],
  FOOD: ["FOOD_DINING", "CAKES_BAKERY"],
  PHARMACY: ["HEALTH_WELLNESS"],
  ELECTRONICS: ["ELECTRONICS", "AUTOMOTIVE"],
  FASHION: ["FASHION_APPAREL", "HOME_LIVING"],
  HOME: ["HOME_LIVING", "PET_CARE"],
  BOOKS: ["BOOKS_STATIONERY", "HOME_LIVING"],
  CAKES: ["CAKES_BAKERY", "FOOD_DINING"],
};

export function generateAllStoreAssortments(
  stores: StoreDefinition[],
  rng: SeededRNG
): Map<string, StoreAssortmentOffer[]> {
  const activeStores = stores.filter((s) => s.status === "ACTIVE");
  const storeAssortments = new Map<string, Set<ProductTemplate>>();

  for (const store of stores) {
    storeAssortments.set(store.slug, new Set<ProductTemplate>());
  }

  // 1. Guaranteed baseline: Assign every one of the 180 products to at least 1 active store
  for (const prod of DEMO_PRODUCT_TEMPLATES) {
    const matching = activeStores.filter((s) =>
      (STORE_VERTICAL_MAP[s.vertical] || ["GROCERIES"]).includes(prod.ptCode)
    );
    const chosen = matching.length > 0 ? rng.element(matching) : rng.element(activeStores);
    storeAssortments.get(chosen.slug)!.add(prod);
  }

  // 2. Target top-up for active stores: reach 14-16 items per active store
  for (const s of activeStores) {
    const current = storeAssortments.get(s.slug)!;
    const allowed = STORE_VERTICAL_MAP[s.vertical] || ["GROCERIES"];
    const candidates = DEMO_PRODUCT_TEMPLATES.filter(
      (t) => allowed.includes(t.ptCode) && !current.has(t)
    );
    const target = rng.int(14, 16);
    const needed = Math.max(0, target - current.size);
    const extras = rng.sample(candidates, Math.min(needed, candidates.length));
    for (const x of extras) current.add(x);
  }

  // 3. Populate non-active stores with realistic candidate assortments (10-12 items)
  for (const s of stores.filter((st) => st.status !== "ACTIVE")) {
    const current = storeAssortments.get(s.slug)!;
    const allowed = STORE_VERTICAL_MAP[s.vertical] || ["GROCERIES"];
    const candidates = DEMO_PRODUCT_TEMPLATES.filter((t) => allowed.includes(t.ptCode));
    const count = Math.min(candidates.length, rng.int(10, 12));
    const selected = rng.sample(candidates, count);
    for (const x of selected) current.add(x);
  }

  // Convert Sets to StoreAssortmentOffer arrays
  const result = new Map<string, StoreAssortmentOffer[]>();
  for (const store of stores) {
    const set = storeAssortments.get(store.slug)!;
    const items = Array.from(set).map((tpl, idx) => {
      const multiplier = 1 + rng.float(-0.08, 0.08);
      const price = Math.round(tpl.basePrice * multiplier * 2) / 2;
      const sku = `${store.slug.substring(0, 4).toUpperCase()}-${tpl.key.substring(5, 12)}-${idx + 1}`;
      const barcode = `600${rng.int(1000000000, 9999999999)}`;
      const inventoryQuantity =
        tpl.inventoryTrackingMode === "MADE_TO_ORDER" ? 999 : rng.int(15, 120);

      return {
        productTemplate: tpl,
        sku,
        barcode,
        price,
        inventoryQuantity,
        isPublished: store.status === "ACTIVE",
      };
    });
    result.set(store.slug, items);
  }

  return result;
}

export function generateStoreAssortment(
  store: StoreDefinition,
  rng: SeededRNG
): StoreAssortmentOffer[] {
  const allowed = STORE_VERTICAL_MAP[store.vertical] || ["GROCERIES"];
  let candidates = DEMO_PRODUCT_TEMPLATES.filter((t) => allowed.includes(t.ptCode));
  if (candidates.length === 0) candidates = DEMO_PRODUCT_TEMPLATES.slice(0, 10);

  const count = Math.min(candidates.length, rng.int(12, 16));
  const selected = rng.sample(candidates, count);

  return selected.map((tpl, idx) => {
    const multiplier = 1 + rng.float(-0.08, 0.08);
    const price = Math.round(tpl.basePrice * multiplier * 2) / 2;
    const sku = `${store.slug.substring(0, 4).toUpperCase()}-${tpl.key.substring(5, 12)}-${idx + 1}`;
    const barcode = `600${rng.int(1000000000, 9999999999)}`;
    const inventoryQuantity =
      tpl.inventoryTrackingMode === "MADE_TO_ORDER" ? 999 : rng.int(15, 120);

    return {
      productTemplate: tpl,
      sku,
      barcode,
      price,
      inventoryQuantity,
      isPublished: store.status === "ACTIVE",
    };
  });
}
