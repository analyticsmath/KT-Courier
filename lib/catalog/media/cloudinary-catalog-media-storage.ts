import { CloudinaryImageStorage, CloudinaryImageStorageError, cloudinaryImageConfig } from "@/lib/media/cloudinary-image-storage";
import { CatalogMediaStorageError, type CatalogMediaStorageAdapter, type CatalogMediaUploadTarget } from "./catalog-media-storage-adapter";

export const CLOUDINARY_CATALOG_STORAGE_CODE = "CLOUDINARY_AUTHENTICATED_CATALOG";
export class CloudinaryCatalogMediaStorageAdapter implements CatalogMediaStorageAdapter {
  readonly code = CLOUDINARY_CATALOG_STORAGE_CODE;
  readonly productionReady = true;
  constructor(private readonly storage: CloudinaryImageStorage) {}
  async createUploadTarget(input: { intentReference: string; expiresAt: Date }): Promise<CatalogMediaUploadTarget> {
    return { mode: "APPLICATION", uploadPath: `/api/store/catalog/media/uploads/${encodeURIComponent(input.intentReference)}/content`, expiresAt: input.expiresAt.toISOString(), requiredHeaders: { "content-type": "application/octet-stream" } };
  }
  private async operation<T>(work: () => Promise<T>): Promise<T> {
    try { return await work(); }
    catch (error) {
      if (error instanceof CloudinaryImageStorageError) throw new CatalogMediaStorageError(error.code === "MISSING" ? "CATALOG_MEDIA_STORAGE_MISSING" : "CATALOG_MEDIA_STORAGE_FAILURE", error.message, error.code === "MISSING" ? 404 : 503);
      throw error;
    }
  }
  async confirmUpload(input: { storageKey: string; bytes: Uint8Array; maximumBytes: number }) {
    await this.operation(() => this.storage.write(input.storageKey, input.bytes, input.maximumBytes));
    return { byteSize: input.bytes.byteLength };
  }
  openForValidation(input: { storageKey: string; maximumBytes: number }) { return this.operation(() => this.storage.read(input.storageKey, input.maximumBytes)); }
  async deleteUncommittedObject(input: { storageKey: string }) { return { deleted: await this.operation(() => this.storage.delete(input.storageKey)) }; }
  async createReadTarget(input: { storageKey: string; maximumBytes: number }) { const body = await this.openForValidation(input); return { body, byteSize: body.byteLength }; }
}
export function createCloudinaryCatalogWriteAdapter(env: Record<string, string | undefined> = process.env): CatalogMediaStorageAdapter {
  const config = cloudinaryImageConfig(env);
  if (!config) throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_NOT_READY", "Cloudinary image uploads are not configured.");
  return new CloudinaryCatalogMediaStorageAdapter(new CloudinaryImageStorage(config));
}
