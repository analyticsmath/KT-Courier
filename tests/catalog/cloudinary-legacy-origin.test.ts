import { afterEach, describe, expect, it, vi } from "vitest";
import { createCloudinaryCatalogMediaReadAdapter, createProductionCatalogMediaDeliveryStorageAdapter } from "@/lib/catalog/media/catalog-media-storage-adapter";
const env = { CLOUDINARY_CLOUD_NAME: "q8gbzml2", CLOUDINARY_CATALOG_PREFIX: "kt-courier/catalog", CATALOG_MEDIA_DELIVERY: "cloudinary" };
afterEach(() => vi.unstubAllGlobals());
describe("verified Cloudinary catalogue origin", () => {
  it("reads an authenticated mirror of an immutable S3 declaration before the legacy public origin", async () => {
    const key = `catalog-media/${"a".repeat(64)}`;
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ public_id: `${env.CLOUDINARY_CATALOG_PREFIX}/${key}`, asset_id: "b".repeat(32), type: "authenticated", resource_type: "image" })))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal("fetch", request);
    const adapter = createProductionCatalogMediaDeliveryStorageAdapter({ ...env, CLOUDINARY_API_KEY: "test-key", CLOUDINARY_API_SECRET: "test-secret" });
    const target = await adapter.createReadTarget({ storageKey: key, maximumBytes: 3 });
    expect(target.byteSize).toBe(3);
    expect(Array.from(target.body)).toEqual([1, 2, 3]);
    expect(request.mock.calls.map(call => String(call[0]))).toEqual([
      "https://api.cloudinary.com/v1_1/q8gbzml2/image/explicit",
      "https://api.cloudinary.com/v1_1/q8gbzml2/asset/download",
    ]);
  });

  it("retains legacy delivery when the authenticated mirror is absent", async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal("fetch", request);
    const adapter = createProductionCatalogMediaDeliveryStorageAdapter({ ...env, CLOUDINARY_API_KEY: "test-key", CLOUDINARY_API_SECRET: "test-secret" });
    expect(await adapter.createReadTarget({ storageKey: `catalog-media/${"a".repeat(64)}`, maximumBytes: 3 })).toEqual({ byteSize: 3, body: new Uint8Array([1, 2, 3]) });
    expect(String(request.mock.calls[1][0])).toMatch(/^https:\/\/res\.cloudinary\.com\/q8gbzml2\/image\/upload\//);
  });

  it("delivers an admitted legacy asset without requiring an S3 copy", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const adapter = createProductionCatalogMediaDeliveryStorageAdapter(env);
    expect(adapter.productionReady).toBe(true);
    expect(await adapter.createReadTarget({ storageKey: "catalog-media/legacy-6ammart/product/product-220-a123.webp", maximumBytes: 3 })).toEqual({ byteSize: 3, body: new Uint8Array([1, 2, 3]) });
    expect(String(fetch.mock.calls[0][0])).toBe("https://res.cloudinary.com/q8gbzml2/image/upload/kt-courier/catalog/legacy-6ammart/product/product-220-a123.webp");
  });
  it("does not allow the migration read origin to upload or remove assets", async () => {
    const adapter = createCloudinaryCatalogMediaReadAdapter(env);
    await expect(adapter.confirmUpload({ storageKey: "x", bytes: new Uint8Array([1]), maximumBytes: 1 })).rejects.toThrow(/read-only/);
    await expect(adapter.deleteUncommittedObject({ storageKey: "x" })).rejects.toThrow(/read-only/);
  });
  it("rejects a missing configuration and path traversal before fetching", async () => {
    expect(() => createCloudinaryCatalogMediaReadAdapter({})).toThrow(/not configured/);
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(createCloudinaryCatalogMediaReadAdapter(env).createReadTarget({ storageKey: "../private", maximumBytes: 3 })).rejects.toThrow(/Invalid/);
    expect(fetch).not.toHaveBeenCalled();
  });
});
