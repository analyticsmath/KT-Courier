import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { normalizePrivateRaster, PrivateRasterError } from "@/lib/private-media/normalize-private-raster";

describe("private raster decoding and normalization", () => {
  it.each(["png", "jpeg", "webp"] as const)("fully decodes and preserves %s dimensions without embedded metadata", async (format) => {
    const source = await sharp({ create: { width: 32, height: 20, channels: 3, background: { r: 10, g: 20, b: 30 } } }).toFormat(format).withMetadata().toBuffer();
    const bytes = await normalizePrivateRaster(source, `image/${format}`);
    const metadata = await sharp(bytes).metadata();
    expect(metadata).toMatchObject({ width: 32, height: 20, format });
    expect(metadata.exif).toBeUndefined(); expect(metadata.icc).toBeUndefined();
    const pixel = await sharp(bytes).raw().toBuffer();
    for (let channel = 0; channel < 3; channel++) expect(Math.abs(pixel[channel] - [10, 20, 30][channel])).toBeLessThanOrEqual(2);
  });
  it("applies orientation to pixels and removes the embedded orientation declaration", async () => {
    const source = await sharp({ create: { width: 30, height: 20, channels: 3, background: "white" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const normalized = await normalizePrivateRaster(source, "image/jpeg");
    const metadata = await sharp(normalized).metadata();
    expect(metadata.width).toBe(20); expect(metadata.height).toBe(30); expect(metadata.orientation).toBeUndefined(); expect(metadata.exif).toBeUndefined();
  });
  it.each([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), new Uint8Array([255, 216, 255])])("rejects signature-only corrupt evidence", async (bytes) => {
    await expect(normalizePrivateRaster(bytes, bytes[0] === 137 ? "image/png" : "image/jpeg")).rejects.toBeInstanceOf(PrivateRasterError);
  });
  it("rejects declared format mismatch and unsupported SVG", async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } }).png().toBuffer();
    await expect(normalizePrivateRaster(png, "image/jpeg")).rejects.toBeInstanceOf(PrivateRasterError);
    await expect(normalizePrivateRaster(Buffer.from("<svg/>"), "image/svg+xml")).rejects.toBeInstanceOf(PrivateRasterError);
  });
});
