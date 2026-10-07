import sharp from "sharp";

export class PrivateRasterError extends Error {}

/** Preserve image dimensions/content without carrying embedded upload metadata. */
export async function normalizePrivateRaster(bytes: Uint8Array, mimeType: string): Promise<Buffer> {
  const format = mimeType === "image/jpeg" ? "jpeg" : mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : null;
  if (!format) throw new PrivateRasterError("Unsupported private raster type.");
  try {
    const image = sharp(bytes, { limitInputPixels: 25_000_000, animated: false, failOn: "warning" });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.format !== format || (metadata.pages ?? 1) > 1) throw new Error("Invalid private image.");
    const rotated = image.rotate();
    // No resize/crop: a document or POD photograph must retain its full content.
    return await (format === "jpeg" ? rotated.jpeg({ quality: 100, chromaSubsampling: "4:4:4" }) : format === "png" ? rotated.png() : rotated.webp({ lossless: true })).toBuffer();
  } catch {
    throw new PrivateRasterError("Upload a complete, valid JPEG, PNG or WebP image.");
  }
}
