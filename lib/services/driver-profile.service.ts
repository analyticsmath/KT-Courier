import { prisma } from "@/lib/db/prisma";
import { toDriverSelfDto, type DriverSelfDto } from "@/lib/dto/driver.dto";
import { DriverAvailability, DriverOnboardingStatus, DocumentStatus, DocumentType, PrivateMediaOwnerType } from "@/types/db";
import type { DriverSelfUpdateInput, DriverOnboardingInput } from "../validation/driver";
import { canSelectAvailability } from "@/lib/driver-operations/availability-policy";

// ─── Get own driver profile ──────────────────────────────────────────────────
export async function getDriverProfileByUserId(userId: string): Promise<DriverSelfDto | null> {
  const driver = await prisma.driverProfile.findUnique({
    where: { userId },
    include: {
      user: true,
      serviceRegions: {
        include: {
          deliveryRegion: true,
        },
      },
    },
  });

  if (!driver) return null;
  return toDriverSelfDto(driver);
}

// ─── Update own profile ──────────────────────────────────────────────────────
export async function updateOwnDriverProfile(
  userId: string,
  input: DriverSelfUpdateInput
): Promise<DriverSelfDto> {
  const driver = await prisma.driverProfile.findUnique({ where: { userId } });
  if (!driver) throw new Error("Driver profile not found.");

  // Update DriverProfile display name and phone
  const updated = await prisma.driverProfile.update({
    where: { userId },
    data: {
      displayName: input.displayName,
      phone: input.phone,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
    },
    include: {
      user: true,
      serviceRegions: {
        include: {
          deliveryRegion: true,
        },
      },
    },
  });

  // Keep user name & phone in sync if provided
  if (input.displayName || input.phone) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.displayName !== undefined && { name: input.displayName }),
        ...(input.phone !== undefined && { phone: input.phone }),
      },
    });
  }

  return toDriverSelfDto(updated);
}

// ─── Update own availability ──────────────────────────────────────────────────
export async function updateOwnAvailability(
  userId: string,
  availability: DriverAvailability,
  expectedRevision: number
): Promise<DriverSelfDto & { availabilityRevision: number }> {
  const driver = await prisma.driverProfile.findUnique({ where: { userId }, include: { user: { select: { status: true, role: true } } } });
  if (!driver) throw new Error("Driver profile not found.");

  // Active drivers can set AVAILABLE/UNAVAILABLE/OFFLINE. Non-active cannot.
  if (driver.user.status !== "ACTIVE" || !canSelectAvailability(driver.status, availability)) {
    throw new Error("Only active drivers may select Available, Unavailable, or Offline.");
  }

  const revision = (driver as typeof driver & { availabilityRevision?: number }).availabilityRevision ?? 1;
  if (expectedRevision !== revision) {
    throw new Error("DRIVER_AVAILABILITY_STALE: Availability was changed elsewhere. Refresh and try again.");
  }

  if (driver.availability === availability) {
    const full = await prisma.driverProfile.findUniqueOrThrow({ where: { userId }, include: { user: true, serviceRegions: { include: { deliveryRegion: true } } } });
    return { ...toDriverSelfDto(full), availabilityRevision: revision };
  }

  const result = await prisma.driverProfile.updateMany({
    where: { userId, availabilityRevision: expectedRevision },
    data: { availability, availabilityUpdatedAt: new Date(), availabilityRevision: { increment: 1 } },
  });
  if (result.count !== 1) throw new Error("DRIVER_AVAILABILITY_STALE: Availability was changed elsewhere. Refresh and try again.");

  const updated = await prisma.driverProfile.findUniqueOrThrow({
    where: { userId },
    include: {
      user: true,
      serviceRegions: {
        include: {
          deliveryRegion: true,
        },
      },
    },
  });

  return { ...toDriverSelfDto(updated), availabilityRevision: (updated as typeof updated & { availabilityRevision?: number }).availabilityRevision ?? revision + 1 };
}

// ─── Complete Driver Onboarding ───────────────────────────────────────────────
export async function completeDriverOnboarding(
  userId: string,
  input: DriverOnboardingInput
): Promise<DriverSelfDto> {
  const driver = await prisma.driverProfile.findUnique({ where: { userId } });
  if (!driver) throw new Error("Driver profile not found.");

  const identitySnapshot = {
    idNumber: input.idNumber,
    dateOfBirth: input.dateOfBirth.toISOString(),
    residentialAddress: input.residentialAddress,
    completedAt: new Date().toISOString(),
  };

  const updated = await prisma.driverProfile.update({
    where: { userId },
    data: {
      displayName: input.displayName || driver.displayName,
      phone: input.phone,
      licenseNumber: input.licenseNumber,
      licenseExpiryDate: input.licenseExpiryDate,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
      internalNotes: JSON.stringify(identitySnapshot),
      onboardingStatus: DriverOnboardingStatus.PENDING_REVIEW,
      vehicleComplianceRequiredAt: driver.vehicleComplianceRequiredAt ?? new Date(),
    },
    include: {
      user: true,
      serviceRegions: {
        include: {
          deliveryRegion: true,
        },
      },
    },
  });

  // Keep user sync
  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.displayName ? { name: input.displayName } : {}),
      phone: input.phone,
    },
  });

  return toDriverSelfDto(updated);
}

// ─── Attach Own Driver Document ───────────────────────────────────────────────
export async function attachOwnDriverDocument(input: {
  driverUserId: string;
  documentType: DocumentType;
  privateMediaReference: string;
  expiresAt?: Date | null;
}) {
  const driver = await prisma.driverProfile.findUnique({
    where: { userId: input.driverUserId },
    select: { id: true },
  });
  if (!driver) throw new Error("Driver profile not found.");

  const media = await prisma.privateMediaObject.findUnique({
    where: { publicReference: input.privateMediaReference },
  });
  if (
    !media ||
    media.ownerType !== PrivateMediaOwnerType.DRIVER ||
    media.ownerId !== driver.id ||
    media.status !== "READY"
  ) {
    throw new Error("The uploaded private media cannot be used for this driver document.");
  }

  return prisma.$transaction(async (tx) => {
    const prior = await tx.driverDocument.findFirst({
      where: {
        driverProfileId: driver.id,
        documentType: input.documentType,
        status: { in: [DocumentStatus.PENDING, DocumentStatus.SUBMITTED, DocumentStatus.APPROVED] },
      },
    });

    if (prior) {
      await tx.driverDocument.update({
        where: { id: prior.id },
        data: {
          status: DocumentStatus.REJECTED,
          rejectionReason: "SUPERSEDED_BY_NEW_UPLOAD",
        },
      });
    }

    return tx.driverDocument.create({
      data: {
        driverProfileId: driver.id,
        documentType: input.documentType,
        privateMediaObjectId: media.id,
        fileName: media.originalFileName,
        expiresAt: input.expiresAt ?? null,
        status: DocumentStatus.SUBMITTED,
      },
      include: {
        privateMediaObject: {
          select: {
            publicReference: true,
            originalFileName: true,
            detectedMimeType: true,
          },
        },
      },
    });
  });
}

// ─── List Own Driver Documents ────────────────────────────────────────────────
export async function listOwnDriverDocuments(driverUserId: string) {
  const driver = await prisma.driverProfile.findUnique({
    where: { userId: driverUserId },
    select: { id: true },
  });
  if (!driver) throw new Error("Driver profile not found.");

  return prisma.driverDocument.findMany({
    where: { driverProfileId: driver.id },
    orderBy: { createdAt: "desc" },
    include: {
      privateMediaObject: {
        select: {
          publicReference: true,
          originalFileName: true,
          detectedMimeType: true,
        },
      },
    },
  });
}
