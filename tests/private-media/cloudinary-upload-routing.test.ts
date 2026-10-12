import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import sharp from "sharp";
const mock = vi.hoisted(() => ({ findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), cloudWrite: vi.fn(), documentWrite: vi.fn(), cloudFactory: vi.fn(), documentFactory: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { privateMediaObject: { findFirst: mock.findFirst, create: mock.create, update: mock.update } } }));
vi.mock("@/lib/auth/permissions", () => ({ hasPermission: vi.fn().mockResolvedValue(false) }));
vi.mock("@/lib/client-platform/store-access", () => ({ storeAccess: vi.fn() }));
vi.mock("@/lib/private-media/cloudinary-private-image-storage", () => ({ CLOUDINARY_PRIVATE_IMAGE_CODE: "CLOUDINARY_AUTHENTICATED_IMAGE", createCloudinaryPrivateImageStorageAdapter: mock.cloudFactory }));
vi.mock("@/lib/private-media/private-media-storage", async importOriginal => ({ ...await importOriginal<object>(), createPrivateMediaStorageAdapter: mock.documentFactory }));
import { PrivateMediaService } from "@/lib/private-media/private-media.service";
import { PrivateMediaStorageError } from "@/lib/private-media/private-media-storage";
const cloud = { code: "CLOUDINARY_AUTHENTICATED_IMAGE", write: mock.cloudWrite, read: vi.fn(), delete: vi.fn() };
const documents = { code: "S3", write: mock.documentWrite, read: vi.fn(), delete: vi.fn() };
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWPgEpHjEpFjgFAABk4A8YCCZIUAAAAASUVORK5CYII=", "base64");
const upload = { actor: { userId: "owner", role: "CUSTOMER" as const }, ownerType: "USER" as const, ownerId: "owner", purpose: "OTHER" as const, fileName: "evidence.png", mimeType: "image/png", bytes: png };
beforeEach(() => {
  vi.resetAllMocks();
  mock.cloudFactory.mockReturnValue(cloud); mock.documentFactory.mockReturnValue(documents);
  cloud.delete.mockResolvedValue(undefined); documents.delete.mockResolvedValue(undefined);
  mock.findFirst.mockResolvedValue(null);
  mock.create.mockImplementation(async ({ data }) => ({ ...data, createdAt: new Date("2026-10-06T00:00:00Z") }));
  mock.update.mockImplementation(async ({ data }) => ({ publicReference: "PMO-test", ownerType: "USER", purpose: "OTHER", retentionUntil: null, createdAt: new Date("2026-10-06T00:00:00Z"), ...data }));
});
describe("new private image storage routing", () => {
  it("routes decoded raster evidence to Cloudinary with matching stored checksum and source hash", async () => {
    await new PrivateMediaService().upload(upload);
    const stored = mock.cloudWrite.mock.calls[0][0];
    expect(stored.mimeType).toBe("image/png");
    expect(await sharp(stored.bytes).metadata()).toMatchObject({ width: 2, height: 2, format: "png" });
    expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ checksum: createHash("sha256").update(stored.bytes).digest("hex"), byteSize: stored.bytes.byteLength }) }));
    expect(mock.documentWrite).not.toHaveBeenCalled();
    expect(mock.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ storageProvider: cloud.code, metadata: expect.objectContaining({ sourceChecksum: createHash("sha256").update(png).digest("hex"), rasterNormalization: "PRIVATE_RASTER_V1" }) }) }));
  });
  it("keeps PDFs on document storage and honors explicit injected adapters", async () => {
    await new PrivateMediaService().upload({ ...upload, fileName: "receipt.pdf", mimeType: "application/pdf", bytes: new Uint8Array(Buffer.from("%PDF-test")) });
    await new PrivateMediaService(documents).upload(upload);
    expect(mock.documentWrite).toHaveBeenCalledTimes(2);
    expect(mock.cloudFactory).not.toHaveBeenCalled();
  });
  it("checks ownership before Cloudinary and fails missing configuration before creating records", async () => {
    await expect(new PrivateMediaService().upload({ ...upload, ownerId: "another-owner" })).rejects.toMatchObject({ code: "PRIVATE_MEDIA_OWNER_FORBIDDEN" });
    expect(mock.cloudFactory).not.toHaveBeenCalled();
    mock.cloudFactory.mockImplementation(() => { throw new PrivateMediaStorageError("PRIVATE_MEDIA_STORAGE_NOT_CONFIGURED", "Missing credentials"); });
    await expect(new PrivateMediaService().upload(upload)).rejects.toMatchObject({ code: "PRIVATE_MEDIA_STORAGE_NOT_CONFIGURED", status: 503 });
    expect(mock.create).not.toHaveBeenCalled();
  });
  it("rejects a signature-only image before allocating provider storage or a database record", async () => {
    await expect(new PrivateMediaService().upload({ ...upload, bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]) })).rejects.toMatchObject({ code: "PRIVATE_MEDIA_IMAGE_CONTENT_INVALID", status: 422 });
    expect(mock.cloudFactory).not.toHaveBeenCalled(); expect(mock.create).not.toHaveBeenCalled();
  });
  it("deletes the owned upload when READY database finalization fails and quarantines its record", async () => {
    mock.update.mockRejectedValueOnce(new Error("DISPOSABLE_DB_FINALIZATION_FAILURE"));
    await expect(new PrivateMediaService().upload(upload)).rejects.toThrow("DISPOSABLE_DB_FINALIZATION_FAILURE");
    expect(cloud.delete).toHaveBeenCalledWith(mock.cloudWrite.mock.calls[0][0].key);
    expect(mock.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "QUARANTINED" }) }));
  });
  it("keeps a failed deletion recoverable in quarantine without replacing the original error", async () => {
    mock.update.mockRejectedValueOnce(new Error("DISPOSABLE_DB_FINALIZATION_FAILURE")); cloud.delete.mockRejectedValueOnce(new Error("DISPOSABLE_DELETE_FAILURE"));
    await expect(new PrivateMediaService().upload(upload)).rejects.toThrow("DISPOSABLE_DB_FINALIZATION_FAILURE");
    expect(mock.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "QUARANTINED" }) }));
  });
});
