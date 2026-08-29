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

export function generateStoreAssortment(store: StoreDefinition, rng: SeededRNG): StoreAssortmentOffer[] {
  // Find matching templates for this store's vertical or category
  let candidates = DEMO_PRODUCT_TEMPLATES.filter(t => {
    if (store.vertical === "GROCERIES") return t.ptCode === "GROCERIES";
    if (store.vertical === "FOOD") return t.ptCode === "FOOD_DINING";
    if (store.vertical === "PHARMACY") return t.ptCode === "HEALTH_WELLNESS";
    if (store.vertical === "FASHION") return t.ptCode === "FASHION_APPAREL";
    if (store.vertical === "ELECTRONICS") return t.ptCode === "ELECTRONICS";
    if (store.vertical === "HOME") return t.ptCode === "HOME_LIVING";
    if (store.vertical === "BOOKS") return t.ptCode === "BOOKS_STATIONERY";
    if (store.vertical === "AUTOMOTIVE") return t.ptCode === "AUTOMOTIVE";
    if (store.vertical === "CAKES") return t.ptCode === "CAKES_BAKERY";
    if (store.vertical === "FLOWERS") return t.ptCode === "FLOWERS_PLANTS";
    if (store.vertical === "PETS") return t.ptCode === "PET_CARE";
    return true;
  });

  if (candidates.length === 0) {
    candidates = DEMO_PRODUCT_TEMPLATES.slice(0, 5);
  }

  // Pick between 6 and 18 products per store (or all available candidates)
  const count = Math.min(candidates.length, rng.int(6, 16));
  const selected = rng.sample(candidates, count);

  return selected.map((tpl, idx) => {
    // Store price variation: +/- 8% from basePrice
    const multiplier = 1 + (rng.float(-0.08, 0.08));
    const price = Math.round(tpl.basePrice * multiplier * 2) / 2; // round to .00 or .50
    const sku = `${store.slug.substring(0, 4).toUpperCase()}-${tpl.key.substring(5, 12)}-${idx + 1}`;
    const barcode = `600${rng.int(1000000000, 9999999999)}`;
    const inventoryQuantity = tpl.inventoryTrackingMode === "MADE_TO_ORDER" ? 999 : rng.int(15, 120);

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
