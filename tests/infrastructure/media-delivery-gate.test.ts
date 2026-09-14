import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  LocalCatalogMediaStorageAdapter,
  createProductionCatalogMediaStorageAdapter,
} from "@/lib/catalog/media/catalog-media-storage-adapter";
import {
  isCatalogMediaDeliveryAllowed,
  assertCatalogMediaProductionActionAllowed,
} from "@/lib/catalog/media/catalog-media-production-lock";

describe("Catalog Media Delivery Gate & Storage Isolation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("Public Directory Isolation", () => {
    it("strictly verifies that public/demo-media does NOT exist or contains 0 files", () => {
      const publicDemoMedia = path.join(process.cwd(), "public", "demo-media");
      if (fs.existsSync(publicDemoMedia)) {
        const entries = fs.readdirSync(publicDemoMedia);
        expect(entries.length).toBe(0);
      } else {
        expect(fs.existsSync(publicDemoMedia)).toBe(false);
      }
    });

    it("prevents initializing LocalCatalogMediaStorageAdapter inside public/ directory", () => {
      const insidePublic = path.join(process.cwd(), "public", "gated-media");
      expect(() => new LocalCatalogMediaStorageAdapter(insidePublic)).toThrow(
        /Catalog media directory must not be located inside the public directory/i,
      );
    });

    it("prevents initializing LocalCatalogMediaStorageAdapter at the public/ root", () => {
      const atPublic = path.join(process.cwd(), "public");
      expect(() => new LocalCatalogMediaStorageAdapter(atPublic)).toThrow(
        /Catalog media directory must not be located inside the public directory/i,
      );
    });
  });

  describe("Storage Adapter Path Traversal Resistance", () => {
    it("blocks directory traversal attempts in storage keys", async () => {
      const adapter = new LocalCatalogMediaStorageAdapter();
      await expect(
        adapter.openForValidation({ storageKey: "../../etc/passwd", maximumBytes: 1024 }),
      ).rejects.toMatchObject({
        code: "CATALOG_MEDIA_STORAGE_FAILURE",
      });

      await expect(
        adapter.openForValidation({ storageKey: "....//secret.txt", maximumBytes: 1024 }),
      ).rejects.toMatchObject({
        code: "CATALOG_MEDIA_STORAGE_FAILURE",
      });
    });
  });

  describe("Production Gating & Fail-Closed Behavior", () => {
    it("keeps delivery locked when unconfigured", () => {
      delete process.env.CATALOG_MEDIA_STORAGE;
      delete process.env.KT_STAGING_DEMO_ENABLED;
      delete process.env.KT_DEMO_DATA_ENABLED;

      expect(isCatalogMediaDeliveryAllowed()).toBe(false);
      expect(() => assertCatalogMediaProductionActionAllowed("PUBLIC_DELIVERY")).toThrow();
      const adapter = createProductionCatalogMediaStorageAdapter();
      expect(adapter.code).toBe("UNCONFIGURED");
    });

    it("unlocks delivery and selects local adapter when staging demo is enabled", () => {
      delete (process.env as Record<string, string | undefined>).NODE_ENV;
      process.env.KT_STAGING_DEMO_ENABLED = "true";

      expect(isCatalogMediaDeliveryAllowed()).toBe(true);
      expect(() => assertCatalogMediaProductionActionAllowed("PUBLIC_DELIVERY")).not.toThrow();
      const adapter = createProductionCatalogMediaStorageAdapter();
      expect(adapter.code).toBe("LOCAL_FILESYSTEM");
    });

    it("remains fail-closed in production even if CATALOG_MEDIA_STORAGE=filesystem", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      process.env.KT_RUNTIME_ENV = "production";
      process.env.CATALOG_MEDIA_STORAGE = "filesystem";
      delete process.env.KT_STAGING_DEMO_ENABLED;

      expect(isCatalogMediaDeliveryAllowed()).toBe(false);
      const adapter = createProductionCatalogMediaStorageAdapter();
      expect(adapter.code).toBe("UNCONFIGURED");
    });
  });
});
