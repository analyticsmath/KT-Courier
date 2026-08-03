import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { CatalogConflictError, CatalogNotFoundError, CatalogPolicyError } from "@/lib/catalog/errors";
import { catalogPublicReference, catalogRequestHash } from "@/lib/catalog/catalog-normalization";
import { inspectCatalogMediaContent, type CatalogMediaInspection } from "@/lib/catalog/media/catalog-media-content-validation";
import { assertCatalogMediaAssetTransition, assertCatalogMediaUploadTransition, type CatalogMediaAssetLifecycleStatus, type CatalogMediaUploadLifecycleStatus } from "@/lib/catalog/media/catalog-media-lifecycle";
import { assertCatalogMediaOwnerShape, assertStoreCanAccessCatalogMedia, type CatalogMediaOwner } from "@/lib/catalog/media/catalog-media-ownership";
import { CATALOG_MEDIA_MAX_UPLOAD_BYTES, CATALOG_MEDIA_UPLOAD_TTL_MS, assertCatalogMediaDeclaration, assertCatalogMediaPurposeForOwner, type CatalogMediaPurpose } from "@/lib/catalog/media/catalog-media-policy";
import { assertCatalogMediaProductionActionAllowed, type InjectedCatalogMediaTestApproval } from "@/lib/catalog/media/catalog-media-production-lock";
import { createProductionCatalogMediaStorageAdapter, type CatalogMediaStorageAdapter, type CatalogMediaUploadTarget } from "@/lib/catalog/media/catalog-media-storage-adapter";
import { recordCatalogEvidence } from "@/lib/services/catalog-service-support";

export type CatalogMediaAssetRecord = CatalogMediaOwner & Readonly<{
  id: string;
  publicReference: string;
  storageKey: string;
  storageProvider: string;
  purpose: CatalogMediaPurpose;
  declaredMimeType: string;
  mimeType: string | null;
  declaredByteSize: number;
  byteSize: number | null;
  width: number | null;
  height: number | null;
  checksum: string | null;
  privacyInspectionPassed: boolean;
  status: CatalogMediaAssetLifecycleStatus;
  version: number;
  quarantineReasonCode: string | null;
  rejectionReasonCode: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}>;

export type CatalogMediaUploadIntentRecord = CatalogMediaOwner & Readonly<{
  id: string;
  publicReference: string;
  assetId: string;
  asset: CatalogMediaAssetRecord;
  status: CatalogMediaUploadLifecycleStatus;
  purpose: CatalogMediaPurpose;
  expectedMimeType: string;
  expectedByteSize: number;
  maximumBytes: number;
  operationId: string;
  requestHash: string;
  storageKey: string;
  expiresAt: Date;
  createdByUserId: string;
  completedAt: Date | null;
  completionCount: number;
}>;

export type CatalogMediaOperation = Readonly<{ actorUserId: string; action: string; operationId: string; requestHash: string }>;

export interface CatalogMediaRepository {
  findIntentByActorOperation(actorUserId: string, operationId: string): Promise<CatalogMediaUploadIntentRecord | null>;
  findIntentByReference(publicReference: string): Promise<CatalogMediaUploadIntentRecord | null>;
  createIntent(input: Readonly<{ owner: CatalogMediaOwner; assetReference: string; intentReference: string; storageKey: string; storageProvider: string; purpose: CatalogMediaPurpose; expectedMimeType: string; expectedByteSize: number; maximumBytes: number; operationId: string; requestHash: string; expiresAt: Date; actorUserId: string }>): Promise<CatalogMediaUploadIntentRecord>;
  findOperation(operation: CatalogMediaOperation): Promise<{ requestHash: string } | null>;
  markUploaded(intent: CatalogMediaUploadIntentRecord, input: Readonly<{ byteSize: number; operation: CatalogMediaOperation }>): Promise<CatalogMediaUploadIntentRecord>;
  markExpired(intent: CatalogMediaUploadIntentRecord, actorUserId: string): Promise<CatalogMediaUploadIntentRecord>;
  startValidation(intent: CatalogMediaUploadIntentRecord, operation: CatalogMediaOperation): Promise<CatalogMediaUploadIntentRecord>;
  completeValidation(intent: CatalogMediaUploadIntentRecord, inspection: CatalogMediaInspection, operation: CatalogMediaOperation): Promise<CatalogMediaUploadIntentRecord>;
  failValidation(intent: CatalogMediaUploadIntentRecord, status: "QUARANTINED" | "REJECTED", reasonCode: string, operation: CatalogMediaOperation): Promise<CatalogMediaUploadIntentRecord>;
  listAssets(owner?: CatalogMediaOwner): Promise<CatalogMediaAssetRecord[]>;
  findAsset(publicReferenceOrId: string): Promise<CatalogMediaAssetRecord | null>;
  getAssetEvidence(assetId: string): Promise<Readonly<{ history: readonly unknown[]; attachments: readonly unknown[] }>>;
  archiveAsset(asset: CatalogMediaAssetRecord, operation: CatalogMediaOperation): Promise<CatalogMediaAssetRecord>;
  reviewAsset(asset: CatalogMediaAssetRecord, status: "READY" | "QUARANTINED" | "REJECTED", reasonCode: string, operation: CatalogMediaOperation): Promise<CatalogMediaAssetRecord>;
}

function safeAssetDto(asset: CatalogMediaAssetRecord, includeReviewEvidence = false) {
  return Object.freeze({
    publicReference: asset.publicReference,
    ownerType: asset.ownerType,
    ownerStoreId: asset.ownerType === "STORE" ? asset.ownerStoreId : null,
    status: asset.status,
    purpose: asset.purpose,
    mimeType: asset.mimeType,
    byteSize: asset.byteSize,
    width: asset.width,
    height: asset.height,
    checksumFingerprint: asset.checksum ? asset.checksum.slice(0, 12) : null,
    version: asset.version,
    ...(includeReviewEvidence ? { quarantineReasonCode: asset.quarantineReasonCode, rejectionReasonCode: asset.rejectionReasonCode } : {}),
  });
}

function assertIntentActor(intent: CatalogMediaUploadIntentRecord, actorUserId: string, storeId?: string): void {
  if (intent.createdByUserId !== actorUserId) throw new CatalogPolicyError("CATALOG_MEDIA_UPLOAD_FORBIDDEN", "Upload intent is not available to this actor.", 403);
  if (storeId) assertStoreCanAccessCatalogMedia(intent, storeId);
}

function operation(action: string, actorUserId: string, operationId: string, request: unknown): CatalogMediaOperation {
  return { action, actorUserId, operationId, requestHash: catalogRequestHash(request) };
}

export class CatalogMediaIntakeService {
  constructor(
    private readonly repository: CatalogMediaRepository,
    private readonly storage: CatalogMediaStorageAdapter,
    private readonly testApproval?: InjectedCatalogMediaTestApproval,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createUploadIntent(input: Readonly<{ actorUserId: string; ownerType: "PLATFORM" | "STORE"; storeId?: string; purpose: CatalogMediaPurpose; declaredMimeType: string; declaredByteSize: number; operationId: string }>) {
    assertCatalogMediaProductionActionAllowed("UPLOAD", this.testApproval);
    const owner: CatalogMediaOwner = { ownerType: input.ownerType, ownerStoreId: input.ownerType === "STORE" ? input.storeId ?? null : null };
    assertCatalogMediaOwnerShape(owner);
    assertCatalogMediaPurposeForOwner(input.ownerType, input.purpose);
    if (input.ownerType === "STORE" && input.storeId !== owner.ownerStoreId) throw new CatalogPolicyError("CATALOG_MEDIA_STORE_OWNER_REQUIRED", "Authenticated store ownership is required.");
    assertCatalogMediaDeclaration({ purpose: input.purpose, declaredMimeType: input.declaredMimeType, declaredByteSize: input.declaredByteSize });
    const request = { owner, purpose: input.purpose, declaredMimeType: input.declaredMimeType, declaredByteSize: input.declaredByteSize };
    const requestHash = catalogRequestHash(request);
    const existing = await this.repository.findIntentByActorOperation(input.actorUserId, input.operationId);
    if (existing) {
      if (existing.requestHash !== requestHash) throw new CatalogConflictError("CATALOG_MEDIA_IDEMPOTENCY_CONFLICT", "Upload operation ID was already used with different input.");
      const uploadTarget = await this.storage.createUploadTarget({ intentReference: existing.publicReference, storageKey: existing.storageKey, maximumBytes: existing.maximumBytes, expiresAt: existing.expiresAt });
      return { upload: this.uploadDto(existing, uploadTarget), replayed: true };
    }
    const createdAt = this.now();
    const expiresAt = new Date(createdAt.getTime() + CATALOG_MEDIA_UPLOAD_TTL_MS);
    const intentReference = catalogPublicReference("CMU");
    const created = await this.repository.createIntent({
      owner,
      assetReference: catalogPublicReference("CMA"),
      intentReference,
      storageKey: `catalog-media/${randomBytes(32).toString("hex")}`,
      storageProvider: this.storage.code,
      purpose: input.purpose,
      expectedMimeType: input.declaredMimeType,
      expectedByteSize: input.declaredByteSize,
      maximumBytes: CATALOG_MEDIA_MAX_UPLOAD_BYTES,
      operationId: input.operationId,
      requestHash,
      expiresAt,
      actorUserId: input.actorUserId,
    });
    const uploadTarget = await this.storage.createUploadTarget({ intentReference, storageKey: created.storageKey, maximumBytes: created.maximumBytes, expiresAt });
    return { upload: this.uploadDto(created, uploadTarget), replayed: false };
  }

  async receiveUploadBytes(input: Readonly<{ actorUserId: string; storeId?: string; uploadReference: string; operationId: string; bytes: Uint8Array }>) {
    assertCatalogMediaProductionActionAllowed("UPLOAD", this.testApproval);
    const intent = await this.requiredIntent(input.uploadReference);
    assertIntentActor(intent, input.actorUserId, input.storeId);
    const contentHash = createHash("sha256").update(input.bytes).digest("hex");
    const receipt = operation("MEDIA_UPLOAD_BYTES", input.actorUserId, input.operationId, { uploadReference: input.uploadReference, contentHash });
    const replay = await this.repository.findOperation(receipt);
    if (replay) {
      if (replay.requestHash !== receipt.requestHash) throw new CatalogConflictError("CATALOG_MEDIA_IDEMPOTENCY_CONFLICT", "Media byte operation ID was reused with different bytes.");
      return { asset: safeAssetDto(intent.asset), replayed: true };
    }
    if (this.now() >= intent.expiresAt) {
      await this.repository.markExpired(intent, input.actorUserId);
      throw new CatalogPolicyError("CATALOG_MEDIA_UPLOAD_EXPIRED", "Upload intent has expired.", 409);
    }
    assertCatalogMediaUploadTransition(intent.status, "UPLOADED");
    assertCatalogMediaAssetTransition(intent.asset.status, "UPLOADED");
    if (input.bytes.byteLength !== intent.expectedByteSize) {
      await this.repository.failValidation(intent, "REJECTED", "CATALOG_MEDIA_SIZE_MISMATCH", receipt);
      throw new CatalogPolicyError("CATALOG_MEDIA_SIZE_MISMATCH", "Received byte size does not match the upload intent.");
    }
    const confirmed = await this.storage.confirmUpload({ storageKey: intent.storageKey, bytes: input.bytes, maximumBytes: intent.maximumBytes });
    const updated = await this.repository.markUploaded(intent, { byteSize: confirmed.byteSize, operation: receipt });
    return { asset: safeAssetDto(updated.asset), replayed: false };
  }

  async completeUpload(input: Readonly<{ actorUserId: string; storeId?: string; uploadReference: string; operationId: string }>) {
    assertCatalogMediaProductionActionAllowed("UPLOAD", this.testApproval);
    let intent = await this.requiredIntent(input.uploadReference);
    assertIntentActor(intent, input.actorUserId, input.storeId);
    const receipt = operation("MEDIA_UPLOAD_COMPLETE", input.actorUserId, input.operationId, { uploadReference: input.uploadReference });
    const replay = await this.repository.findOperation(receipt);
    if (replay) {
      if (replay.requestHash !== receipt.requestHash) throw new CatalogConflictError("CATALOG_MEDIA_IDEMPOTENCY_CONFLICT", "Completion operation ID was reused with different input.");
      return { asset: safeAssetDto(intent.asset), replayed: true };
    }
    if (this.now() >= intent.expiresAt) {
      await this.repository.markExpired(intent, input.actorUserId);
      throw new CatalogPolicyError("CATALOG_MEDIA_UPLOAD_EXPIRED", "Upload intent has expired.", 409);
    }
    if (intent.completionCount > 0 || intent.status === "COMPLETED") throw new CatalogConflictError("CATALOG_MEDIA_ALREADY_COMPLETED", "Upload intent has already completed.");
    assertCatalogMediaUploadTransition(intent.status, "COMPLETED");
    assertCatalogMediaAssetTransition(intent.asset.status, "VALIDATING");
    intent = await this.repository.startValidation(intent, receipt);
    try {
      const bytes = await this.storage.openForValidation({ storageKey: intent.storageKey, maximumBytes: intent.maximumBytes });
      const inspection = inspectCatalogMediaContent({ bytes, declaredMimeType: intent.expectedMimeType, declaredByteSize: intent.expectedByteSize });
      const ready = await this.repository.completeValidation(intent, inspection, receipt);
      return { asset: safeAssetDto(ready.asset), replayed: false };
    } catch (error) {
      const definite = error instanceof CatalogPolicyError && !["CATALOG_MEDIA_STORAGE_FAILURE", "CATALOG_MEDIA_STORAGE_MISSING"].includes(error.code);
      const status = definite ? "REJECTED" : "QUARANTINED";
      const reasonCode = error instanceof CatalogPolicyError ? error.code : "CATALOG_MEDIA_INSPECTION_UNCERTAIN";
      await this.repository.failValidation(intent, status, reasonCode, receipt);
      throw error;
    }
  }

  async listStoreAssets(storeId: string) {
    return (await this.repository.listAssets({ ownerType: "STORE", ownerStoreId: storeId })).map((asset) => safeAssetDto(asset));
  }

  async getStoreAsset(storeId: string, publicReference: string) {
    const asset = await this.requiredAsset(publicReference);
    assertStoreCanAccessCatalogMedia(asset, storeId);
    return safeAssetDto(asset);
  }

  async archiveStoreAsset(input: Readonly<{ actorUserId: string; storeId: string; publicReference: string; operationId: string }>) {
    const asset = await this.requiredAsset(input.publicReference);
    assertStoreCanAccessCatalogMedia(asset, input.storeId);
    const receipt = operation("MEDIA_ARCHIVE", input.actorUserId, input.operationId, { publicReference: input.publicReference });
    const replay = await this.repository.findOperation(receipt);
    if (replay) { if (replay.requestHash !== receipt.requestHash) throw new CatalogConflictError("CATALOG_MEDIA_IDEMPOTENCY_CONFLICT", "Archive operation ID was reused with different input."); return safeAssetDto(asset); }
    assertCatalogMediaAssetTransition(asset.status, "ARCHIVED");
    const archived = await this.repository.archiveAsset(asset, receipt);
    return safeAssetDto(archived);
  }

  async listAdminAssets() {
    return (await this.repository.listAssets()).map((asset) => safeAssetDto(asset, true));
  }

  async getAdminAsset(id: string) {
    const asset = await this.requiredAsset(id);
    return { ...safeAssetDto(asset, true), evidence: await this.repository.getAssetEvidence(asset.id) };
  }

  async reviewAsset(input: Readonly<{ actorUserId: string; id: string; action: "APPROVE" | "QUARANTINE" | "REJECT"; reasonCode: string; operationId: string }>) {
    const asset = await this.requiredAsset(input.id);
    const target = input.action === "APPROVE" ? "READY" : input.action === "QUARANTINE" ? "QUARANTINED" : "REJECTED";
    const receipt = operation(`MEDIA_${input.action}`, input.actorUserId, input.operationId, { id: input.id, reasonCode: input.reasonCode });
    const replay = await this.repository.findOperation(receipt);
    if (replay) { if (replay.requestHash !== receipt.requestHash) throw new CatalogConflictError("CATALOG_MEDIA_IDEMPOTENCY_CONFLICT", "Review operation ID was reused with different input."); return safeAssetDto(asset, true); }
    assertCatalogMediaAssetTransition(asset.status, target);
    if (target === "READY" && (!asset.checksum || !asset.mimeType || !asset.byteSize || !asset.width || !asset.height || !asset.privacyInspectionPassed)) {
      throw new CatalogPolicyError("CATALOG_MEDIA_READY_EVIDENCE_MISSING", "Media cannot be approved without complete validation and privacy evidence.");
    }
    return safeAssetDto(await this.repository.reviewAsset(asset, target, input.reasonCode, receipt), true);
  }

  private uploadDto(intent: CatalogMediaUploadIntentRecord, target: CatalogMediaUploadTarget) {
    return Object.freeze({ publicReference: intent.publicReference, status: intent.status, purpose: intent.purpose, expectedMimeType: intent.expectedMimeType, expectedByteSize: intent.expectedByteSize, maximumBytes: intent.maximumBytes, expiresAt: intent.expiresAt.toISOString(), asset: safeAssetDto(intent.asset), target });
  }

  private async requiredIntent(publicReference: string): Promise<CatalogMediaUploadIntentRecord> {
    const intent = await this.repository.findIntentByReference(publicReference);
    if (!intent) throw new CatalogNotFoundError("Catalog media upload intent was not found.");
    return intent;
  }

  private async requiredAsset(reference: string): Promise<CatalogMediaAssetRecord> {
    const asset = await this.repository.findAsset(reference);
    if (!asset) throw new CatalogNotFoundError("Catalog media asset was not found.");
    return asset;
  }
}

const includeAsset = { asset: true } as const;

export class PrismaCatalogMediaRepository implements CatalogMediaRepository {
  findIntentByActorOperation(actorUserId: string, operationId: string) { return prisma.catalogMediaUploadIntent.findUnique({ where: { createdByUserId_operationId: { createdByUserId: actorUserId, operationId } }, include: includeAsset }) as Promise<CatalogMediaUploadIntentRecord | null>; }
  findIntentByReference(publicReference: string) { return prisma.catalogMediaUploadIntent.findUnique({ where: { publicReference }, include: includeAsset }) as Promise<CatalogMediaUploadIntentRecord | null>; }

  async createIntent(input: Parameters<CatalogMediaRepository["createIntent"]>[0]) {
    return prisma.$transaction(async (tx) => {
      const asset = await tx.catalogMediaAsset.create({ data: { publicReference: input.assetReference, ownerType: input.owner.ownerType, ownerStoreId: input.owner.ownerStoreId, purpose: input.purpose, storageKey: input.storageKey, storageProvider: input.storageProvider, declaredMimeType: input.expectedMimeType, declaredByteSize: input.expectedByteSize, createdByUserId: input.actorUserId, updatedByUserId: input.actorUserId } });
      const intent = await tx.catalogMediaUploadIntent.create({ data: { publicReference: input.intentReference, ownerType: input.owner.ownerType, ownerStoreId: input.owner.ownerStoreId, assetId: asset.id, purpose: input.purpose, expectedMimeType: input.expectedMimeType, expectedByteSize: input.expectedByteSize, maximumBytes: input.maximumBytes, operationId: input.operationId, requestHash: input.requestHash, storageKey: input.storageKey, expiresAt: input.expiresAt, createdByUserId: input.actorUserId }, include: includeAsset });
      await tx.catalogMediaHistory.create({ data: { assetId: asset.id, uploadIntentId: intent.id, toStatus: "PENDING_UPLOAD", action: "UPLOAD_INTENT_CREATED", actorUserId: input.actorUserId, safeDetails: { purpose: input.purpose, expectedMimeType: input.expectedMimeType, expectedByteSize: input.expectedByteSize } } });
      await recordCatalogEvidence(tx, { aggregateType: "MEDIA", aggregateReference: asset.publicReference, aggregateVersion: 1, action: "UPLOAD_INTENT_CREATED", eventType: "MEDIA_UPDATED", actorUserId: input.actorUserId, safeMetadata: { ownerType: input.owner.ownerType, purpose: input.purpose }, operation: { operationId: input.operationId, storeId: input.owner.ownerStoreId ?? undefined, request: { owner: input.owner, purpose: input.purpose, declaredMimeType: input.expectedMimeType, declaredByteSize: input.expectedByteSize } } });
      return intent as CatalogMediaUploadIntentRecord;
    });
  }

  async findOperation(input: CatalogMediaOperation) {
    return prisma.catalogOperationReceipt.findUnique({ where: { actorUserId_action_operationId: { actorUserId: input.actorUserId, action: `MEDIA:${input.action}`, operationId: input.operationId } }, select: { requestHash: true } });
  }

  async markUploaded(intent: CatalogMediaUploadIntentRecord, input: { byteSize: number; operation: CatalogMediaOperation }) {
    return this.transition(intent, { assetStatus: "UPLOADED", intentStatus: "UPLOADED", action: "UPLOAD_RECEIVED", assetData: { byteSize: input.byteSize, storageConfirmedAt: new Date() }, operation: input.operation });
  }

  async markExpired(intent: CatalogMediaUploadIntentRecord, actorUserId: string) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.catalogMediaUploadIntent.update({ where: { id: intent.id }, data: { status: "EXPIRED" }, include: includeAsset });
      await tx.catalogMediaHistory.create({ data: { assetId: intent.assetId, uploadIntentId: intent.id, fromStatus: intent.asset.status, toStatus: intent.asset.status, action: "UPLOAD_INTENT_EXPIRED", reasonCode: "CATALOG_MEDIA_UPLOAD_EXPIRED", actorUserId } });
      return updated as CatalogMediaUploadIntentRecord;
    });
  }

  async startValidation(intent: CatalogMediaUploadIntentRecord, operationInput: CatalogMediaOperation) {
    return this.transition(intent, { assetStatus: "VALIDATING", action: "VALIDATION_STARTED", operation: operationInput, recordOperation: false });
  }

  async completeValidation(intent: CatalogMediaUploadIntentRecord, inspection: CatalogMediaInspection, operationInput: CatalogMediaOperation) {
    return this.transition(intent, { assetStatus: "READY", intentStatus: "COMPLETED", action: "VALIDATION_READY", operation: operationInput, assetData: { mimeType: inspection.detectedMimeType, byteSize: inspection.byteSize, width: inspection.width, height: inspection.height, checksum: inspection.checksum, privacyInspectionPassed: true, validationSummary: { metadataDisposition: inspection.metadataDisposition }, validatedAt: new Date() }, intentData: { completedAt: new Date(), completionCount: 1 } });
  }

  async failValidation(intent: CatalogMediaUploadIntentRecord, status: "QUARANTINED" | "REJECTED", reasonCode: string, operationInput: CatalogMediaOperation) {
    return this.transition(intent, { assetStatus: status, intentStatus: "CANCELLED", action: status === "REJECTED" ? "VALIDATION_REJECTED" : "VALIDATION_QUARANTINED", reasonCode, operation: operationInput, assetData: status === "REJECTED" ? { rejectionReasonCode: reasonCode } : { quarantineReasonCode: reasonCode } });
  }

  async listAssets(owner?: CatalogMediaOwner) {
    return prisma.catalogMediaAsset.findMany({ where: owner ? { ownerType: owner.ownerType, ownerStoreId: owner.ownerStoreId } : {}, orderBy: { createdAt: "desc" }, take: 200 }) as Promise<CatalogMediaAssetRecord[]>;
  }

  async findAsset(publicReferenceOrId: string) {
    return prisma.catalogMediaAsset.findFirst({ where: { OR: [{ id: publicReferenceOrId }, { publicReference: publicReferenceOrId }] } }) as Promise<CatalogMediaAssetRecord | null>;
  }

  async getAssetEvidence(assetId: string) {
    const [history, attachments] = await Promise.all([
      prisma.catalogMediaHistory.findMany({ where: { assetId }, orderBy: { createdAt: "desc" }, select: { fromStatus: true, toStatus: true, action: true, reasonCode: true, safeDetails: true, actorUserId: true, createdAt: true } }),
      prisma.catalogProductMedia.findMany({ where: { assetId }, orderBy: [{ productId: "asc" }, { displayOrder: "asc" }], select: { id: true, role: true, altText: true, displayOrder: true, product: { select: { publicReference: true, title: true } }, variant: { select: { publicReference: true, title: true } } } }),
    ]);
    return { history, attachments };
  }

  async archiveAsset(asset: CatalogMediaAssetRecord, operationInput: CatalogMediaOperation) {
    return this.assetOnlyTransition(asset, "ARCHIVED", "MEDIA_ARCHIVED", undefined, operationInput, { archivedAt: new Date() });
  }

  async reviewAsset(asset: CatalogMediaAssetRecord, status: "READY" | "QUARANTINED" | "REJECTED", reasonCode: string, operationInput: CatalogMediaOperation) {
    const data = status === "QUARANTINED" ? { quarantineReasonCode: reasonCode } : status === "REJECTED" ? { rejectionReasonCode: reasonCode } : { quarantineReasonCode: null, rejectionReasonCode: null };
    return this.assetOnlyTransition(asset, status, `MEDIA_${status}`, reasonCode, operationInput, data);
  }

  private async transition(intent: CatalogMediaUploadIntentRecord, input: { assetStatus: CatalogMediaAssetLifecycleStatus; intentStatus?: CatalogMediaUploadLifecycleStatus; action: string; reasonCode?: string; operation: CatalogMediaOperation; assetData?: Record<string, unknown>; intentData?: Record<string, unknown>; recordOperation?: boolean }) {
    return prisma.$transaction(async (tx) => {
      const asset = await tx.catalogMediaAsset.update({ where: { id: intent.assetId }, data: { ...input.assetData, status: input.assetStatus, updatedByUserId: input.operation.actorUserId, version: { increment: 1 } } });
      await tx.catalogMediaHistory.create({ data: { assetId: asset.id, uploadIntentId: intent.id, fromStatus: intent.asset.status, toStatus: input.assetStatus, action: input.action, reasonCode: input.reasonCode, actorUserId: input.operation.actorUserId } });
      const updated = await tx.catalogMediaUploadIntent.update({ where: { id: intent.id }, data: { ...input.intentData, ...(input.intentStatus ? { status: input.intentStatus } : {}) }, include: includeAsset });
      await recordCatalogEvidence(tx, { aggregateType: "MEDIA", aggregateReference: asset.publicReference, aggregateVersion: asset.version, action: input.action, eventType: "MEDIA_UPDATED", actorUserId: input.operation.actorUserId, reasonCode: input.reasonCode });
      if (input.recordOperation !== false) {
        await tx.catalogOperationReceipt.create({ data: { actorUserId: input.operation.actorUserId, storeId: asset.ownerStoreId, operationId: input.operation.operationId, requestHash: input.operation.requestHash, action: `MEDIA:${input.operation.action}`, aggregateReference: asset.publicReference } });
      }
      return updated as CatalogMediaUploadIntentRecord;
    });
  }

  private async assetOnlyTransition(asset: CatalogMediaAssetRecord, status: CatalogMediaAssetLifecycleStatus, action: string, reasonCode: string | undefined, operationInput: CatalogMediaOperation, data: Record<string, unknown>) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.catalogMediaAsset.update({ where: { id: asset.id }, data: { ...data, status, updatedByUserId: operationInput.actorUserId, version: { increment: 1 } } });
      await tx.catalogMediaHistory.create({ data: { assetId: asset.id, fromStatus: asset.status, toStatus: status, action, reasonCode, actorUserId: operationInput.actorUserId } });
      await recordCatalogEvidence(tx, { aggregateType: "MEDIA", aggregateReference: asset.publicReference, aggregateVersion: updated.version, action, eventType: "MEDIA_UPDATED", actorUserId: operationInput.actorUserId, reasonCode });
      await tx.catalogOperationReceipt.create({ data: { actorUserId: operationInput.actorUserId, storeId: asset.ownerStoreId, operationId: operationInput.operationId, requestHash: operationInput.requestHash, action: `MEDIA:${operationInput.action}`, aggregateReference: asset.publicReference } });
      return updated as CatalogMediaAssetRecord;
    });
  }
}

export function createProductionCatalogMediaIntakeService(): CatalogMediaIntakeService {
  return new CatalogMediaIntakeService(new PrismaCatalogMediaRepository(), createProductionCatalogMediaStorageAdapter());
}
