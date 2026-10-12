import { prisma } from "@/lib/db/prisma";
import { PrivateMediaService, type PrivateMediaActor } from "@/lib/private-media/private-media.service";
import { assertAcceptedCurrentDriver } from "@/lib/driver-operations/authority";
import { registerValidatedProofUploadInTx } from "@/lib/driver-operations/proof-evidence-authority";
import { DriverOperationError } from "@/lib/driver-operations/errors";

export async function uploadDeliveryProof(input: { assignmentId: string; assignmentVersion: number; driverProfileId: string; actor: PrivateMediaActor; fileName: string; mimeType: string; bytes: Uint8Array }) {
  const authority = await assertAcceptedCurrentDriver(input.assignmentId, input.driverProfileId, input.assignmentVersion);
  if (authority.driverUserId !== input.actor.userId || !["IN_TRANSIT", "DELIVERY_ATTEMPTED"].includes(authority.orderStatus)) throw new DriverOperationError("Delivery proof requires an owned active delivery.", "DRIVER_OPERATION_FORBIDDEN");
  const media = new PrivateMediaService();
  const asset = await media.upload({ actor: input.actor, ownerType: "PROOF_OF_DELIVERY", ownerId: authority.orderId, purpose: "POD_EVIDENCE", fileName: input.fileName, mimeType: input.mimeType, bytes: input.bytes });
  // Client metadata never establishes READY proof. Re-read only the object
  // created by the trusted normalizing/private-storage boundary above.
  const evidence = await prisma.$transaction(async tx => {
    const current = await tx.orderAssignment.findFirst({ where: { id: input.assignmentId, version: input.assignmentVersion, orderId: authority.orderId, driverProfileId: input.driverProfileId, status: "ACCEPTED", order: { currentDriverProfileId: input.driverProfileId, status: { in: ["IN_TRANSIT", "DELIVERY_ATTEMPTED"] } }, driverProfile: { userId: input.actor.userId, status: "ACTIVE", user: { status: "ACTIVE", role: "DRIVER" } } }, select: { id: true } });
    if (!current) throw new DriverOperationError("Assignment changed during proof upload. Refresh before trying again.", "DRIVER_OPERATION_STALE");
    const stored = await tx.privateMediaObject.findFirst({ where: { publicReference: asset.publicReference, ownerType: "PROOF_OF_DELIVERY", ownerId: authority.orderId, purpose: "POD_EVIDENCE", createdByUserId: input.actor.userId, status: "READY" }, select: { publicReference: true, storageProvider: true, detectedMimeType: true, byteSize: true } });
    if (!stored?.detectedMimeType || !stored.byteSize) throw new DriverOperationError("Private proof upload is unavailable.", "DRIVER_OPERATION_INVALID_STATE");
    return registerValidatedProofUploadInTx(tx, { orderId: authority.orderId, assignmentId: input.assignmentId, driverProfileId: input.driverProfileId, driverUserId: input.actor.userId, upload: { storageProvider: stored.storageProvider, storageReference: stored.publicReference, contentType: stored.detectedMimeType as "image/jpeg" | "image/png" | "image/webp" | "application/pdf", byteSize: stored.byteSize } });
  });
  return { ...evidence, mediaReference: asset.publicReference, mimeType: asset.mimeType, byteSize: asset.byteSize };
}
