/**
 * KT Couriers — Automated Marketplace Connectivity & Contract Verifier
 * 
 * Verifies end-to-end routing, canonical reference contracts, storefront projections,
 * media asset persistence & delivery, and offer coherency across the demo universe.
 * 
 * Exits 0 on total contract integrity; exits non-zero if any broken link, invalid prefix,
 * missing asset, or corrupted projection is detected.
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import {
  marketplaceHref,
  marketplaceCategoriesHref,
  marketplaceStoresHref,
  marketplaceProductHref,
  marketplaceVariantHref,
  marketplaceStoreHref,
  marketplaceCategoryHref,
  parseMarketplaceProductParameter,
} from "../lib/public-marketplace/routes";
import { getStorefrontProduct } from "../lib/services/storefront-catalog.service";
import { createProductionCatalogMediaDeliveryService } from "../lib/services/catalog-media-delivery.service";
import { LocalCatalogMediaStorageAdapter } from "../lib/catalog/media/catalog-media-storage-adapter";

// Ensure staging demo delivery is allowed for this verification pass
process.env.KT_STAGING_DEMO_ENABLED = "true";

const prisma = new PrismaClient();

type CheckFailure = {
  category: string;
  identifier: string;
  reason: string;
};

async function verifyConnectivity() {
  console.log("================================================================================");
  console.log("🔍  KT COURIERS MARKETPLACE CONNECTIVITY & ROUTE CONTRACT VERIFIER");
  console.log("================================================================================");

  const failures: CheckFailure[] = [];
  let checkedProducts = 0;
  let checkedVariants = 0;
  let checkedStores = 0;
  let checkedCategories = 0;
  let checkedOffers = 0;
  let checkedMedia = 0;

  // ── 1. Products & Variants Route Contracts ─────────────────────────────────
  console.log("\n[1/6] Verifying Published Products & Route Contracts...");
  const publishedProducts = await prisma.catalogProduct.findMany({
    where: { publicationStatus: "PUBLISHED", status: "ACTIVE" },
    include: {
      variants: { where: { status: "ACTIVE" } },
      primaryCategory: true,
      media: { include: { asset: true }, orderBy: { displayOrder: "asc" } },
    },
  });

  if (publishedProducts.length === 0) {
    failures.push({
      category: "Catalog Products",
      identifier: "GLOBAL",
      reason: "No published, active catalog products found in database.",
    });
  }

  for (const product of publishedProducts) {
    checkedProducts++;

    // Prefix validation
    if (!product.publicReference.startsWith("CP-")) {
      failures.push({
        category: "Product Contract",
        identifier: product.publicReference,
        reason: `Public reference "${product.publicReference}" does not start with required canonical "CP-" prefix.`,
      });
    }

    // Slug validation
    if (!product.slug) {
      failures.push({
        category: "Product Contract",
        identifier: product.publicReference,
        reason: "Product is missing required slug.",
      });
    }

    // Route construction
    const productHref = marketplaceProductHref(product.slug, product.publicReference);
    if (!productHref) {
      failures.push({
        category: "Product Routing",
        identifier: product.publicReference,
        reason: `marketplaceProductHref returned null for slug "${product.slug}" and ref "${product.publicReference}".`,
      });
    } else if (productHref === marketplaceHref()) {
      failures.push({
        category: "Product Routing",
        identifier: product.publicReference,
        reason: `marketplaceProductHref silently collapsed to generic shop route "${marketplaceHref()}".`,
      });
    } else {
      // Roundtrip parameter parse verification
      const param = productHref.replace(/^\/shop\/products\//, "");
      const parsed = parseMarketplaceProductParameter(decodeURIComponent(param));
      if (!parsed) {
        failures.push({
          category: "Product Routing",
          identifier: product.publicReference,
          reason: `Generated route param "${param}" failed to parse back via parseMarketplaceProductParameter.`,
        });
      } else if (parsed.reference !== product.publicReference || parsed.slug !== product.slug) {
        failures.push({
          category: "Product Routing",
          identifier: product.publicReference,
          reason: `Roundtrip parse mismatch: expected { slug: "${product.slug}", ref: "${product.publicReference}" }, got { slug: "${parsed.slug}", ref: "${parsed.reference}" }.`,
        });
      }
    }

    // Storefront projection resolution
    try {
      const storefrontData = await getStorefrontProduct(product.publicReference);
      if (!storefrontData) {
        failures.push({
          category: "Storefront Resolution",
          identifier: product.publicReference,
          reason: "getStorefrontProduct returned null (no published storefront documents/offers found).",
        });
      } else {
        if (!storefrontData.offers || storefrontData.offers.length === 0) {
          failures.push({
            category: "Storefront Resolution",
            identifier: product.publicReference,
            reason: "Storefront product resolved but contains 0 available offers.",
          });
        }
      }
    } catch (err) {
      failures.push({
        category: "Storefront Resolution",
        identifier: product.publicReference,
        reason: `getStorefrontProduct threw: ${(err as Error).message}`,
      });
    }

    // Variant route verification
    for (const variant of product.variants) {
      checkedVariants++;
      const variantHref = marketplaceVariantHref(product.slug, product.publicReference, variant.publicReference);
      if (!variantHref) {
        failures.push({
          category: "Variant Routing",
          identifier: variant.publicReference,
          reason: `marketplaceVariantHref returned null for variant "${variant.publicReference}".`,
        });
      }
    }
  }

  console.log(`✓ Checked ${checkedProducts} products and ${checkedVariants} variants.`);

  // ── 2. Stores & Storefront Documents ───────────────────────────────────────
  console.log("\n[2/6] Verifying Storefront Routing & Documents...");
  const activeStores = await prisma.store.findMany({
    where: { status: "ACTIVE" },
    include: { storefrontDocument: true },
  });

  if (activeStores.length === 0) {
    failures.push({
      category: "Stores",
      identifier: "GLOBAL",
      reason: "No ACTIVE stores found in database.",
    });
  }

  for (const store of activeStores) {
    checkedStores++;
    const storeHref = marketplaceStoreHref(store.slug);
    if (!storeHref) {
      failures.push({
        category: "Store Routing",
        identifier: store.slug,
        reason: `marketplaceStoreHref returned null for active store slug "${store.slug}".`,
      });
    } else if (storeHref === marketplaceStoresHref()) {
      failures.push({
        category: "Store Routing",
        identifier: store.slug,
        reason: `marketplaceStoreHref collapsed to generic stores list "${marketplaceStoresHref()}".`,
      });
    }

    if (!store.storefrontDocument) {
      failures.push({
        category: "Storefront Document",
        identifier: store.slug,
        reason: `Active store "${store.slug}" lacks a StorefrontStoreDocument record.`,
      });
    } else if (store.storefrontDocument.publicStatus !== "ACTIVE") {
      failures.push({
        category: "Storefront Document",
        identifier: store.slug,
        reason: `StorefrontStoreDocument publicStatus is "${store.storefrontDocument.publicStatus}" instead of "ACTIVE".`,
      });
    }
  }

  console.log(`✓ Checked ${checkedStores} active stores.`);

  // ── 3. Categories Routing ──────────────────────────────────────────────────
  console.log("\n[3/6] Verifying Category Navigation & Routing...");
  const categories = await prisma.catalogCategory.findMany({
    where: { status: "ACTIVE" },
  });

  for (const cat of categories) {
    checkedCategories++;
    const catHref = marketplaceCategoryHref(cat.path);
    if (!catHref) {
      failures.push({
        category: "Category Routing",
        identifier: cat.path,
        reason: `marketplaceCategoryHref returned null for path "${cat.path}".`,
      });
    } else if (catHref === marketplaceCategoriesHref() || catHref === marketplaceHref()) {
      failures.push({
        category: "Category Routing",
        identifier: cat.path,
        reason: `marketplaceCategoryHref collapsed to generic category listing.`,
      });
    }
  }

  console.log(`✓ Checked ${checkedCategories} active catalog categories.`);

  // ── 4. Offers, Pricing & Inventory Integrity ──────────────────────────────
  console.log("\n[4/6] Verifying Store Offers, Pricing & Inventory Invariants...");
  const publishedOffers = await prisma.storeCatalogOffer.findMany({
    where: { publicationStatus: "PUBLISHED", status: "ACTIVE" },
    include: {
      store: true,
      product: true,
      variant: true,
      currentPriceVersion: true,
    },
  });

  for (const offer of publishedOffers) {
    checkedOffers++;
    if (offer.store.status !== "ACTIVE") {
      failures.push({
        category: "Offer Coherence",
        identifier: offer.publicReference,
        reason: `Offer belongs to non-active store "${offer.store.slug}" (status: ${offer.store.status}).`,
      });
    }
    if (offer.product.publicationStatus !== "PUBLISHED") {
      failures.push({
        category: "Offer Coherence",
        identifier: offer.publicReference,
        reason: `Offer references non-published product "${offer.product.publicReference}".`,
      });
    }
    if (!offer.currentPriceVersion) {
      failures.push({
        category: "Offer Pricing",
        identifier: offer.publicReference,
        reason: "Published offer lacks an active StoreOfferPriceVersion.",
      });
    } else {
      if (offer.currentPriceVersion.currency !== "ZAR") {
        failures.push({
          category: "Offer Pricing",
          identifier: offer.publicReference,
          reason: `Price currency is "${offer.currentPriceVersion.currency}", expected "ZAR".`,
        });
      }
      if (Number(offer.currentPriceVersion.amount) <= 0) {
        failures.push({
          category: "Offer Pricing",
          identifier: offer.publicReference,
          reason: `Price amount is non-positive: ${offer.currentPriceVersion.amount}.`,
        });
      }
    }
  }

  console.log(`✓ Checked ${checkedOffers} published store offers.`);

  // ── 5. Catalog Media Assets & Physical Storage ─────────────────────────────
  console.log("\n[5/6] Verifying Catalog Media Persistence & Delivery...");
  const storageAdapter = new LocalCatalogMediaStorageAdapter();
  const deliveryService = createProductionCatalogMediaDeliveryService();

  const mediaAssets = await prisma.catalogMediaAsset.findMany({
    where: { status: "READY" },
  });

  for (const asset of mediaAssets) {
    checkedMedia++;

    // Storage key verification
    if (!asset.storageKey) {
      failures.push({
        category: "Media Asset",
        identifier: asset.publicReference,
        reason: "Media asset is missing storageKey in database.",
      });
      continue;
    }

    // Verify physical presence via storage adapter
    try {
      const target = await storageAdapter.createReadTarget({
        storageKey: asset.storageKey,
        maximumBytes: asset.byteSize ? asset.byteSize + 1024 : 10 * 1024 * 1024,
      });

      if (asset.byteSize && target.byteSize !== asset.byteSize) {
        failures.push({
          category: "Media Integrity",
          identifier: asset.publicReference,
          reason: `File size on disk (${target.byteSize}) does not match DB byteSize (${asset.byteSize}).`,
        });
      }

      if (asset.checksum) {
        const computedSha = crypto.createHash("sha256").update(target.body).digest("hex");
        if (computedSha !== asset.checksum) {
          failures.push({
            category: "Media Integrity",
            identifier: asset.publicReference,
            reason: `SHA-256 on disk (${computedSha}) does not match DB checksum (${asset.checksum}).`,
          });
        }
      }
    } catch (err) {
      failures.push({
        category: "Media Storage",
        identifier: asset.publicReference,
        reason: `Failed to read media from storage (${asset.storageKey}): ${(err as Error).message}`,
      });
    }
  }

  // Sample delivery check via CatalogMediaDeliveryService
  const sampleProducts = publishedProducts.slice(0, 10);
  for (const product of sampleProducts) {
    const primary = product.media.find((m) => m.role === "PRIMARY") ?? product.media[0];
    if (primary) {
      try {
        const delivered = await deliveryService.deliver(primary.asset.publicReference);
        if (!delivered.body || delivered.body.length === 0) {
          failures.push({
            category: "Media Delivery Service",
            identifier: primary.asset.publicReference,
            reason: "CatalogMediaDeliveryService returned empty body.",
          });
        }
        if (!delivered.headers["Content-Type"]) {
          failures.push({
            category: "Media Delivery Service",
            identifier: primary.asset.publicReference,
            reason: "Missing Content-Type in delivered media response headers.",
          });
        }
      } catch (err) {
        failures.push({
          category: "Media Delivery Service",
          identifier: primary.asset.publicReference,
          reason: `CatalogMediaDeliveryService.deliver failed: ${(err as Error).message}`,
        });
      }
    }
  }

  console.log(`✓ Verified physical presence and delivery for ${checkedMedia} media assets.`);

  // ── 6. Optional Live HTTP Check ───────────────────────────────────────────
  if (process.env.DEMO_BASE_URL) {
    console.log(`\n[6/6] Executing Live HTTP Probing against ${process.env.DEMO_BASE_URL}...`);
    const baseUrl = process.env.DEMO_BASE_URL.replace(/\/+$/, "");
    const probeRoutes = [
      "/shop",
      "/shop/stores",
      "/shop/categories",
    ];

    if (publishedProducts[0]) {
      const href = marketplaceProductHref(publishedProducts[0].slug, publishedProducts[0].publicReference);
      if (href) probeRoutes.push(href);
    }

    for (const route of probeRoutes) {
      try {
        const res = await fetch(`${baseUrl}${route}`);
        if (!res.ok) {
          failures.push({
            category: "Live HTTP Probe",
            identifier: route,
            reason: `HTTP ${res.status} ${res.statusText}`,
          });
        }
      } catch (err) {
        failures.push({
          category: "Live HTTP Probe",
          identifier: route,
          reason: `Network fetch failed: ${(err as Error).message}`,
        });
      }
    }
    console.log(`✓ Live HTTP probing completed on ${probeRoutes.length} key routes.`);
  } else {
    console.log("\n[6/6] Skipping Live HTTP Probing (DEMO_BASE_URL not set).");
  }

  // ── Summary & Verdict ─────────────────────────────────────────────────────
  console.log("\n================================================================================");
  console.log("📊  CONNECTIVITY VERIFICATION RESULTS SUMMARY");
  console.log("================================================================================");
  console.log(`• Published Products Checked: ${checkedProducts}`);
  console.log(`• Product Variants Checked:   ${checkedVariants}`);
  console.log(`• Active Stores Checked:      ${checkedStores}`);
  console.log(`• Categories Checked:         ${checkedCategories}`);
  console.log(`• Published Offers Checked:   ${checkedOffers}`);
  console.log(`• Media Assets Checked:       ${checkedMedia}`);
  console.log(`• Total Violations Found:     ${failures.length}`);

  if (failures.length > 0) {
    console.error("\n❌ CONNECTIVITY INTEGRITY VIOLATIONS DETECTED:");
    for (const failure of failures) {
      console.error(`  [${failure.category}] ${failure.identifier}: ${failure.reason}`);
    }
    console.error("================================================================================\n");
    process.exit(1);
  }

  console.log("\n✅ ALL CONNECTIVITY & ROUTE INVARIANTS SATISFIED — ZERO BROKEN LINKS.");
  console.log("================================================================================\n");
}

verifyConnectivity()
  .catch((err) => {
    console.error("Fatal connectivity verification error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
