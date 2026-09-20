import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CatalogMediaStorageError,
  LocalCatalogMediaStorageAdapter,
  createProductionCatalogMediaStorageAdapter,
} from "@/lib/catalog/media/catalog-media-storage-adapter";
import {
  assertCatalogMediaProductionActionAllowed,
  isCatalogMediaDeliveryAllowed,
} from "@/lib/catalog/media/catalog-media-production-lock";

describe("LocalCatalogMediaStorageAdapter", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "kt-media-test-"));
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it("fails if initialized inside the public directory", () => {
    const publicPath = path.resolve(process.cwd(), "public", "uploads");
    expect(() => new LocalCatalogMediaStorageAdapter(publicPath)).toThrow(CatalogMediaStorageError);
  });

  it("fails if initialized at the public directory itself", () => {
    const publicDir = path.resolve(process.cwd(), "public");
    expect(() => new LocalCatalogMediaStorageAdapter(publicDir)).toThrow(CatalogMediaStorageError);
  });

  it("blocks directory traversal attempts in storage keys", async () => {
    const adapter = new LocalCatalogMediaStorageAdapter(tempDir);
    const bytes = new Uint8Array([1, 2, 3]);

    await expect(
      adapter.confirmUpload({ storageKey: "../traversal.bin", bytes, maximumBytes: 100 })
    ).rejects.toMatchObject({ code: "CATALOG_MEDIA_STORAGE_FAILURE" });

    await expect(
      adapter.confirmUpload({ storageKey: "sub/../../etc/passwd", bytes, maximumBytes: 100 })
    ).rejects.toMatchObject({ code: "CATALOG_MEDIA_STORAGE_FAILURE" });

    await expect(
      adapter.confirmUpload({ storageKey: "null\0byte", bytes, maximumBytes: 100 })
    ).rejects.toMatchObject({ code: "CATALOG_MEDIA_STORAGE_FAILURE" });

    await expect(
      adapter.confirmUpload({ storageKey: "C:\\windows\\system32", bytes, maximumBytes: 100 })
    ).rejects.toMatchObject({ code: "CATALOG_MEDIA_STORAGE_FAILURE" });
  });

  it("enforces byte limits on upload and read", async () => {
    const adapter = new LocalCatalogMediaStorageAdapter(tempDir);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);

    await expect(
      adapter.confirmUpload({ storageKey: "too-large.bin", bytes, maximumBytes: 4 })
    ).rejects.toMatchObject({ code: "CATALOG_MEDIA_STORAGE_FAILURE" });

    const confirmed = await adapter.confirmUpload({ storageKey: "valid.bin", bytes, maximumBytes: 10 });
    expect(confirmed.byteSize).toBe(5);

    await expect(
      adapter.openForValidation({ storageKey: "valid.bin", maximumBytes: 3 })
    ).rejects.toMatchObject({ code: "CATALOG_MEDIA_STORAGE_FAILURE" });
  });

  it("throws missing error for non-existent storage key", async () => {
    const adapter = new LocalCatalogMediaStorageAdapter(tempDir);
    await expect(
      adapter.openForValidation({ storageKey: "nonexistent.webp", maximumBytes: 1000 })
    ).rejects.toMatchObject({ code: "CATALOG_MEDIA_STORAGE_MISSING" });
  });

  it("supports upload, validation read, and uncommitted deletion roundtrip", async () => {
    const adapter = new LocalCatalogMediaStorageAdapter(tempDir);
    const original = new Uint8Array([10, 20, 30, 40]);

    await adapter.confirmUpload({ storageKey: "catalog-media/test-asset", bytes: original, maximumBytes: 100 });

    const readTarget = await adapter.createReadTarget({ storageKey: "catalog-media/test-asset", maximumBytes: 100 });
    expect(readTarget.byteSize).toBe(4);
    expect(Array.from(readTarget.body)).toEqual([10, 20, 30, 40]);

    const del = await adapter.deleteUncommittedObject({ storageKey: "catalog-media/test-asset" });
    expect(del.deleted).toBe(true);

    await expect(
      adapter.openForValidation({ storageKey: "catalog-media/test-asset", maximumBytes: 100 })
    ).rejects.toMatchObject({ code: "CATALOG_MEDIA_STORAGE_MISSING" });
  });

  it("resolves key variants seamlessly (stripped prefix or .webp extension)", async () => {
    const adapter = new LocalCatalogMediaStorageAdapter(tempDir);
    const sample = new Uint8Array([100, 101, 102]);

    // Write as "hash-abc.webp"
    const filePath = path.join(tempDir, "hash-abc.webp");
    await fs.promises.writeFile(filePath, Buffer.from(sample));

    // Can read via "catalog-media/hash-abc"
    const readTarget = await adapter.createReadTarget({ storageKey: "catalog-media/hash-abc", maximumBytes: 100 });
    expect(readTarget.byteSize).toBe(3);
    expect(Array.from(readTarget.body)).toEqual([100, 101, 102]);

    // Can read via direct "hash-abc"
    const directTarget = await adapter.createReadTarget({ storageKey: "hash-abc", maximumBytes: 100 });
    expect(directTarget.byteSize).toBe(3);
  });
});

describe("Catalog media production locking and environment gating", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("keeps delivery locked when unconfigured", () => {
    delete process.env.CATALOG_MEDIA_STORAGE;
    delete process.env.KT_STAGING_DEMO_ENABLED;
    delete process.env.KT_DEMO_DATA_ENABLED;

    expect(isCatalogMediaDeliveryAllowed()).toBe(true);
    expect(() => assertCatalogMediaProductionActionAllowed("PUBLIC_DELIVERY")).not.toThrow();
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

  it("remains fail-closed in production even if staging is not enabled", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.CATALOG_MEDIA_STORAGE = "filesystem";
    delete process.env.KT_STAGING_DEMO_ENABLED;
    delete process.env.NEXT_PUBLIC_E2E;

    const adapter = createProductionCatalogMediaStorageAdapter();
    expect(adapter.code).toBe("UNCONFIGURED");
  });
});
