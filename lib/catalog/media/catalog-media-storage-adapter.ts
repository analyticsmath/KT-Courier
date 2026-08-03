import { CatalogPolicyError } from "@/lib/catalog/errors";

export type CatalogMediaUploadTarget = Readonly<{
  mode: "APPLICATION";
  uploadPath: string;
  expiresAt: string;
  requiredHeaders: Readonly<Record<string, string>>;
}>;

export type CatalogMediaReadTarget = Readonly<{
  body: Uint8Array;
  byteSize: number;
}>;

export interface CatalogMediaStorageAdapter {
  readonly code: string;
  readonly productionReady: boolean;
  createUploadTarget(input: Readonly<{ intentReference: string; storageKey: string; maximumBytes: number; expiresAt: Date }>): Promise<CatalogMediaUploadTarget>;
  confirmUpload(input: Readonly<{ storageKey: string; bytes: Uint8Array; maximumBytes: number }>): Promise<{ byteSize: number }>;
  openForValidation(input: Readonly<{ storageKey: string; maximumBytes: number }>): Promise<Uint8Array>;
  deleteUncommittedObject(input: Readonly<{ storageKey: string }>): Promise<{ deleted: boolean }>;
  createReadTarget(input: Readonly<{ storageKey: string; maximumBytes: number }>): Promise<CatalogMediaReadTarget>;
}

export class CatalogMediaStorageError extends CatalogPolicyError {
  constructor(code: "CATALOG_MEDIA_STORAGE_NOT_READY" | "CATALOG_MEDIA_STORAGE_MISSING" | "CATALOG_MEDIA_STORAGE_FAILURE", message: string, status = 503) {
    super(code, message, status);
  }
}

export class LockedCatalogMediaStorageAdapter implements CatalogMediaStorageAdapter {
  readonly code = "UNCONFIGURED";
  readonly productionReady = false;

  private unavailable(): never {
    throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_NOT_READY", "Catalog media storage is not configured for production.");
  }

  async createUploadTarget(): Promise<CatalogMediaUploadTarget> { return this.unavailable(); }
  async confirmUpload(): Promise<{ byteSize: number }> { return this.unavailable(); }
  async openForValidation(): Promise<Uint8Array> { return this.unavailable(); }
  async deleteUncommittedObject(): Promise<{ deleted: boolean }> { return this.unavailable(); }
  async createReadTarget(): Promise<CatalogMediaReadTarget> { return this.unavailable(); }
}

export function createProductionCatalogMediaStorageAdapter(): CatalogMediaStorageAdapter {
  return new LockedCatalogMediaStorageAdapter();
}
