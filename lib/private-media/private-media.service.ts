import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { PrivateMediaOwnerType, PrivateMediaPurpose, PrivateMediaStatus, UserRole } from "@/types/db";
import { createPrivateMediaStorageAdapter, type PrivateMediaStorageAdapter, PrivateMediaStorageError } from "./private-media-storage";

const MAX_PRIVATE_MEDIA_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export class PrivateMediaPolicyError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: 400 | 403 | 404 | 409 | 413 | 422 | 503,
    message: string,
  ) {
    super(message);
    this.name = "PrivateMediaPolicyError";
  }
}

export type PrivateMediaActor = Readonly<{ userId: string; role: UserRole }>;
export type PrivateMediaUploadInput = Readonly<{
  actor: PrivateMediaActor;
  ownerType: PrivateMediaOwnerType;
  ownerId: string;
  purpose: PrivateMediaPurpose;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  retentionUntil?: Date | null;
}>;

function detectedMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 5 && Buffer.from(bytes.slice(0, 5)).toString("ascii") === "%PDF-") return "application/pdf";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && Buffer.from(bytes.slice(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes.length >= 12 && Buffer.from(bytes.slice(0, 4)).toString("ascii") === "RIFF" && Buffer.from(bytes.slice(8, 12)).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

function assertUpload(input: PrivateMediaUploadInput): string {
  const fileName = input.fileName.trim();
  if (!fileName || fileName.length > 180 || /[\\/\0]/.test(fileName)) throw new PrivateMediaPolicyError("PRIVATE_MEDIA_FILENAME_INVALID", 422, "File name is invalid.");
  if (!ALLOWED_MIME_TYPES.has(input.mimeType)) throw new PrivateMediaPolicyError("PRIVATE_MEDIA_MIME_NOT_ALLOWED", 422, "The file type is not allowed for private evidence.");
  if (input.bytes.byteLength < 1 || input.bytes.byteLength > MAX_PRIVATE_MEDIA_BYTES) throw new PrivateMediaPolicyError("PRIVATE_MEDIA_SIZE_INVALID", 413, "Private evidence must be between 1 byte and 10 MB.");
  const detected = detectedMime(input.bytes);
  if (detected !== input.mimeType) throw new PrivateMediaPolicyError("PRIVATE_MEDIA_CONTENT_MISMATCH", 422, "File content does not match the declared type.");
  return fileName;
}

function assertPurposeOwner(ownerType: PrivateMediaOwnerType, purpose: PrivateMediaPurpose): void {
  const driverPurposes = new Set<PrivateMediaPurpose>(["DRIVER_IDENTITY_DOCUMENT", "DRIVER_LICENCE", "DRIVER_PROFILE_PHOTO"]);
  const vehiclePurposes = new Set<PrivateMediaPurpose>(["VEHICLE_REGISTRATION", "VEHICLE_LICENCE_DISC", "VEHICLE_INSURANCE", "VEHICLE_COMPLIANCE_IMAGE"]);
  if (ownerType === "DRIVER" && driverPurposes.has(purpose)) return;
  if (ownerType === "VEHICLE" && vehiclePurposes.has(purpose)) return;
  if (ownerType === "CLAIM" && purpose === "CLAIM_EVIDENCE") return;
  if (ownerType === "PROOF_OF_DELIVERY" && purpose === "POD_EVIDENCE") return;
  if (ownerType === "STORE" && purpose === "STORE_VERIFICATION_DOCUMENT") return;
  if (ownerType === "INCIDENT" && purpose === "INCIDENT_EVIDENCE") return;
  if (purpose === "OTHER") return;
  throw new PrivateMediaPolicyError("PRIVATE_MEDIA_PURPOSE_OWNER_MISMATCH", 422, "This private-media purpose is not allowed for the selected owner.");
}

function storageError(error: unknown): never {
  if (error instanceof PrivateMediaStorageError) throw new PrivateMediaPolicyError(error.code, 503, "Private media storage is unavailable.");
  throw error;
}

export class PrivateMediaService {
  constructor(private readonly storage: PrivateMediaStorageAdapter = createPrivateMediaStorageAdapter()) {}

  async upload(input: PrivateMediaUploadInput) {
    const fileName = assertUpload(input);
    assertPurposeOwner(input.ownerType, input.purpose);
    await this.assertCanManageOwner(input.actor, input.ownerType, input.ownerId);
    const checksum = createHash("sha256").update(input.bytes).digest("hex");
    const duplicate = await prisma.privateMediaObject.findFirst({
      where: { ownerType: input.ownerType, ownerId: input.ownerId, purpose: input.purpose, checksum, status: PrivateMediaStatus.READY },
      orderBy: { createdAt: "asc" },
    });
    if (duplicate) return this.safeMetadata(duplicate);
    const id = randomUUID();
    const storageKey = `private-media/${id}`;
    const publicReference = `PMO-${id}`;
    const record = await prisma.privateMediaObject.create({
      data: {
        id,
        publicReference,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        purpose: input.purpose,
        storageProvider: this.storage.code,
        storageKey,
        originalFileName: fileName,
        declaredMimeType: input.mimeType,
        retentionUntil: input.retentionUntil ?? null,
        createdByUserId: input.actor.userId,
      },
    });
    try {
      await this.storage.write({ key: storageKey, bytes: input.bytes, mimeType: input.mimeType });
      const ready = await prisma.privateMediaObject.update({
        where: { id: record.id },
        data: { status: PrivateMediaStatus.READY, detectedMimeType: input.mimeType, byteSize: input.bytes.byteLength, checksum },
      });
      return this.safeMetadata(ready);
    } catch (error) {
      await prisma.privateMediaObject.update({ where: { id: record.id }, data: { status: PrivateMediaStatus.QUARANTINED, rejectionReason: error instanceof Error ? error.name : "PRIVATE_MEDIA_STORAGE_FAILURE" } }).catch(() => undefined);
      storageError(error);
    }
  }

  async uploadForDriver(input: Readonly<{ actor: PrivateMediaActor; purpose: PrivateMediaPurpose; vehicleId?: string; fileName: string; mimeType: string; bytes: Uint8Array; retentionUntil?: Date | null }>) {
    const driver = await prisma.driverProfile.findUnique({ where: { userId: input.actor.userId }, select: { id: true } });
    if (!driver) throw new PrivateMediaPolicyError("DRIVER_PROFILE_NOT_FOUND", 404, "Driver profile was not found.");
    if (input.vehicleId) {
      const vehicle = await prisma.vehicle.findFirst({ where: { id: input.vehicleId, driverProfileId: driver.id, archivedAt: null }, select: { id: true } });
      if (!vehicle) throw new PrivateMediaPolicyError("VEHICLE_NOT_FOUND", 404, "Vehicle was not found.");
      return this.upload({ actor: input.actor, ownerType: PrivateMediaOwnerType.VEHICLE, ownerId: vehicle.id, purpose: input.purpose, fileName: input.fileName, mimeType: input.mimeType, bytes: input.bytes, retentionUntil: input.retentionUntil });
    }
    return this.upload({ actor: input.actor, ownerType: PrivateMediaOwnerType.DRIVER, ownerId: driver.id, purpose: input.purpose, fileName: input.fileName, mimeType: input.mimeType, bytes: input.bytes, retentionUntil: input.retentionUntil });
  }

  async read(input: Readonly<{ actor: PrivateMediaActor; reference: string; requestReference?: string }>) {
    const record = await prisma.privateMediaObject.findUnique({ where: { publicReference: input.reference } });
    if (!record) throw new PrivateMediaPolicyError("PRIVATE_MEDIA_NOT_FOUND", 404, "Private media was not found.");
    const allowed = await this.canAccess(input.actor, record.ownerType, record.ownerId);
    await prisma.privateMediaAccessLog.create({ data: { privateMediaObjectId: record.id, actorUserId: input.actor.userId, action: "READ", outcome: allowed ? "ALLOWED" : "DENIED", requestReference: input.requestReference } });
    if (!allowed) throw new PrivateMediaPolicyError("PRIVATE_MEDIA_FORBIDDEN", 403, "You cannot access this private media.");
    if (record.status !== PrivateMediaStatus.READY && record.status !== PrivateMediaStatus.RETAINED) throw new PrivateMediaPolicyError("PRIVATE_MEDIA_UNAVAILABLE", 409, "Private media is not available.");
    try {
      return { bytes: await this.storage.read(record.storageKey), mimeType: record.detectedMimeType ?? record.declaredMimeType, fileName: record.originalFileName };
    } catch (error) {
      storageError(error);
    }
  }

  async requestDeletion(input: Readonly<{ actor: PrivateMediaActor; reference: string }>) {
    const record = await prisma.privateMediaObject.findUnique({ where: { publicReference: input.reference } });
    if (!record) throw new PrivateMediaPolicyError("PRIVATE_MEDIA_NOT_FOUND", 404, "Private media was not found.");
    const ownsRecord = await this.canAccess(input.actor, record.ownerType, record.ownerId);
    const canDelete = ownsRecord || await hasPermission({ userId: input.actor.userId, role: input.actor.role, permissionKey: PERMISSIONS.PRIVATE_MEDIA_DELETE });
    if (!canDelete) throw new PrivateMediaPolicyError("PRIVATE_MEDIA_FORBIDDEN", 403, "You cannot delete this private media.");
    if (record.status === PrivateMediaStatus.DELETED) return this.safeMetadata(record);
    await prisma.privateMediaObject.update({ where: { id: record.id }, data: { status: PrivateMediaStatus.DELETE_REQUESTED, deleteRequestedAt: new Date(), version: { increment: 1 } } });
    try {
      await this.storage.delete(record.storageKey);
      return this.safeMetadata(await prisma.privateMediaObject.update({ where: { id: record.id }, data: { status: PrivateMediaStatus.DELETED, deletedAt: new Date(), version: { increment: 1 } } }));
    } catch (error) {
      storageError(error);
    }
  }

  async getMetadata(input: Readonly<{ actor: PrivateMediaActor; reference: string }>) {
    const record = await prisma.privateMediaObject.findUnique({ where: { publicReference: input.reference } });
    if (!record) throw new PrivateMediaPolicyError("PRIVATE_MEDIA_NOT_FOUND", 404, "Private media was not found.");
    if (!await this.canAccess(input.actor, record.ownerType, record.ownerId)) throw new PrivateMediaPolicyError("PRIVATE_MEDIA_FORBIDDEN", 403, "You cannot access this private media.");
    return this.safeMetadata(record);
  }

  /** Reusable authorization authority for a controlled reference association.
   * It never returns a storage key or file content. */
  async assertIncidentEvidenceEntitlement(input: Readonly<{ actor: PrivateMediaActor; privateMediaObjectId: string; incidentId: string }>) {
    const record = await prisma.privateMediaObject.findUnique({ where: { id: input.privateMediaObjectId } });
    if (!record) throw new PrivateMediaPolicyError("PRIVATE_MEDIA_NOT_FOUND", 404, "Private media was not found.");
    const allowed = record.ownerType === PrivateMediaOwnerType.INCIDENT
      && record.ownerId === input.incidentId
      && record.purpose === PrivateMediaPurpose.INCIDENT_EVIDENCE
      && await this.canAccess(input.actor, record.ownerType, record.ownerId);
    await prisma.privateMediaAccessLog.create({ data: { privateMediaObjectId: record.id, actorUserId: input.actor.userId, action: "INCIDENT_EVIDENCE_ATTACH", outcome: allowed ? "ALLOWED" : "DENIED" } });
    if (!allowed) throw new PrivateMediaPolicyError("PRIVATE_MEDIA_FORBIDDEN", 403, "Private media is not authorized as incident evidence.");
    if (record.status !== PrivateMediaStatus.READY && record.status !== PrivateMediaStatus.RETAINED) throw new PrivateMediaPolicyError("PRIVATE_MEDIA_UNAVAILABLE", 409, "Private media is not available.");
    return { id: record.id };
  }

  private safeMetadata(record: { publicReference: string; ownerType: PrivateMediaOwnerType; purpose: PrivateMediaPurpose; status: PrivateMediaStatus; detectedMimeType: string | null; byteSize: number | null; retentionUntil: Date | null; createdAt: Date }) {
    return { publicReference: record.publicReference, ownerType: record.ownerType, purpose: record.purpose, status: record.status, mimeType: record.detectedMimeType, byteSize: record.byteSize, retentionUntil: record.retentionUntil?.toISOString() ?? null, createdAt: record.createdAt.toISOString() };
  }

  private async assertCanManageOwner(actor: PrivateMediaActor, ownerType: PrivateMediaOwnerType, ownerId: string): Promise<void> {
    if (await this.canAccess(actor, ownerType, ownerId)) return;
    throw new PrivateMediaPolicyError("PRIVATE_MEDIA_OWNER_FORBIDDEN", 403, "You cannot upload private media for this owner.");
  }

  private async canAccess(actor: PrivateMediaActor, ownerType: PrivateMediaOwnerType, ownerId: string): Promise<boolean> {
    // Claim assets are case-scoped. A broad media permission never bypasses
    // ownership or the separate claims investigation/decision authority.
    if (ownerType === PrivateMediaOwnerType.CLAIM) {
      const claim = await prisma.claim.findUnique({ where: { id: ownerId }, select: { claimantUserId: true, marketplaceOrderId: true, order: { select: { store: { select: { ownerUserId: true } }, currentDriverProfile: { select: { userId: true } } } } } });
      if (claim?.claimantUserId === actor.userId || claim?.order?.store?.ownerUserId === actor.userId || claim?.order?.currentDriverProfile?.userId === actor.userId) return true;
      if (claim?.marketplaceOrderId) {
        const storeParticipant = await prisma.marketplaceStoreOrder.findFirst({ where: { marketplaceOrderId: claim.marketplaceOrderId, store: { ownerUserId: actor.userId } }, select: { id: true } });
        if (storeParticipant) return true;
        if (actor.role === UserRole.DRIVER) {
          const driverParticipant = await prisma.marketplaceStoreOrder.findFirst({ where: { marketplaceOrderId: claim.marketplaceOrderId, deliveryBridge: { courierOrder: { currentDriverProfile: { userId: actor.userId } } } }, select: { id: true } });
          if (driverParticipant) return true;
        }
      }
      return await hasPermission({ userId: actor.userId, role: actor.role, permissionKey: PERMISSIONS.CLAIMS_INVESTIGATE })
        || await hasPermission({ userId: actor.userId, role: actor.role, permissionKey: PERMISSIONS.CLAIMS_DECIDE });
    }
    if (actor.role === UserRole.SUPER_ADMIN || await hasPermission({ userId: actor.userId, role: actor.role, permissionKey: PERMISSIONS.PRIVATE_MEDIA_READ })) return true;
    if (ownerType === PrivateMediaOwnerType.DRIVER) {
      const owner = await prisma.driverProfile.findUnique({ where: { id: ownerId }, select: { userId: true } });
      return owner?.userId === actor.userId;
    }
    if (ownerType === PrivateMediaOwnerType.VEHICLE) {
      const owner = await prisma.vehicle.findUnique({ where: { id: ownerId }, select: { driverProfile: { select: { userId: true } } } });
      return owner?.driverProfile.userId === actor.userId;
    }
    if (ownerType === PrivateMediaOwnerType.STORE) {
      const owner = await prisma.store.findUnique({ where: { id: ownerId }, select: { ownerUserId: true } });
      return owner?.ownerUserId === actor.userId;
    }
    if (ownerType === PrivateMediaOwnerType.INCIDENT) {
      // Incident evidence is restricted to the established private-media read
      // authority; no incident-local bypass is introduced.
      return await hasPermission({ userId: actor.userId, role: actor.role, permissionKey: PERMISSIONS.PRIVATE_MEDIA_READ });
    }
    return false;
  }
}
