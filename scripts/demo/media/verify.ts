/**
 * KT Couriers — Demo Media Integrity & Provenance Validator
 * 
 * Verifies 100% offline:
 * 1. ZERO gated catalog media in public/ (enforces storage gate isolation).
 * 2. All assets in DEMO_MEDIA_MANIFEST exist in var/catalog-media/ with exact SHA-256 checksum and byteSize.
 * 3. Sharp decodes every file as WebP with matching dimensions.
 * 4. Dynamic entity coverage:
 *    - All published products have >= 3 distinct photos (distinct URLs, distinct SHA-256 hashes).
 *    - All 32 categories have verified hero banners.
 *    - All 20 stores have verified hero photos and store logos.
 *    - All 4 vehicles and 24 driver avatars have verified assets.
 * 5. Full provenance completeness in docs/demo-data/media-provenance.json with absolute HTTPS URLs.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { DEMO_MEDIA_MANIFEST } from "./manifest";
import { DEMO_CATEGORIES } from "../fixtures/categories";
import { DEMO_STORES } from "../fixtures/stores";
import { DEMO_PRODUCT_TEMPLATES } from "../fixtures/products";
import { DEMO_DRIVERS } from "../fixtures/drivers";

export async function verifyCatalogMediaIntegrity(): Promise<{ verifiedCount: number; errors: string[] }> {
  console.log(`[MediaVerify] Verifying ${DEMO_MEDIA_MANIFEST.length} catalog media assets offline...`);
  const errors: string[] = [];
  let count = 0;

  // 1. Enforce that NO gated catalog media exists in public/
  const publicDemoMedia = path.join(process.cwd(), "public", "demo-media");
  if (fs.existsSync(publicDemoMedia)) {
    const files = fs.readdirSync(publicDemoMedia);
    if (files.length > 0) {
      errors.push(`Gated catalog media violation: public/demo-media contains ${files.length} items. All gated media must reside strictly in var/catalog-media/ outside public/.`);
    }
  }

  // 2. Verify all manifest assets in storage
  const storageDir = path.join(process.cwd(), "var", "catalog-media");
  if (!fs.existsSync(storageDir)) {
    errors.push(`Storage directory missing: ${storageDir}`);
    return { verifiedCount: 0, errors };
  }

  const manifestMap = new Map<string, typeof DEMO_MEDIA_MANIFEST[0]>();
  for (const entry of DEMO_MEDIA_MANIFEST) {
    manifestMap.set(entry.publicReference, entry);

    // Look for file by checksum.webp or storageKey
    const storagePathChecksum = path.join(storageDir, `${entry.checksum}.webp`);
    const keyHash = crypto.createHash("sha256").update(entry.publicReference).digest("hex");
    const storagePathKeyHash = path.join(storageDir, `${keyHash}.webp`);
    const storagePathDirect = path.join(storageDir, keyHash);

    const candidate = [storagePathChecksum, storagePathKeyHash, storagePathDirect].find(p => fs.existsSync(p));
    if (!candidate) {
      errors.push(`Storage file missing for ${entry.publicReference} (tried ${entry.checksum}.webp and ${keyHash}.webp)`);
      continue;
    }

    const buf = fs.readFileSync(candidate);
    const hash = crypto.createHash("sha256").update(buf).digest("hex");
    if (hash !== entry.checksum) {
      errors.push(`Checksum mismatch for ${entry.publicReference}: expected ${entry.checksum}, got ${hash}`);
      continue;
    }

    if (buf.length !== entry.byteSize) {
      errors.push(`Byte size mismatch for ${entry.publicReference}: expected ${entry.byteSize}, got ${buf.length}`);
      continue;
    }

    // Decode with Sharp
    try {
      const meta = await sharp(buf).metadata();
      if (meta.format !== "webp") {
        errors.push(`Format mismatch for ${entry.publicReference}: expected webp, got ${meta.format}`);
      }
      if (meta.width !== entry.width || meta.height !== entry.height) {
        errors.push(`Dimension mismatch for ${entry.publicReference}: expected ${entry.width}x${entry.height}, got ${meta.width}x${meta.height}`);
      }
    } catch (e: any) {
      errors.push(`Sharp decode failed for ${entry.publicReference}: ${e?.message || e}`);
    }

    count++;
  }

  // 3. Dynamic Entity Coverage Checks
  // Categories: all 32 categories
  for (const cat of DEMO_CATEGORIES) {
    const entry = manifestMap.get(cat.imageRef);
    if (!entry) {
      errors.push(`Category ${cat.name} (${cat.ref}) is missing manifest entry for ${cat.imageRef}`);
    } else if (entry.purpose !== "CATEGORY_IMAGE") {
      errors.push(`Category ${cat.name} has incorrect purpose: ${entry.purpose}`);
    }
  }

  // Stores: all 20 stores (hero and logo)
  for (const store of DEMO_STORES) {
    const heroEntry = manifestMap.get(store.heroRef);
    if (!heroEntry) {
      errors.push(`Store ${store.name} is missing hero entry for ${store.heroRef}`);
    } else if (heroEntry.purpose !== "STORE_HERO") {
      errors.push(`Store ${store.name} hero has incorrect purpose: ${heroEntry.purpose}`);
    }

    const logoEntry = manifestMap.get(store.logoRef);
    if (!logoEntry) {
      errors.push(`Store ${store.name} is missing logo entry for ${store.logoRef}`);
    } else if (logoEntry.purpose !== "STORE_LOGO") {
      errors.push(`Store ${store.name} logo has incorrect purpose: ${logoEntry.purpose}`);
    }
  }

  // Vehicles: 4 types
  for (const vt of ["MOTORCYCLE", "CAR", "VAN", "TRUCK"]) {
    const ref = `CMA-VEHICLE-${vt}`;
    const entry = manifestMap.get(ref);
    if (!entry) {
      errors.push(`Vehicle ${vt} is missing manifest entry for ${ref}`);
    }
  }

  // Drivers: 24 drivers
  for (const drv of DEMO_DRIVERS) {
    const entry = manifestMap.get(drv.avatarRef);
    if (!entry) {
      errors.push(`Driver ${drv.name} is missing avatar entry for ${drv.avatarRef}`);
    }
  }

  // Products: all 180 products, >= 3 distinct photos per product
  for (const prod of DEMO_PRODUCT_TEMPLATES) {
    if (!prod.imageKeys || prod.imageKeys.length < 3) {
      errors.push(`Product ${prod.title} (${prod.key}) has fewer than 3 imageKeys`);
      continue;
    }

    const prodEntries = prod.imageKeys.map(k => manifestMap.get(k)).filter(Boolean) as typeof DEMO_MEDIA_MANIFEST;
    if (prodEntries.length < 3) {
      errors.push(`Product ${prod.title} (${prod.key}) has missing manifest entries (${prodEntries.length}/3 found)`);
      continue;
    }

    // Deduplication check: all 3 photos must have distinct checksums and distinct source URLs
    const checksums = new Set(prodEntries.map(e => e.checksum));
    if (checksums.size < 3) {
      errors.push(`Product ${prod.title} (${prod.key}) violates image distinctness: only ${checksums.size}/3 unique checksums`);
    }

    const sourceUrls = new Set(prodEntries.map(e => e.sourceUrl));
    if (sourceUrls.size < 3) {
      errors.push(`Product ${prod.title} (${prod.key}) violates image distinctness: only ${sourceUrls.size}/3 unique source URLs`);
    }
  }

  // 4. Provenance Manifest Verification
  const provenancePath = path.join(process.cwd(), "docs", "demo-data", "media-provenance.json");
  if (!fs.existsSync(provenancePath)) {
    errors.push(`Provenance manifest missing: ${provenancePath}`);
  } else {
    try {
      const provenanceData = JSON.parse(fs.readFileSync(provenancePath, "utf8"));
      if (!Array.isArray(provenanceData) || provenanceData.length !== DEMO_MEDIA_MANIFEST.length) {
        errors.push(`Provenance record count mismatch: expected ${DEMO_MEDIA_MANIFEST.length}, got ${provenanceData.length}`);
      }

      for (const p of provenanceData) {
        if (!p.publicReference || !p.provider || !p.author || !p.license || !p.subject) {
          errors.push(`Incomplete provenance fields for ${p.publicReference}`);
        }
        if (!p.pageUrl || !p.pageUrl.startsWith("https://")) {
          errors.push(`Invalid pageUrl for ${p.publicReference}: must be absolute https URL (got ${p.pageUrl})`);
        }
        if (!p.assetUrl || !p.assetUrl.startsWith("https://")) {
          errors.push(`Invalid assetUrl for ${p.publicReference}: must be absolute https URL (got ${p.assetUrl})`);
        }
      }
    } catch (e: any) {
      errors.push(`Provenance manifest parse error: ${e.message}`);
    }
  }

  if (errors.length === 0) {
    console.log(`[MediaVerify] SUCCESS: All ${count} media assets verified byte-for-byte with Sharp.`);
    console.log(`[MediaVerify] SUCCESS: Dynamic entity coverage and distinct photography verified across all products, categories, stores, vehicles, and drivers.`);
    console.log(`[MediaVerify] SUCCESS: Provenance manifest complete with 100% absolute HTTPS URLs.`);
  } else {
    console.error(`[MediaVerify] FAILED with ${errors.length} errors.`);
    for (const err of errors.slice(0, 10)) {
      console.error(`  - ${err}`);
    }
    if (errors.length > 10) {
      console.error(`  ... and ${errors.length - 10} more errors.`);
    }
  }

  return { verifiedCount: count, errors };
}

if (require.main === module || process.argv[1]?.endsWith("verify.ts")) {
  verifyCatalogMediaIntegrity().then(res => {
    if (res.errors.length > 0) process.exit(1);
  });
}
