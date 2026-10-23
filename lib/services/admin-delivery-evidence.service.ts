import { prisma } from "@/lib/db/prisma";

/**
 * Independent custody evidence exists before the final POD is signed.
 * Limit this administrative projection to validated private assets owned by
 * the selected courier order. Never expose raw storage locations.
 */
export async function listAdminDeliveryEvidence(orderId: string) {
  const records = await prisma.deliveryProofEvidence.findMany({
    where: { orderId, status: "READY", privateVisibility: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      publicReference: true,
      storageReference: true,
      contentType: true,
      byteSize: true,
      createdAt: true,
      usedAt: true,
      assignment: { select: { driverProfile: { select: { driverCode: true, displayName: true } } } },
    },
  });
  if (!records.length) return [];
  const media = await prisma.privateMediaObject.findMany({
    where: {
      ownerType: "PROOF_OF_DELIVERY",
      ownerId: orderId,
      purpose: "POD_EVIDENCE",
      status: { in: ["READY", "RETAINED"] },
      publicReference: { in: records.map(row => row.storageReference) },
    },
    select: { publicReference: true, originalFileName: true, detectedMimeType: true },
  });
  const assets = new Map(media.map(item => [item.publicReference, item]));
  return records.flatMap(row => {
    const asset = assets.get(row.storageReference);
    if (!asset || !["image/jpeg", "image/png", "image/webp"].includes(asset.detectedMimeType ?? "")) return [];
    return [{
      id: row.id,
      reference: row.publicReference,
      mediaReference: row.storageReference,
      fileName: asset.originalFileName,
      mimeType: asset.detectedMimeType!,
      byteSize: row.byteSize,
      createdAt: row.createdAt,
      usedAt: row.usedAt,
      driver: row.assignment.driverProfile.displayName ?? row.assignment.driverProfile.driverCode,
    }];
  });
}
