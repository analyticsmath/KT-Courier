import { CloudinaryImageStorage, CloudinaryImageStorageError, cloudinaryImageConfig } from "@/lib/media/cloudinary-image-storage";
import { PrivateMediaStorageError, type PrivateMediaStorageAdapter } from "./private-media-storage";
export const CLOUDINARY_PRIVATE_IMAGE_CODE = "CLOUDINARY_AUTHENTICATED_IMAGE";
export class CloudinaryPrivateImageStorageAdapter implements PrivateMediaStorageAdapter {
  readonly code = CLOUDINARY_PRIVATE_IMAGE_CODE;
  constructor(private readonly storage: CloudinaryImageStorage) {}
  private async operation<T>(work: () => Promise<T>): Promise<T> {
    try { return await work(); }
    catch (error) {
      if (error instanceof CloudinaryImageStorageError) throw new PrivateMediaStorageError(error.code === "MISSING" ? "PRIVATE_MEDIA_STORAGE_MISSING" : "PRIVATE_MEDIA_STORAGE_FAILURE", error.message);
      throw error;
    }
  }
  async write(input: { key: string; bytes: Uint8Array; mimeType: string }) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(input.mimeType)) throw new PrivateMediaStorageError("PRIVATE_MEDIA_STORAGE_FAILURE", "Cloudinary profile storage accepts raster images only.");
    await this.operation(() => this.storage.write(input.key, input.bytes, 5 * 1024 * 1024));
  }
  read(key: string) { return this.operation(() => this.storage.read(key, 5 * 1024 * 1024)); }
  async delete(key: string) { await this.operation(() => this.storage.delete(key)); }
}
export function createCloudinaryPrivateImageStorageAdapter(): PrivateMediaStorageAdapter {
  const config = cloudinaryImageConfig();
  if (!config) throw new PrivateMediaStorageError("PRIVATE_MEDIA_STORAGE_NOT_CONFIGURED", "Cloudinary profile image uploads are not configured.");
  return new CloudinaryPrivateImageStorageAdapter(new CloudinaryImageStorage(config));
}
