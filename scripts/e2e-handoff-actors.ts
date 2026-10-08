import { prisma } from "@/lib/db/prisma";
import { requireDisposableDriverSettlementDatabase } from "./disposable-driver-settlement-guard";
import sharp from "sharp";
import { PrivateMediaService } from "@/lib/private-media/private-media.service";
import { LocalPrivateMediaStorageAdapter } from "@/lib/private-media/private-media-storage";

/** Independent synthetic eligibility input only. Assignments, custody and
 * courier/order/payment outcomes must be created by canonical commands. These
 * document placeholders are never served or described as physical evidence. */
export async function createDisposableHandoffActors(passwordHash: string, regionId: string) {
  requireDisposableDriverSettlementDatabase();
  const identity = await prisma.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database() AS database, current_user AS role`;
  if (identity[0]?.database !== "kt_phase75_e2e" || identity[0]?.role !== "kt_phase75_e2e") throw new Error("Handoff input requires the named disposable database.");
  const reviewer = await prisma.user.findUniqueOrThrow({ where: { email: "superadmin@ktcouriers.local" } });
  const storage = new PrivateMediaService(new LocalPrivateMediaStorageAdapter("/tmp/kt-couriers-e2e-eligibility-input"));
  const syntheticRaster = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#ababab" } }).png().toBuffer();
  for (const suffix of ["store-handoff-1440", "store-handoff-390", "pg-store-handoff", "driver-delivery-1440", "driver-delivery-390", "driver-delivery-pg", "cod-1440", "cod-390", "cod-shortage", "cod-zero", "cod-failure", "foreign"]) {
    const user = await prisma.user.create({ data: { email: `e2e-handoff-driver-${suffix}@ktcouriers.local`, name: "Disposable custody driver", role: "DRIVER", status: "ACTIVE", emailVerifiedAt: new Date(), passwordHash } });
    const driver = await prisma.driverProfile.create({ data: { userId: user.id, driverCode: `E2E-CUSTODY-${suffix}`, status: "ACTIVE", active: true, onboardingStatus: "APPROVED", availability: "AVAILABLE", maxConcurrentAssignments: 1, serviceRegions: { create: { deliveryRegionId: regionId, isPrimary: true } } } });
    await prisma.driverDocument.createMany({ data: ["ID_DOCUMENT", "LICENSE"].map(documentType => ({ driverProfileId: driver.id, documentType: documentType as "ID_DOCUMENT" | "LICENSE", status: "APPROVED", reviewedByAdminId: reviewer.id, reviewedAt: new Date() })) });
    const vehicle = await prisma.vehicle.create({ data: { publicReference: `E2E-CUSTODY-VEHICLE-${suffix}`, driverProfileId: driver.id, make: "Disposable", model: "Synthetic eligibility input", registrationNumber: `E2E-${suffix}`, vehicleType: "CAR", status: "APPROVED", approvedByUserId: reviewer.id, approvedAt: new Date() } });
    for (const [documentType, purpose] of [["REGISTRATION", "VEHICLE_REGISTRATION"], ["LICENCE_DISC", "VEHICLE_LICENCE_DISC"], ["INSURANCE", "VEHICLE_INSURANCE"]] as const) {
      const uploaded = await storage.upload({ actor: { userId: user.id, role: "DRIVER" }, ownerType: "VEHICLE", ownerId: vehicle.id, purpose, fileName: "synthetic-eligibility-input.png", mimeType: "image/png", bytes: syntheticRaster });
      const media = await prisma.privateMediaObject.findUniqueOrThrow({ where: { publicReference: uploaded!.publicReference } });
      await prisma.privateMediaObject.update({ where: { id: media.id }, data: { reviewedByUserId: reviewer.id, reviewedAt: new Date(), metadata: { ...(media.metadata as object), fixture: "synthetic eligibility input, not a physical document; seed-container storage is ephemeral" } } });
      await prisma.vehicleDocument.create({ data: { vehicleId: vehicle.id, documentType, status: "APPROVED", privateMediaObjectId: media.id, reviewedByUserId: reviewer.id, reviewedAt: new Date() } });
    }
  }
}
