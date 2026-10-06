import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { normalizeProfileImage, normalizeCatalogImage } from "@/lib/client-platform/images.service";
describe("private image normalization", () => {
  it("bounds avatar dimensions and strips embedded metadata", async () => {
    const source = await sharp({
      create: { width: 800, height: 600, channels: 3, background: "#dddddd" },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Artist: "Private artist" } } })
      .toBuffer();
    const result = await normalizeProfileImage(source);
    const metadata = await sharp(result).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(512);
    expect(metadata.height).toBe(512);
    expect(metadata.exif).toBeUndefined();
  });
  it("rejects non-images and active SVG content", async () => {
    await expect(
      normalizeProfileImage(Buffer.from("not an image")),
    ).rejects.toMatchObject({ code: "IMAGE_CONTENT_INVALID" });
    await expect(
      normalizeProfileImage(
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
        ),
      ),
    ).rejects.toMatchObject({ code: "IMAGE_CONTENT_INVALID" });
  });
  it("rejects oversized image payloads before decoding", async () => {
    await expect(
      normalizeProfileImage(new Uint8Array(5 * 1024 * 1024 + 1)),
    ).rejects.toMatchObject({ status: 413 });
  });
});

it("fully decodes catalogue phone images, strips metadata and rejects tiny or truncated images", async () => {
  const source = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#dddddd" } }).jpeg().withMetadata({ exif: { IFD0: { Artist: "Private artist" } } }).toBuffer();
  const normalized = await normalizeCatalogImage(source);
  const metadata = await sharp(normalized).metadata();
  expect(metadata.width).toBe(2400); expect(metadata.height).toBe(1600); expect(metadata.exif).toBeUndefined();
  const tiny = await sharp({ create: { width: 100, height: 100, channels: 3, background: "#dddddd" } }).png().toBuffer();
  await expect(normalizeCatalogImage(tiny)).rejects.toMatchObject({ code: "IMAGE_CONTENT_INVALID" });
  await expect(normalizeCatalogImage(source.subarray(0, 500))).rejects.toMatchObject({ code: "IMAGE_CONTENT_INVALID" });
});
