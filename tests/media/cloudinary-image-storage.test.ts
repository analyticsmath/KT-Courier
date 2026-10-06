import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { CloudinaryImageStorage, cloudinaryImageConfig, signCloudinaryParameters } from "@/lib/media/cloudinary-image-storage";
const config = { cloudName: "test-cloud", apiKey: "test-key", apiSecret: "test-secret", prefix: "kt-courier/catalog" };
const key = `catalog-media/${"a".repeat(64)}`;
const evidence = { public_id: `${config.prefix}/${key}`, asset_id: "b".repeat(32), type: "authenticated", resource_type: "image" };
function json(value: unknown) { return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } }); }
describe("authenticated Cloudinary image originals", () => {
  it("requires all server credentials and signs only sorted request parameters", () => {
    expect(cloudinaryImageConfig({ CLOUDINARY_CLOUD_NAME: "test-cloud" })).toBeNull();
    expect(cloudinaryImageConfig({ CLOUDINARY_CLOUD_NAME: "../invalid", CLOUDINARY_API_KEY: "key", CLOUDINARY_API_SECRET: "secret" })).toBeNull();
    expect(signCloudinaryParameters({ z: "two", a: "one" }, "secret")).toBe(createHash("sha256").update("a=one&z=twosecret").digest("hex"));
  });
  it("uploads immutable private images and verifies original bytes without transformations", async () => {
    const bytes = Uint8Array.of(1, 2, 3);
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(json(evidence)).mockResolvedValueOnce(json(evidence)).mockResolvedValueOnce(new Response(bytes));
    await new CloudinaryImageStorage(config, request).write(key, bytes, 3);
    const [url, init] = request.mock.calls[0];
    expect(url).toBe("https://api.cloudinary.com/v1_1/test-cloud/image/upload");
    const form = init!.body as FormData;
    expect(form.get("type")).toBe("authenticated"); expect(form.get("overwrite")).toBe("false");
    expect(form.get("api_secret")).toBeNull(); expect(form.get("signature")).toMatch(/^[a-f0-9]{64}$/);
    expect(request.mock.calls[2][0]).toBe("https://api.cloudinary.com/v1_1/test-cloud/asset/download");
    const download = request.mock.calls[2][1]!.body as FormData;
    expect(download.get("asset_id")).toBe(evidence.asset_id); expect(download.get("format")).toBeNull(); expect(download.get("transformation")).toBeNull();
  });
  it("rejects unexpected identities and public upload evidence", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(json({ ...evidence, type: "upload" }));
    await expect(new CloudinaryImageStorage(config, request).read(key, 10)).rejects.toMatchObject({ code: "FAILURE" });
    request.mockClear();
    await expect(new CloudinaryImageStorage(config, request).read("../secret", 10)).rejects.toMatchObject({ code: "FAILURE" });
    expect(request).not.toHaveBeenCalled();
  });
  it("rejects immutable retries with different bytes", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(json(evidence)).mockResolvedValueOnce(json(evidence)).mockResolvedValueOnce(new Response(Uint8Array.of(4, 5, 6)));
    await expect(new CloudinaryImageStorage(config, request).write(key, Uint8Array.of(1, 2, 3), 3)).rejects.toThrow(/checksum/);
  });
  it("bounds streamed originals even when the declared length is false", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(json(evidence)).mockResolvedValueOnce(new Response(Uint8Array.of(1, 2, 3), { headers: { "content-length": "1" } }));
    await expect(new CloudinaryImageStorage(config, request).read(key, 2)).rejects.toThrow(/size bound/);
  });
  it("sanitizes provider failures and requires deletion confirmation", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("test-secret provider details", { status: 500 })).mockResolvedValueOnce(json({ result: "unexpected" }));
    await expect(new CloudinaryImageStorage(config, request).read(key, 10)).rejects.toThrow("Cloudinary rejected the image operation.");
    await expect(new CloudinaryImageStorage(config, request).delete(key)).rejects.toThrow(/did not confirm/);
  });
});
