import sharp from "sharp";
import { PlatformError } from "./contracts";
/** Decode, rotate and re-encode raster images to bound dimensions and remove embedded metadata. */
export async function normalizeProfileImage(bytes: Uint8Array, avatar = true) {
  if (bytes.length < 1 || bytes.length > 5 * 1024 * 1024)
    throw new PlatformError(
      "IMAGE_SIZE_INVALID",
      "Images must be smaller than 5 MB.",
      413,
    );
  try {
    const image = sharp(bytes, {
      limitInputPixels: 16_000_000,
      animated: false,
    });
    const m = await image.metadata();
    if (
      !m.width ||
      !m.height ||
      !["jpeg", "png", "webp"].includes(m.format ?? "") ||
      (m.pages ?? 1) > 1
    )
      throw Error("Invalid image");
    return await image
      .rotate()
      .resize(avatar ? 512 : 1600, avatar ? 512 : 1600, {
        fit: avatar ? "cover" : "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw new PlatformError(
      "IMAGE_CONTENT_INVALID",
      "Upload a valid JPEG, PNG or WebP image.",
      422,
    );
  }
}

/** Catalogue images are fully decoded and re-encoded before intake or external storage. */
export async function normalizeCatalogImage(bytes: Uint8Array): Promise<Uint8Array> {
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new PlatformError("IMAGE_SIZE_INVALID", "Images must be smaller than 8 MiB.", 413);
  try {
    const image = sharp(bytes, { limitInputPixels: 25_000_000, animated: false });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || !["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) throw Error("Invalid raster image");
    const result = await image.rotate().resize(2400, 2400, { fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    const decoded = await sharp(result).metadata();
    if (!decoded.width || !decoded.height || decoded.width < 300 || decoded.height < 300) throw Error("Image too small");
    return result;
  } catch {
    throw new PlatformError("IMAGE_CONTENT_INVALID", "Upload a valid JPEG, PNG or WebP image at least 300 × 300 pixels.", 422);
  }
}
