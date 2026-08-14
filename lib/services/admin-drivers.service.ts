import { prisma } from "@/lib/db/prisma";
import {
  toDriverSummaryDto,
  toDriverDetailDto,
  type DriverSummaryDto,
  type DriverDetailDto,
} from "@/lib/dto/driver.dto";
import { DriverStatus, DriverAvailability, DriverOnboardingStatus, UserRole, Prisma } from "@/types/db";
import { isValidStatusTransition, canDriverBeAvailable } from "../constants/drivers";
import { recordAdminActivity } from "./admin-activity.service";
import type { AdminCreateDriverInput, AdminUpdateDriverInput } from "../validation/driver";

export interface ListDriversOptions {
  status?: DriverStatus;
  availability?: DriverAvailability;
  regionId?: string;
  search?: string;
  page: number;
  pageSize: number;
}

export interface ListDriversResult {
  data: DriverSummaryDto[];
  total: number;
}

// ─── List Drivers ────────────────────────────────────────────────────────────
export async function listDrivers(opts: ListDriversOptions): Promise<ListDriversResult> {
  const { status, availability, regionId, search, page, pageSize } = opts;
  const skip = (page - 1) * pageSize;

  const where: Prisma.DriverProfileWhereInput = {};

  if (status) where.status = status;
  if (availability) where.availability = availability;
  if (regionId) {
    where.serviceRegions = {
      some: {
        deliveryRegionId: regionId,
      },
    };
  }

  if (search && search.trim() !== "") {
    const q = search.trim();
    where.OR = [
      { driverCode: { contains: q, mode: "insensitive" } },
      { displayName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      {
        user: {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  const [drivers, total] = await Promise.all([
    prisma.driverProfile.findMany({
      where,
      include: {
        user: true,
        serviceRegions: {
          include: {
            deliveryRegion: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.driverProfile.count({ where }),
  ]);

  return {
    data: drivers.map(toDriverSummaryDto),
    total,
  };
}

// ─── Get Driver Details ───────────────────────────────────────────────────────
export async function getDriverDetail(id: string): Promise<DriverDetailDto | null> {
  const driver = await prisma.driverProfile.findUnique({
    where: { id },
    include: {
      user: true,
      serviceRegions: {
        include: {
          deliveryRegion: true,
        },
      },
      documents: true,
    },
  });

  if (!driver) return null;
  return toDriverDetailDto(driver);
}

// ─── Create Driver Profile (Link to DRIVER User) ──────────────────────────────
export async function createDriverProfile(
  adminUserId: string,
  input: AdminCreateDriverInput
): Promise<DriverDetailDto> {
  // Ensure the target user has DRIVER role
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) {
    throw new Error("Target user not found.");
  }
  if (user.role !== UserRole.DRIVER) {
    throw new Error("User must have the DRIVER role to link a driver profile.");
  }

  // Check if profile already exists
  const existing = await prisma.driverProfile.findUnique({
    where: { userId: input.userId },
  });
  if (existing) {
    throw new Error("Driver profile already exists for this user.");
  }

  // Generate driver code (DRV-XXXX)
  const count = await prisma.driverProfile.count();
  const driverCode = `DRV-${1000 + count + 1}`;

  const driver = await prisma.driverProfile.create({
    data: {
      userId: input.userId,
      driverCode,
      displayName: input.displayName || user.name || "Unnamed Driver",
      phone: input.phone || user.phone,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
      status: DriverStatus.PENDING_REVIEW,
      availability: DriverAvailability.OFFLINE,
      onboardingStatus: DriverOnboardingStatus.PROFILE_INCOMPLETE,
      vehicleType: input.vehicleType,
      vehicleMake: input.vehicleMake,
      vehicleModel: input.vehicleModel,
      vehicleColor: input.vehicleColor,
      vehicleRegistration: input.vehicleRegistration,
      licenseNumber: input.licenseNumber,
      licenseExpiryDate: input.licenseExpiryDate,
      vehicleComplianceRequiredAt: new Date(),
      serviceNotes: input.serviceNotes,
      internalNotes: input.internalNotes,
    },
    include: {
      user: true,
      serviceRegions: {
        include: {
          deliveryRegion: true,
        },
      },
      documents: true,
    },
  });

  // Audit log
  await recordAdminActivity({
    actorUserId: adminUserId,
    action: "CREATE",
    entityType: "Driver",
    entityId: driver.id,
    message: `Created driver profile ${driverCode} for user ${user.email}`,
    metadata: { driverProfileId: driver.id },
  });

  return toDriverDetailDto(driver);
}

// ─── Update Driver Profile (Admin only) ──────────────────────────────────────
export async function updateDriverProfile(
  adminUserId: string,
  id: string,
  input: AdminUpdateDriverInput
): Promise<DriverDetailDto> {
  const target = await prisma.driverProfile.findUnique({ where: { id } });
  if (!target) {
    throw new Error("Driver profile not found.");
  }

  const updated = await prisma.driverProfile.update({
    where: { id },
    data: {
      displayName: input.displayName,
      phone: input.phone,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
      vehicleType: input.vehicleType,
      vehicleMake: input.vehicleMake,
      vehicleModel: input.vehicleModel,
      vehicleColor: input.vehicleColor,
      vehicleRegistration: input.vehicleRegistration,
      licenseNumber: input.licenseNumber,
      licenseExpiryDate: input.licenseExpiryDate,
      serviceNotes: input.serviceNotes,
      internalNotes: input.internalNotes,
    },
    include: {
      user: true,
      serviceRegions: {
        include: {
          deliveryRegion: true,
        },
      },
      documents: true,
    },
  });

  // Audit log
  await recordAdminActivity({
    actorUserId: adminUserId,
    action: "UPDATE",
    entityType: "Driver",
    entityId: id,
    message: `Updated profile details for driver ${target.driverCode}`,
    metadata: { driverProfileId: id, changes: Object.keys(input) },
  });

  return toDriverDetailDto(updated);
}

// ─── Transition Driver Status (Approve/Reject/Suspend/Reactivate) ────────────
export interface StatusTransitionOptions {
  status: DriverStatus;
  reason?: string;
}

export async function transitionDriverStatus(
  adminUserId: string,
  id: string,
  opts: StatusTransitionOptions
): Promise<DriverDetailDto> {
  const driver = await prisma.driverProfile.findUnique({ where: { id } });
  if (!driver) throw new Error("Driver profile not found.");

  const oldStatus = driver.status;
  const newStatus = opts.status;

  if (!isValidStatusTransition(oldStatus, newStatus)) {
    throw new Error(`Invalid status transition from ${oldStatus} to ${newStatus}.`);
  }

  // Additional rules
  const data: Prisma.DriverProfileUpdateInput = { status: newStatus };

  if (newStatus === DriverStatus.ACTIVE) {
    data.approvedAt = new Date();
    data.approvedByAdminId = adminUserId;
    data.onboardingStatus = DriverOnboardingStatus.APPROVED;
    data.active = true;
  } else if (newStatus === DriverStatus.REJECTED) {
    if (!opts.reason) throw new Error("Rejection reason is required.");
    data.rejectedAt = new Date();
    data.rejectedByAdminId = adminUserId;
    data.rejectionReason = opts.reason;
    data.onboardingStatus = DriverOnboardingStatus.REJECTED;
    data.availability = DriverAvailability.OFFLINE;
    data.active = false;
  } else if (newStatus === DriverStatus.SUSPENDED) {
    if (!opts.reason) throw new Error("Suspension reason is required.");
    data.suspendedAt = new Date();
    data.suspendedByAdminId = adminUserId;
    data.suspensionReason = opts.reason;
    data.availability = DriverAvailability.OFFLINE;
    data.active = false;
  } else if (newStatus === DriverStatus.INACTIVE) {
    data.availability = DriverAvailability.OFFLINE;
    data.active = false;
  }

  const updated = await prisma.driverProfile.update({
    where: { id },
    data,
    include: {
      user: true,
      serviceRegions: {
        include: {
          deliveryRegion: true,
        },
      },
      documents: true,
    },
  });

  // Audit log
  let actionMessage = `Driver status changed from ${oldStatus} to ${newStatus}`;
  if (opts.reason) actionMessage += ` (Reason: ${opts.reason})`;

  await recordAdminActivity({
    actorUserId: adminUserId,
    action: "STATUS_CHANGE",
    entityType: "Driver",
    entityId: id,
    message: actionMessage,
    metadata: {
      driverProfileId: id,
      oldStatus,
      newStatus,
      reason: opts.reason || null,
    },
  });

  return toDriverDetailDto(updated);
}

// ─── Force Change Driver Availability as Admin ─────────────────────────────────
export async function adminChangeAvailability(
  adminUserId: string,
  id: string,
  availability: DriverAvailability
): Promise<DriverDetailDto> {
  const driver = await prisma.driverProfile.findUnique({ where: { id } });
  if (!driver) throw new Error("Driver profile not found.");

  if (availability === DriverAvailability.AVAILABLE && !canDriverBeAvailable(driver.status)) {
    throw new Error("Driver must be ACTIVE to be set to AVAILABLE.");
  }

  const oldAvailability = driver.availability;

  const updated = await prisma.driverProfile.update({
    where: { id },
    data: { availability },
    include: {
      user: true,
      serviceRegions: {
        include: {
          deliveryRegion: true,
        },
      },
      documents: true,
    },
  });

  await recordAdminActivity({
    actorUserId: adminUserId,
    action: "UPDATE",
    entityType: "Driver",
    entityId: id,
    message: `Driver availability forced by admin from ${oldAvailability} to ${availability}`,
    metadata: {
      driverProfileId: id,
      oldAvailability,
      newAvailability: availability,
    },
  });

  return toDriverDetailDto(updated);
}

// ─── Assign Service Regions ──────────────────────────────────────────────────
export async function assignDriverRegions(
  adminUserId: string,
  id: string,
  regionIds: string[],
  primaryRegionId?: string | null
): Promise<DriverDetailDto> {
  const driver = await prisma.driverProfile.findUnique({ where: { id } });
  if (!driver) throw new Error("Driver profile not found.");

  // Verify region IDs exist
  const count = await prisma.deliveryRegion.count({
    where: { id: { in: regionIds } },
  });
  if (count !== regionIds.length) {
    throw new Error("One or more region IDs are invalid.");
  }

  // Delete all existing service regions for this driver
  await prisma.driverServiceRegion.deleteMany({
    where: { driverProfileId: id },
  });

  // Create new mappings
  if (regionIds.length > 0) {
    const data = regionIds.map((rId) => ({
      driverProfileId: id,
      deliveryRegionId: rId,
      isPrimary: rId === primaryRegionId,
    }));

    await prisma.driverServiceRegion.createMany({ data });
  }

  const updated = await prisma.driverProfile.findUniqueOrThrow({
    where: { id },
    include: {
      user: true,
      serviceRegions: {
        include: {
          deliveryRegion: true,
        },
      },
      documents: true,
    },
  });

  await recordAdminActivity({
    actorUserId: adminUserId,
    action: "UPDATE",
    entityType: "Driver",
    entityId: id,
    message: `Driver coverage regions updated. Assigned ${regionIds.length} regions.`,
    metadata: {
      driverProfileId: id,
      regions: regionIds,
      primaryRegionId: primaryRegionId || null,
    },
  });

  return toDriverDetailDto(updated);
}

// ─── List Unlinked Driver Users ──────────────────────────────────────────────
export async function listUnlinkedDriverUsers(): Promise<{ id: string; email: string; name: string | null }[]> {
  return prisma.user.findMany({
    where: {
      role: UserRole.DRIVER,
      driverProfile: null,
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
    orderBy: { email: "asc" },
  });
}
