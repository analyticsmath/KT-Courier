import { beforeAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { prisma } from "@/lib/db/prisma";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import { CatalogMediaIntakeService, PrismaCatalogMediaRepository } from "@/lib/services/catalog-media-intake.service";
import { DeterministicCatalogMediaStorageAdapter } from "@/lib/catalog/media/deterministic-catalog-media-storage-adapter";
import { rebuildStorefrontStoreDocument } from "@/lib/services/storefront-store.service";
import { describeCatalogIntegration } from "./catalog-integration-guard";

async function foundation(storage = new DeterministicCatalogMediaStorageAdapter()) {
  const tag = randomUUID();
  const user = await prisma.user.create({ data: { email: `disposable-media-${tag}@example.test`, role: "STORE", status: "ACTIVE", name: "Disposable media owner" } });
  const store = await prisma.store.create({ data: { ownerUserId: user.id, slug: `disposable-media-${tag}`, name: "Disposable media store", status: "ACTIVE" } });
  const repository = new PrismaCatalogMediaRepository();
  const service = new CatalogMediaIntakeService(repository, storage);
  const bytes = await sharp({ create: { width: 400, height: 400, channels: 3, background: "#008844" } }).png().toBuffer();
  const input = { actorUserId: user.id, ownerType: "STORE" as const, storeId: store.id, purpose: "STORE_LOGO" as const, declaredMimeType: "image/png", declaredByteSize: bytes.length, operationId: `${tag}:intent` };
  const created = await service.createUploadIntent(input);
  const command = { actorUserId: user.id, storeId: store.id, uploadReference: created.upload.publicReference };
  return { tag, user, store, repository, service, storage, bytes, input, created, command };
}

async function uploaded(source: Awaited<ReturnType<typeof foundation>>) {
  await source.service.receiveUploadBytes({ ...source.command, operationId: `${source.tag}:bytes`, bytes: source.bytes });
  return { ...source.command, operationId: `${source.tag}:complete` };
}

describeCatalogIntegration("catalog media integration", () => {
  beforeAll(async () => {
    requireDisposableStoreSettlementDatabase();
    const identity = await prisma.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database() AS database, current_user AS role`;
    expect(identity).toEqual([{ database: "kt_launch_test", role: "disposable" }]);
  });

  it("persists one upload intent and denies changed-request replay", async () => {
    const source = await foundation();
    expect(await source.service.createUploadIntent(source.input)).toMatchObject({ replayed: true, upload: { publicReference: source.created.upload.publicReference } });
    await expect(source.service.createUploadIntent({ ...source.input, declaredByteSize: source.bytes.length + 1 })).rejects.toMatchObject({ code: "CATALOG_MEDIA_IDEMPOTENCY_CONFLICT" });
    expect(await prisma.catalogMediaUploadIntent.count({ where: { ownerStoreId: source.store.id } })).toBe(1);
    expect(await prisma.catalogMediaAsset.count({ where: { ownerStoreId: source.store.id } })).toBe(1);
  });

  it("commits decoded READY evidence and a single completion receipt", async () => {
    const source = await foundation(); const command = await uploaded(source);
    const completed = await source.service.completeUpload(command);
    expect(completed.asset).toMatchObject({ status: "READY", mimeType: "image/png", width: 400, height: 400 });
    const asset = await source.repository.findAsset(completed.asset.publicReference);
    expect(asset).toMatchObject({ privacyInspectionPassed: true, checksum: expect.stringMatching(/^[a-f0-9]{64}$/), byteSize: source.bytes.length });
    expect(source.storage.hasObjectForTesting(asset!.storageKey)).toBe(true);
    expect(await source.service.completeUpload(command)).toMatchObject({ replayed: true });
    expect(await prisma.catalogMediaHistory.count({ where: { assetId: asset!.id, action: "VALIDATION_READY" } })).toBe(1);
    expect(await prisma.catalogOperationReceipt.count({ where: { actorUserId: source.user.id, operationId: command.operationId } })).toBe(1);
  });

  it("denies foreign upload and archive without mutating the owned asset", async () => {
    const source = await foundation(); const foreign = await foundation();
    const before = await source.repository.findAsset(source.created.upload.asset.publicReference);
    await expect(source.service.receiveUploadBytes({ ...source.command, actorUserId: foreign.user.id, storeId: foreign.store.id, operationId: randomUUID(), bytes: source.bytes })).rejects.toMatchObject({ code: "CATALOG_MEDIA_UPLOAD_FORBIDDEN" });
    await expect(source.service.archiveStoreAsset({ actorUserId: foreign.user.id, storeId: foreign.store.id, publicReference: before!.publicReference, operationId: randomUUID() })).rejects.toThrow();
    expect(await source.repository.findAsset(before!.publicReference)).toEqual(before);
  });

  it("rejects disguised SVG bytes without READY or completion evidence", async () => {
    const source = await foundation(); const bytes = Buffer.from("<svg><script>alert(1)</script></svg>");
    const created = await source.service.createUploadIntent({ ...source.input, operationId: randomUUID(), declaredByteSize: bytes.length });
    const command = { ...source.command, uploadReference: created.upload.publicReference };
    await source.service.receiveUploadBytes({ ...command, operationId: randomUUID(), bytes });
    await expect(source.service.completeUpload({ ...command, operationId: randomUUID() })).rejects.toThrow();
    expect(await source.repository.findIntentByReference(created.upload.publicReference)).toMatchObject({ status: "CANCELLED", completionCount: 0, asset: { status: "REJECTED", privacyInspectionPassed: false } });
  });

  it("serializes duplicate completion without quarantining the winning READY asset", async () => {
    const source = await foundation(); const command = await uploaded(source);
    const results = await Promise.allSettled([source.service.completeUpload(command), source.service.completeUpload(command)]);
    expect(results.some(result => result.status === "fulfilled")).toBe(true);
    const intent = await source.repository.findIntentByReference(command.uploadReference);
    expect(intent).toMatchObject({ status: "COMPLETED", completionCount: 1, asset: { status: "READY" } });
    expect(await prisma.catalogMediaHistory.count({ where: { assetId: intent!.assetId, action: "VALIDATION_READY" } })).toBe(1);
    expect(await source.service.completeUpload(command)).toMatchObject({ replayed: true });
  });

  it("replaces branding atomically and removes it without reviving the prior image", async () => {
    const source = await foundation(); const first = await source.service.completeUpload(await uploaded(source));
    const next = await source.service.createUploadIntent({ ...source.input, operationId: randomUUID() });
    const command = { ...source.command, uploadReference: next.upload.publicReference };
    await source.service.receiveUploadBytes({ ...command, operationId: randomUUID(), bytes: source.bytes });
    const second = await source.service.completeUpload({ ...command, operationId: randomUUID() });
    expect(await source.repository.findAsset(first.asset.publicReference)).toMatchObject({ status: "ARCHIVED" });
    await rebuildStorefrontStoreDocument(source.store.id);
    expect(await prisma.storefrontStoreDocument.findUnique({ where: { storeId: source.store.id } })).toMatchObject({ logoMediaReference: second.asset.publicReference });
    const remove = { actorUserId: source.user.id, storeId: source.store.id, publicReference: second.asset.publicReference, operationId: randomUUID() };
    expect(await source.service.archiveStoreAsset(remove)).toMatchObject({ status: "ARCHIVED" });
    expect(await source.service.archiveStoreAsset(remove)).toMatchObject({ status: "ARCHIVED" });
    await rebuildStorefrontStoreDocument(source.store.id);
    expect(await prisma.storefrontStoreDocument.findUnique({ where: { storeId: source.store.id } })).toMatchObject({ logoMediaReference: null });
    expect(await prisma.catalogMediaAsset.count({ where: { ownerStoreId: source.store.id, status: "READY" } })).toBe(0);
    const archived = await source.repository.findAsset(second.asset.publicReference);
    expect(await prisma.catalogMediaHistory.count({ where: { assetId: archived!.id, action: "MEDIA_ARCHIVED" } })).toBe(1);
  });

  it("rejects a stale archive version without changing committed history", async () => {
    const source = await foundation(); const ready = await source.service.completeUpload(await uploaded(source));
    const stale = await source.repository.findAsset(ready.asset.publicReference);
    await source.service.archiveStoreAsset({ actorUserId: source.user.id, storeId: source.store.id, publicReference: ready.asset.publicReference, operationId: randomUUID() });
    const before = await source.repository.findAsset(ready.asset.publicReference);
    await expect(source.repository.archiveAsset(stale!, { actorUserId: source.user.id, action: "MEDIA_ARCHIVE", operationId: randomUUID(), requestHash: "0".repeat(64) })).rejects.toMatchObject({ code: "CATALOG_MEDIA_VERSION_CONFLICT" });
    expect(await source.repository.findAsset(ready.asset.publicReference)).toEqual(before);
  });

  it("quarantines unavailable bytes without claiming completion", async () => {
    class UnavailableStorage extends DeterministicCatalogMediaStorageAdapter { override async openForValidation(): Promise<Uint8Array> { throw new Error("Synthetic unavailable storage"); } }
    const source = await foundation(new UnavailableStorage()); const command = await uploaded(source);
    await expect(source.service.completeUpload(command)).rejects.toThrow("Synthetic unavailable storage");
    const intent = await source.repository.findIntentByReference(command.uploadReference);
    expect(intent).toMatchObject({ status: "CANCELLED", completionCount: 0, asset: { status: "QUARANTINED", privacyInspectionPassed: false } });
    expect(await prisma.catalogMediaHistory.count({ where: { assetId: intent!.assetId, action: "VALIDATION_READY" } })).toBe(0);
  });
});
