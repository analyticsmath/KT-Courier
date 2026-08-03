import { DeterministicCatalogMediaStorageAdapter } from "@/lib/catalog/media/deterministic-catalog-media-storage-adapter";
import { type CatalogMediaInspection } from "@/lib/catalog/media/catalog-media-content-validation";
import { type CatalogMediaOwner } from "@/lib/catalog/media/catalog-media-ownership";
import { type CatalogMediaAssetLifecycleStatus, type CatalogMediaUploadLifecycleStatus } from "@/lib/catalog/media/catalog-media-lifecycle";
import { type CatalogMediaPurpose } from "@/lib/catalog/media/catalog-media-policy";
import { CatalogMediaIntakeService, type CatalogMediaAssetRecord, type CatalogMediaOperation, type CatalogMediaRepository, type CatalogMediaUploadIntentRecord } from "@/lib/services/catalog-media-intake.service";

function chunk(type: string, data: Uint8Array): Buffer {
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0); result.write(type, 4, 4, "ascii"); Buffer.from(data).copy(result, 8);
  return result;
}

export function catalogPngFixture(input: { width?: number; height?: number; metadata?: boolean } = {}): Uint8Array {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(input.width ?? 400, 0); ihdr.writeUInt32BE(input.height ?? 400, 4); ihdr[8] = 8; ihdr[9] = 2;
  const parts = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", Uint8Array.of(0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01))];
  if (input.metadata) parts.push(chunk("tEXt", Buffer.from("GPS=unsafe", "utf8")));
  parts.push(chunk("IEND", new Uint8Array()));
  return Buffer.concat(parts);
}

function copyAsset(asset: CatalogMediaAssetRecord, patch: Partial<CatalogMediaAssetRecord>): CatalogMediaAssetRecord { return { ...asset, ...patch, updatedAt: new Date(), version: patch.version ?? asset.version + 1 }; }

export class MemoryCatalogMediaRepository implements CatalogMediaRepository {
  readonly assets = new Map<string, CatalogMediaAssetRecord>();
  readonly intents = new Map<string, CatalogMediaUploadIntentRecord>();
  readonly operations = new Map<string, string>();

  private operationKey(operation: CatalogMediaOperation) { return `${operation.actorUserId}:${operation.action}:${operation.operationId}`; }
  private saveOperation(operation: CatalogMediaOperation) { this.operations.set(this.operationKey(operation), operation.requestHash); }
  private saveIntent(intent: CatalogMediaUploadIntentRecord) { this.intents.set(intent.publicReference, intent); this.assets.set(intent.asset.publicReference, intent.asset); return intent; }

  async findIntentByActorOperation(actorUserId: string, operationId: string) { return [...this.intents.values()].find((intent) => intent.createdByUserId === actorUserId && intent.operationId === operationId) ?? null; }
  async findIntentByReference(publicReference: string) { return this.intents.get(publicReference) ?? null; }
  async createIntent(input: Readonly<{ owner: CatalogMediaOwner; assetReference: string; intentReference: string; storageKey: string; storageProvider: string; purpose: CatalogMediaPurpose; expectedMimeType: string; expectedByteSize: number; maximumBytes: number; operationId: string; requestHash: string; expiresAt: Date; actorUserId: string }>) {
    const now = new Date();
    const asset: CatalogMediaAssetRecord = { id: `asset-${this.assets.size + 1}`, publicReference: input.assetReference, ...input.owner, purpose: input.purpose, storageKey: input.storageKey, storageProvider: input.storageProvider, declaredMimeType: input.expectedMimeType, mimeType: null, declaredByteSize: input.expectedByteSize, byteSize: null, width: null, height: null, checksum: null, privacyInspectionPassed: false, status: "PENDING_UPLOAD", version: 1, quarantineReasonCode: null, rejectionReasonCode: null, createdByUserId: input.actorUserId, createdAt: now, updatedAt: now };
    const intent: CatalogMediaUploadIntentRecord = { id: `intent-${this.intents.size + 1}`, publicReference: input.intentReference, ...input.owner, assetId: asset.id, asset, status: "PENDING_UPLOAD", purpose: input.purpose, expectedMimeType: input.expectedMimeType, expectedByteSize: input.expectedByteSize, maximumBytes: input.maximumBytes, operationId: input.operationId, requestHash: input.requestHash, storageKey: input.storageKey, expiresAt: input.expiresAt, createdByUserId: input.actorUserId, completedAt: null, completionCount: 0 };
    return this.saveIntent(intent);
  }
  async findOperation(operation: CatalogMediaOperation) { const requestHash = this.operations.get(this.operationKey(operation)); return requestHash ? { requestHash } : null; }
  async markUploaded(intent: CatalogMediaUploadIntentRecord, input: { byteSize: number; operation: CatalogMediaOperation }) { this.saveOperation(input.operation); return this.updateIntent(intent, "UPLOADED", "UPLOADED", { byteSize: input.byteSize }); }
  async markExpired(intent: CatalogMediaUploadIntentRecord) { return this.updateIntent(intent, intent.asset.status, "EXPIRED"); }
  async startValidation(intent: CatalogMediaUploadIntentRecord) { return this.updateIntent(intent, "VALIDATING", intent.status); }
  async completeValidation(intent: CatalogMediaUploadIntentRecord, inspection: CatalogMediaInspection, operation: CatalogMediaOperation) { this.saveOperation(operation); return this.updateIntent(intent, "READY", "COMPLETED", { mimeType: inspection.detectedMimeType, byteSize: inspection.byteSize, width: inspection.width, height: inspection.height, checksum: inspection.checksum, privacyInspectionPassed: true }, { completedAt: new Date(), completionCount: 1 }); }
  async failValidation(intent: CatalogMediaUploadIntentRecord, status: "QUARANTINED" | "REJECTED", reasonCode: string, operation: CatalogMediaOperation) { this.saveOperation(operation); return this.updateIntent(intent, status, "CANCELLED", status === "REJECTED" ? { rejectionReasonCode: reasonCode } : { quarantineReasonCode: reasonCode }); }
  async listAssets(owner?: CatalogMediaOwner) { return [...this.assets.values()].filter((asset) => !owner || (asset.ownerType === owner.ownerType && asset.ownerStoreId === owner.ownerStoreId)); }
  async findAsset(reference: string) { return [...this.assets.values()].find((asset) => asset.publicReference === reference || asset.id === reference) ?? null; }
  async getAssetEvidence() { return { history: [], attachments: [] }; }
  async archiveAsset(asset: CatalogMediaAssetRecord, operation: CatalogMediaOperation) { this.saveOperation(operation); const updated = copyAsset(asset, { status: "ARCHIVED" }); this.assets.set(updated.publicReference, updated); return updated; }
  async reviewAsset(asset: CatalogMediaAssetRecord, status: "READY" | "QUARANTINED" | "REJECTED", reasonCode: string, operation: CatalogMediaOperation) { this.saveOperation(operation); const updated = copyAsset(asset, { status, quarantineReasonCode: status === "QUARANTINED" ? reasonCode : null, rejectionReasonCode: status === "REJECTED" ? reasonCode : null }); this.assets.set(updated.publicReference, updated); return updated; }

  private updateIntent(intent: CatalogMediaUploadIntentRecord, assetStatus: CatalogMediaAssetLifecycleStatus, intentStatus: CatalogMediaUploadLifecycleStatus, assetPatch: Partial<CatalogMediaAssetRecord> = {}, intentPatch: Partial<CatalogMediaUploadIntentRecord> = {}) {
    const asset = copyAsset(intent.asset, { ...assetPatch, status: assetStatus });
    return this.saveIntent({ ...intent, ...intentPatch, status: intentStatus, asset });
  }
}

export function catalogMediaHarness(now: () => Date = () => new Date("2026-07-18T10:00:00.000Z")) {
  const repository = new MemoryCatalogMediaRepository();
  const storage = new DeterministicCatalogMediaStorageAdapter();
  const service = new CatalogMediaIntakeService(repository, storage, { approved: true, adapterCode: "DETERMINISTIC_TEST" }, now);
  return { repository, storage, service };
}
