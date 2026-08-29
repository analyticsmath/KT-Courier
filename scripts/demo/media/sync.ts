/**
 * KT Couriers — Production-Grade Realistic Demo Media Engine
 * Generates and syncs 100% WebP raster assets with Sharp, computes SHA-256 checksums,
 * syncs to var/catalog-media and writes scripts/demo/media/manifest.ts.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { DEMO_CATEGORIES } from "../fixtures/categories";
import { DEMO_STORES } from "../fixtures/stores";
import { DEMO_PRODUCT_TEMPLATES } from "../fixtures/products";
import { DEMO_DRIVERS } from "../fixtures/drivers";

// 1. Color Palettes by Vertical
const VERTICAL_PALETTES: Record<string, { primary: string; secondary: string; accent: string; bg: string; text: string }> = {
  GROCERIES: { primary: "#047857", secondary: "#10b981", accent: "#a7f3d0", bg: "#f0fdf4", text: "#064e3b" },
  FOOD: { primary: "#c2410c", secondary: "#ea580c", accent: "#fed7aa", bg: "#fff7ed", text: "#7c2d12" },
  PHARMACY: { primary: "#0369a1", secondary: "#0284c7", accent: "#bae6fd", bg: "#f0f9ff", text: "#0c4a6e" },
  FASHION: { primary: "#4338ca", secondary: "#6366f1", accent: "#c7d2fe", bg: "#eef2ff", text: "#312e81" },
  ELECTRONICS: { primary: "#1e293b", secondary: "#334155", accent: "#94a3b8", bg: "#f8fafc", text: "#0f172a" },
  HOME: { primary: "#b45309", secondary: "#d97706", accent: "#fde68a", bg: "#fffbeb", text: "#78350f" },
  BOOKS: { primary: "#854d0e", secondary: "#a16207", accent: "#fef08a", bg: "#fefce8", text: "#713f12" },
  AUTOMOTIVE: { primary: "#374151", secondary: "#4b5563", accent: "#d1d5db", bg: "#f9fafb", text: "#111827" },
  CAKES: { primary: "#be185d", secondary: "#db2777", accent: "#fbcfe8", bg: "#fdf2f8", text: "#831843" },
  FLOWERS: { primary: "#0f766e", secondary: "#0d9488", accent: "#99f6e4", bg: "#f0fdfa", text: "#134e4a" },
  PETS: { primary: "#4d7c0f", secondary: "#65a30d", accent: "#d9f99d", bg: "#f7fee7", text: "#365314" }
};

function getPalette(vertical: string) {
  return VERTICAL_PALETTES[vertical] || VERTICAL_PALETTES.GROCERIES;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function createCategorySvg(title: string, vertical: string, width: number, height: number): string {
  const p = getPalette(vertical);
  const safeTitle = escapeXml(title);
  return `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${p.primary}" />
        <stop offset="50%" stop-color="${p.secondary}" />
        <stop offset="100%" stop-color="${p.primary}" />
      </linearGradient>
      <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.15" />
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0.05" />
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.25" />
      </filter>
    </defs>
    
    <rect width="100%" height="100%" fill="url(#bgGrad)" />
    <circle cx="${width * 0.85}" cy="${height * 0.3}" r="${height * 0.45}" fill="#ffffff" fill-opacity="0.06" />
    <circle cx="${width * 0.15}" cy="${height * 0.8}" r="${height * 0.35}" fill="#ffffff" fill-opacity="0.04" />
    <polygon points="${width * 0.7},${height * 0.8} ${width * 0.95},${height * 0.95} ${width * 0.8},${height * 0.5}" fill="#ffffff" fill-opacity="0.04" />

    <rect x="${width * 0.08}" y="${height * 0.2}" width="${width * 0.84}" height="${height * 0.6}" rx="24" fill="url(#cardGrad)" stroke="#ffffff" stroke-opacity="0.2" stroke-width="2" filter="url(#shadow)" />
    <rect x="${width * 0.12}" y="${height * 0.32}" width="220" height="40" rx="20" fill="${p.accent}" fill-opacity="0.3" />
    <text x="${width * 0.12 + 110}" y="${height * 0.32 + 25}" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="1">KT COURIERS</text>

    <text x="${width * 0.12}" y="${height * 0.52}" font-family="system-ui, -apple-system, sans-serif" font-size="54" font-weight="800" fill="#ffffff" letter-spacing="-0.5">${safeTitle}</text>
    <text x="${width * 0.12}" y="${height * 0.62}" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="500" fill="#ffffff" fill-opacity="0.85">Verified South African Marketplace Assortment</text>
  </svg>`;
}

function createStoreHeroSvg(storeName: string, city: string, vertical: string, width: number, height: number): string {
  const p = getPalette(vertical);
  const safeName = escapeXml(storeName);
  const safeCity = escapeXml(city);
  return `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="heroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${p.primary}" />
        <stop offset="100%" stop-color="#0f172a" />
      </linearGradient>
      <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${p.secondary}" />
        <stop offset="100%" stop-color="${p.accent}" />
      </linearGradient>
    </defs>
    
    <rect width="100%" height="100%" fill="url(#heroGrad)" />
    <line x1="0" y1="${height * 0.7}" x2="${width}" y2="${height * 0.7}" stroke="#ffffff" stroke-opacity="0.08" stroke-width="1" />
    <line x1="0" y1="${height * 0.4}" x2="${width}" y2="${height * 0.4}" stroke="#ffffff" stroke-opacity="0.08" stroke-width="1" />
    <line x1="${width * 0.6}" y1="0" x2="${width * 0.6}" y2="${height}" stroke="#ffffff" stroke-opacity="0.08" stroke-width="1" />
    <circle cx="${width * 0.8}" cy="${height * 0.5}" r="${height * 0.4}" fill="url(#accentGrad)" fill-opacity="0.15" />

    <rect x="${width * 0.08}" y="${height * 0.28}" width="160" height="36" rx="18" fill="#ffffff" fill-opacity="0.2" />
    <text x="${width * 0.08 + 80}" y="${height * 0.28 + 23}" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">OFFICIAL STORE</text>

    <text x="${width * 0.08}" y="${height * 0.52}" font-family="system-ui, -apple-system, sans-serif" font-size="58" font-weight="800" fill="#ffffff">${safeName}</text>
    <text x="${width * 0.08}" y="${height * 0.64}" font-family="system-ui, -apple-system, sans-serif" font-size="26" font-weight="500" fill="${p.accent}">${safeCity}, South Africa • Same-Day Dispatch</text>
  </svg>`;
}

function createStoreLogoSvg(storeName: string, vertical: string, width: number, height: number): string {
  const p = getPalette(vertical);
  const initials = storeName.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const safeInitials = escapeXml(initials);
  return `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="logoBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${p.primary}" />
        <stop offset="100%" stop-color="${p.secondary}" />
      </linearGradient>
      <filter id="logoShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.2" />
      </filter>
    </defs>
    
    <rect width="100%" height="100%" fill="#ffffff" rx="${width * 0.2}" />
    <circle cx="${width * 0.5}" cy="${height * 0.5}" r="${width * 0.42}" fill="url(#logoBg)" filter="url(#logoShadow)" />
    <circle cx="${width * 0.5}" cy="${height * 0.5}" r="${width * 0.38}" fill="none" stroke="#ffffff" stroke-opacity="0.3" stroke-width="3" />
    <text x="${width * 0.5}" y="${height * 0.5 + 42}" font-family="system-ui, -apple-system, sans-serif" font-size="${width * 0.32}" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="2">${safeInitials}</text>
  </svg>`;
}

function createProductSvg(title: string, brand: string | undefined, angleIndex: number, vertical: string, width: number, height: number): string {
  const p = getPalette(vertical);
  const safeTitle = escapeXml(title);
  const safeBrand = escapeXml(brand || "KT Selection");
  const angleLabels = ["Hero Presentation", "Detail and Texture", "Packaging and Contents"];
  const angleLabel = angleLabels[angleIndex] || "Product View";
  
  return `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="prodBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f8fafc" />
        <stop offset="100%" stop-color="#e2e8f0" />
      </linearGradient>
      <linearGradient id="pedestalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" />
        <stop offset="100%" stop-color="#cbd5e1" />
      </linearGradient>
      <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${p.primary}" />
        <stop offset="100%" stop-color="${p.secondary}" />
      </linearGradient>
      <filter id="prodShadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="20" stdDeviation="24" flood-color="#0f172a" flood-opacity="0.15" />
      </filter>
    </defs>
    
    <rect width="100%" height="100%" fill="url(#prodBg)" />
    <circle cx="${width * 0.5}" cy="${height * 0.45}" r="${width * 0.45}" fill="#ffffff" fill-opacity="0.8" />
    <ellipse cx="${width * 0.5}" cy="${height * 0.82}" rx="${width * 0.38}" ry="${height * 0.09}" fill="url(#pedestalGrad)" filter="url(#prodShadow)" />

    <g filter="url(#prodShadow)">
      <rect x="${width * 0.22}" y="${height * 0.2}" width="${width * 0.56}" height="${height * 0.56}" rx="32" fill="url(#accentGrad)" />
      <rect x="${width * 0.24}" y="${height * 0.22}" width="${width * 0.52}" height="${height * 0.52}" rx="24" fill="#ffffff" fill-opacity="0.95" />
      
      <rect x="${width * 0.3}" y="${height * 0.28}" width="${width * 0.4}" height="32" rx="16" fill="${p.bg}" />
      <text x="${width * 0.5}" y="${height * 0.28 + 21}" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" fill="${p.primary}" text-anchor="middle" letter-spacing="1">${safeBrand.toUpperCase()}</text>

      <circle cx="${width * 0.5}" cy="${height * 0.46}" r="${width * 0.12}" fill="url(#accentGrad)" />
      <text x="${width * 0.5}" y="${height * 0.46 + 18}" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="800" fill="#ffffff" text-anchor="middle">${angleIndex + 1}</text>

      <text x="${width * 0.5}" y="${height * 0.64}" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="600" fill="${p.text}" text-anchor="middle">${angleLabel}</text>
    </g>

    <text x="${width * 0.5}" y="${height * 0.94}" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="700" fill="#1e293b" text-anchor="middle">${safeTitle}</text>
  </svg>`;
}

function createAvatarSvg(name: string, index: number, width: number, height: number): string {
  const initials = name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const hues = ["#047857", "#0369a1", "#4338ca", "#b45309", "#be185d", "#0f766e"];
  const color = hues[index % hues.length];
  
  return `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="avatarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${color}" />
        <stop offset="100%" stop-color="#0f172a" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="#f1f5f9" />
    <circle cx="${width * 0.5}" cy="${height * 0.5}" r="${width * 0.45}" fill="url(#avatarGrad)" />
    <circle cx="${width * 0.5}" cy="${height * 0.5}" r="${width * 0.42}" fill="none" stroke="#ffffff" stroke-width="4" stroke-opacity="0.4" />
    <text x="${width * 0.5}" y="${height * 0.5 + 55}" font-family="system-ui, -apple-system, sans-serif" font-size="${width * 0.36}" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="3">${escapeXml(initials)}</text>
  </svg>`;
}

function createVehicleSvg(type: string, width: number, height: number): string {
  return `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="vGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#047857" />
        <stop offset="100%" stop-color="#064e3b" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="#f8fafc" />
    <rect x="${width * 0.1}" y="${height * 0.15}" width="${width * 0.8}" height="${height * 0.7}" rx="24" fill="url(#vGrad)" />
    <text x="${width * 0.5}" y="${height * 0.48}" font-family="system-ui, -apple-system, sans-serif" font-size="54" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="2">${type.toUpperCase()}</text>
    <text x="${width * 0.5}" y="${height * 0.62}" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="600" fill="#a7f3d0" text-anchor="middle">KT Couriers Verified Fleet Vehicle</text>
  </svg>`;
}

export interface ManifestItem {
  publicReference: string;
  storageKey: string;
  relativePath: string;
  width: number;
  height: number;
  mimeType: "image/webp";
  byteSize: number;
  checksum: string;
  purpose: "PRODUCT_IMAGE" | "VARIANT_IMAGE" | "CATEGORY_IMAGE" | "BRAND_LOGO" | "STORE_LOGO" | "STORE_HERO" | "COMPLIANCE_DOCUMENT";
  alt: string;
  license: string;
  source: string;
}

export async function syncDemoMedia(): Promise<ManifestItem[]> {
  console.log("--- Starting KT Couriers Demo Media Processor ---");
  const manifest: ManifestItem[] = [];
  const storageDir = path.join(process.cwd(), "var", "catalog-media");
  if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

  console.log(`Loaded: ${DEMO_CATEGORIES.length} categories, ${DEMO_STORES.length} stores, ${DEMO_PRODUCT_TEMPLATES.length} products, ${DEMO_DRIVERS.length} drivers.`);

  async function processMedia(svgString: string, destRelPath: string, meta: {
    publicReference: string;
    width: number;
    height: number;
    purpose: ManifestItem["purpose"];
    alt: string;
  }) {
    const fullDestPath = path.join(process.cwd(), "public", "demo-media", destRelPath);
    const destDir = path.dirname(fullDestPath);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const webpBuffer = await sharp(Buffer.from(svgString))
      .webp({ quality: 85, smartSubsample: true, effort: 5 })
      .toBuffer();

    fs.writeFileSync(fullDestPath, webpBuffer);

    const checksum = crypto.createHash("sha256").update(webpBuffer).digest("hex");
    const byteSize = webpBuffer.length;
    const keyHash = crypto.createHash("sha256").update(meta.publicReference).digest("hex");
    const storageKey = `catalog-media/${keyHash}`;
    
    // Write to var/catalog-media by keyHash and checksum
    fs.writeFileSync(path.join(storageDir, keyHash), webpBuffer);
    fs.writeFileSync(path.join(storageDir, `${keyHash}.webp`), webpBuffer);
    fs.writeFileSync(path.join(storageDir, checksum), webpBuffer);
    fs.writeFileSync(path.join(storageDir, `${checksum}.webp`), webpBuffer);

    // Also write to var/catalog-media/catalog-media/ for nested root resolution
    const subDir = path.join(storageDir, "catalog-media");
    if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, keyHash), webpBuffer);
    fs.writeFileSync(path.join(subDir, `${keyHash}.webp`), webpBuffer);
    fs.writeFileSync(path.join(subDir, checksum), webpBuffer);
    fs.writeFileSync(path.join(subDir, `${checksum}.webp`), webpBuffer);

    manifest.push({
      publicReference: meta.publicReference,
      storageKey,
      relativePath: destRelPath,
      width: meta.width,
      height: meta.height,
      mimeType: "image/webp",
      byteSize,
      checksum,
      purpose: meta.purpose,
      alt: meta.alt,
      license: "KT Couriers Curated Demo Universe Asset (CC0-equivalent synthetic visual)",
      source: "Internal Procedural Rasterizer via Sharp"
    });
  }

  // 1. Categories
  for (const cat of DEMO_CATEGORIES) {
    const width = 1600;
    const height = 1000;
    const svg = createCategorySvg(cat.name, cat.ptCode, width, height);
    await processMedia(svg, `categories/${cat.slug}.webp`, {
      publicReference: cat.imageRef,
      width,
      height,
      purpose: "CATEGORY_IMAGE",
      alt: `${cat.name} category banner`
    });
  }

  // 2. Stores
  for (const store of DEMO_STORES) {
    const logoSvg = createStoreLogoSvg(store.name, store.vertical, 512, 512);
    await processMedia(logoSvg, `stores/logos/${store.slug}.webp`, {
      publicReference: store.logoRef,
      width: 512,
      height: 512,
      purpose: "STORE_LOGO",
      alt: `${store.name} official store logo`
    });

    const heroSvg = createStoreHeroSvg(store.name, store.city, store.vertical, 1800, 1000);
    await processMedia(heroSvg, `stores/heroes/${store.slug}.webp`, {
      publicReference: store.heroRef,
      width: 1800,
      height: 1000,
      purpose: "STORE_HERO",
      alt: `${store.name} storefront hero banner`
    });
  }

  // 3. Products (3 gallery images per template)
  for (const prod of DEMO_PRODUCT_TEMPLATES) {
    for (let idx = 0; idx < prod.imageKeys.length; idx++) {
      const imgKey = prod.imageKeys[idx]!;
      const width = 1200;
      const height = 1200;
      const svg = createProductSvg(prod.title, prod.brandName, idx, prod.ptCode, width, height);
      const relPath = `products/${prod.key.toLowerCase()}-v${idx + 1}.webp`;
      await processMedia(svg, relPath, {
        publicReference: imgKey,
        width,
        height,
        purpose: "PRODUCT_IMAGE",
        alt: `${prod.title} view ${idx + 1}`
      });
    }
  }

  // 4. Vehicles
  const vTypes = ["MOTORCYCLE", "CAR", "VAN", "TRUCK"];
  for (const vt of vTypes) {
    const svg = createVehicleSvg(vt, 1400, 1000);
    await processMedia(svg, `vehicles/${vt.toLowerCase()}.webp`, {
      publicReference: `CMA-VEHICLE-${vt}`,
      width: 1400,
      height: 1000,
      purpose: "BRAND_LOGO",
      alt: `KT Couriers fleet ${vt.toLowerCase()} delivery vehicle`
    });
  }

  // 5. Driver Avatars
  for (let i = 0; i < DEMO_DRIVERS.length; i++) {
    const drv = DEMO_DRIVERS[i]!;
    const svg = createAvatarSvg(drv.name, i, 800, 800);
    await processMedia(svg, `avatars/driver-${i + 1}.webp`, {
      publicReference: drv.avatarRef,
      width: 800,
      height: 800,
      purpose: "BRAND_LOGO",
      alt: `${drv.name} profile portrait`
    });
  }

  // Write compiled manifest.ts
  const manifestTs = `/**
 * KT Couriers — Curated Catalog Media Manifest
 * Contains ${manifest.length} pre-compiled WebP media assets with verified byte lengths,
 * SHA-256 checksums, and strict provenance records.
 */

export interface CatalogMediaManifestEntry {
  publicReference: string;
  storageKey: string;
  relativePath: string;
  width: number;
  height: number;
  mimeType: "image/webp";
  byteSize: number;
  checksum: string;
  purpose: "PRODUCT_IMAGE" | "VARIANT_IMAGE" | "CATEGORY_IMAGE" | "BRAND_LOGO" | "STORE_LOGO" | "STORE_HERO" | "COMPLIANCE_DOCUMENT";
  alt: string;
  license: string;
  source: string;
}

export const DEMO_MEDIA_MANIFEST: CatalogMediaManifestEntry[] = ${JSON.stringify(manifest, null, 2)};
`;

  fs.writeFileSync(path.join(process.cwd(), "scripts", "demo", "media", "manifest.ts"), manifestTs, "utf8");
  console.log(`Manifest written with ${manifest.length} verified WebP assets.`);

  // Verify all generated WebP assets using Sharp decoder
  console.log("Verifying generated WebP files with Sharp decoder...");
  let verifyErrors = 0;
  for (const entry of manifest) {
    const fullPath = path.join(process.cwd(), "public", "demo-media", entry.relativePath);
    if (!fs.existsSync(fullPath)) {
      console.error(`File missing: ${fullPath}`);
      verifyErrors++;
      continue;
    }
    const meta = await sharp(fullPath).metadata();
    if (meta.format !== "webp") {
      console.error(`Invalid format for ${entry.publicReference}: expected webp, got ${meta.format}`);
      verifyErrors++;
    }
    if (meta.width !== entry.width || meta.height !== entry.height) {
      console.error(`Dimension mismatch for ${entry.publicReference}: expected ${entry.width}x${entry.height}, got ${meta.width}x${meta.height}`);
      verifyErrors++;
    }
  }

  if (verifyErrors > 0) {
    throw new Error(`Verification FAILED with ${verifyErrors} errors.`);
  }

  console.log(`SUCCESS: All ${manifest.length} WebP media assets generated, synced, and verified with Sharp!`);
  return manifest;
}

if (require.main === module || process.argv[1]?.endsWith("sync.ts")) {
  syncDemoMedia().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
