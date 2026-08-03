import {
  CatalogMediaStorageError,
  type CatalogMediaReadTarget,
  type CatalogMediaStorageAdapter,
  type CatalogMediaUploadTarget,
} from "@/lib/catalog/media/catalog-media-storage-adapter";

export class DeterministicCatalogMediaStorageAdapter implements CatalogMediaStorageAdapter {
  readonly code = "DETERMINISTIC_TEST";
  readonly productionReady = false;
  readonly #objects = new Map<string, Uint8Array>();

  async createUploadTarget(input: Readonly<{ intentReference: string; expiresAt: Date }>): Promise<CatalogMediaUploadTarget> {
    return Object.freeze({
      mode: "APPLICATION",
      uploadPath: `/api/store/catalog/media/uploads/${encodeURIComponent(input.intentReference)}/content`,
      expiresAt: input.expiresAt.toISOString(),
      requiredHeaders: Object.freeze({ "content-type": "application/octet-stream" }),
    });
  }

  async confirmUpload(input: Readonly<{ storageKey: string; bytes: Uint8Array; maximumBytes: number }>): Promise<{ byteSize: number }> {
    if (input.bytes.byteLength < 1 || input.bytes.byteLength > input.maximumBytes) throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Injected media object exceeds its upload target.", 413);
    this.#objects.set(input.storageKey, Uint8Array.from(input.bytes));
    return { byteSize: input.bytes.byteLength };
  }

  async openForValidation(input: Readonly<{ storageKey: string; maximumBytes: number }>): Promise<Uint8Array> {
    const bytes = this.#objects.get(input.storageKey);
    if (!bytes) throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_MISSING", "Uploaded catalog media bytes are missing.", 409);
    if (bytes.byteLength > input.maximumBytes) throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Stored catalog media exceeds its validation limit.", 413);
    return Uint8Array.from(bytes);
  }

  async deleteUncommittedObject(input: Readonly<{ storageKey: string }>): Promise<{ deleted: boolean }> {
    return { deleted: this.#objects.delete(input.storageKey) };
  }

  async createReadTarget(input: Readonly<{ storageKey: string; maximumBytes: number }>): Promise<CatalogMediaReadTarget> {
    const body = await this.openForValidation(input);
    return { body, byteSize: body.byteLength };
  }

  seedObjectForTesting(storageKey: string, bytes: Uint8Array): void {
    this.#objects.set(storageKey, Uint8Array.from(bytes));
  }

  hasObjectForTesting(storageKey: string): boolean {
    return this.#objects.has(storageKey);
  }
}
