import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { verifyCatalogMediaIntegrity } from "@/scripts/demo/media/verify";
import { DEMO_MEDIA_MANIFEST } from "@/scripts/demo/media/manifest";
import { DEMO_PRODUCT_TEMPLATES } from "@/scripts/demo/fixtures/products";
import { DEMO_CATEGORIES } from "@/scripts/demo/fixtures/categories";
import { DEMO_STORES } from "@/scripts/demo/fixtures/stores";
import { DEMO_DRIVERS } from "@/scripts/demo/fixtures/drivers";

describe("Photographic Media Integrity, Provenance & Dynamic Entity Coverage", () => {
  it("verifies all 640 catalog media assets 100% offline via verifyCatalogMediaIntegrity()", async () => {
    const result = await verifyCatalogMediaIntegrity();
    expect(result.errors).toEqual([]);
    expect(result.verifiedCount).toBe(640);
  });

  it("verifies zero gated catalog media exists in public/demo-media/", () => {
    const publicDir = path.join(process.cwd(), "public", "demo-media");
    if (fs.existsSync(publicDir)) {
      const files = fs.readdirSync(publicDir);
      expect(files.length).toBe(0);
    } else {
      expect(fs.existsSync(publicDir)).toBe(false);
    }
  });

  it("verifies dynamic entity coverage: 180 products have >= 3 distinct photos and distinct URLs", () => {
    const manifestMap = new Map(DEMO_MEDIA_MANIFEST.map((m) => [m.publicReference, m]));
    expect(DEMO_PRODUCT_TEMPLATES.length).toBe(180);

    for (const prod of DEMO_PRODUCT_TEMPLATES) {
      expect(prod.imageKeys.length).toBeGreaterThanOrEqual(3);
      const entries = prod.imageKeys.map((k) => manifestMap.get(k)).filter(Boolean);
      expect(entries.length).toBe(prod.imageKeys.length);

      const uniqueChecksums = new Set(entries.map((e) => e!.checksum));
      expect(uniqueChecksums.size).toBeGreaterThanOrEqual(3);

      const uniqueUrls = new Set(entries.map((e) => e!.sourceUrl));
      expect(uniqueUrls.size).toBeGreaterThanOrEqual(3);
    }
  });

  it("verifies dynamic entity coverage: all 32 categories have valid category hero banners", () => {
    const manifestMap = new Map(DEMO_MEDIA_MANIFEST.map((m) => [m.publicReference, m]));
    expect(DEMO_CATEGORIES.length).toBe(32);

    for (const cat of DEMO_CATEGORIES) {
      const entry = manifestMap.get(cat.imageRef);
      expect(entry).toBeDefined();
      expect(entry!.purpose).toBe("CATEGORY_IMAGE");
      expect(entry!.mimeType).toBe("image/webp");
    }
  });

  it("verifies dynamic entity coverage: all 20 stores have heroes and logos", () => {
    const manifestMap = new Map(DEMO_MEDIA_MANIFEST.map((m) => [m.publicReference, m]));
    expect(DEMO_STORES.length).toBe(20);

    for (const store of DEMO_STORES) {
      const hero = manifestMap.get(store.heroRef);
      expect(hero).toBeDefined();
      expect(hero!.purpose).toBe("STORE_HERO");

      const logo = manifestMap.get(store.logoRef);
      expect(logo).toBeDefined();
      expect(logo!.purpose).toBe("STORE_LOGO");
    }
  });

  it("verifies dynamic entity coverage: all 4 vehicles and 24 driver avatars exist", () => {
    const manifestMap = new Map(DEMO_MEDIA_MANIFEST.map((m) => [m.publicReference, m]));

    for (const vt of ["MOTORCYCLE", "CAR", "VAN", "TRUCK"]) {
      const vehicle = manifestMap.get(`CMA-VEHICLE-${vt}`);
      expect(vehicle).toBeDefined();
    }

    expect(DEMO_DRIVERS.length).toBe(24);
    for (const drv of DEMO_DRIVERS) {
      const avatar = manifestMap.get(drv.avatarRef);
      expect(avatar).toBeDefined();
    }
  });

  it("verifies provenance records completeness, absolute HTTPS URLs, and zero PDF/procedural scans", () => {
    const provenancePath = path.join(process.cwd(), "docs", "demo-data", "media-provenance.json");
    expect(fs.existsSync(provenancePath)).toBe(true);

    const provenance = JSON.parse(fs.readFileSync(provenancePath, "utf8"));
    expect(Array.isArray(provenance)).toBe(true);
    expect(provenance.length).toBe(640);

    for (const entry of provenance) {
      expect(entry.publicReference).toBeTruthy();
      expect(entry.provider).toBeTruthy();
      expect(entry.author).toBeTruthy();
      expect(entry.license).toBeTruthy();
      expect(entry.subject).toBeTruthy();

      // Absolute HTTPS URLs
      expect(entry.pageUrl).toMatch(/^https:\/\//);
      expect(entry.assetUrl).toMatch(/^https:\/\//);

      // No PDF or procedural files
      expect(entry.pageUrl).not.toMatch(/\.pdf$/i);
      expect(entry.assetUrl).not.toMatch(/\.pdf$/i);
    }
  });
});
