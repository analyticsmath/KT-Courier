import { prisma } from "@/lib/db/prisma";
import { requireDisposableDriverSettlementDatabase } from "./disposable-driver-settlement-guard";

/** Independent synthetic eligibility input only. Assignments, custody and
 * courier/order/payment outcomes must be created by canonical commands. These
 * document placeholders are never served or described as physical evidence. */
export async function createDisposableHandoffActors(passwordHash: string, regionId: string) {
  requireDisposableDriverSettlementDatabase();
  const identity = await prisma.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database() AS database, current_user AS role`;
  if (identity[0]?.database !== "kt_phase75_e2e" || identity[0]?.role !== "kt_phase75_e2e") throw new Error("Handoff input requires the named disposable database.");
  const reviewer = await prisma.user.findUniqueOrThrow({ where: { email: "superadmin@ktcouriers.local" } });
  for (const suffix of ["store-handoff-1440", "store-handoff-390", "pg-store-handoff", "foreign"]) {
    const user = await prisma.user.create({ data: { email: `e2e-handoff-driver-${suffix}@ktcouriers.local`, name: "Disposable custody driver", role: "DRIVER", status: "ACTIVE", emailVerifiedAt: new Date(), passwordHash } });
    const driver = await prisma.driverProfile.create({ data: { userId: user.id, driverCode: `E2E-CUSTODY-${suffix}`, status: "ACTIVE", active: true, onboardingStatus: "APPROVED", availability: "AVAILABLE", maxConcurrentAssignments: 1, serviceRegions: { create: { deliveryRegionId: regionId, isPrimary: true } } } });
    await prisma.driverDocument.createMany({ data: ["ID_DOCUMENT", "LICENSE"].map(documentType => ({ driverProfileId: driver.id, documentType: documentType as "ID_DOCUMENT" | "LICENSE", status: "APPROVED", reviewedByAdminId: reviewer.id, reviewedAt: new Date() })) });
    const vehicle = await prisma.vehicle.create({ data: { publicReference: `E2E-CUSTODY-VEHICLE-${suffix}`, driverProfileId: driver.id, make: "Disposable", model: "Synthetic eligibility input", registrationNumber: `E2E-${suffix}`, vehicleType: "CAR", status: "APPROVED", approvedByUserId: reviewer.id, approvedAt: new Date() } });
    for (const [documentType, purpose] of [["REGISTRATION", "VEHICLE_REGISTRATION"], ["LICENCE_DISC", "VEHICLE_LICENCE_DISC"], ["INSURANCE", "VEHICLE_INSURANCE"]] as const) {
      const media = await prisma.privateMediaObject.create({ data: { publicReference: `E2E-CUSTODY-${suffix}-${documentType}`, ownerType: "VEHICLE", ownerId: vehicle.id, purpose, status: "READY", storageProvider: "DISPOSABLE_ELIGIBILITY_INPUT", storageKey: `disposable-only/${suffix}/${documentType}`, originalFileName: "synthetic-input.png", declaredMimeType: "image/png", createdByUserId: user.id, reviewedByUserId: reviewer.id, reviewedAt: new Date(), metadata: { fixture: "eligibility input; no physical document or uploaded media proof" } } });
      await prisma.vehicleDocument.create({ data: { vehicleId: vehicle.id, documentType, status: "APPROVED", privateMediaObjectId: media.id, reviewedByUserId: reviewer.id, reviewedAt: new Date() } });
    }
  }
}
