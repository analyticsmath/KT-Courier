import { prisma } from "@/lib/db/prisma";
import { DriverStatus, DriverAvailability } from "@/types/db";
import {
  toDispatchDriverDto,
  type DriverEligibilityDto,
  type EligibilityCategory,
} from "@/lib/dto/assignment.dto";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/constants/assignments";
import { UserStatus, UserRole } from "@/types/db";

// ─── Eligibility check for a single driver ────────────────────────────────────

export async function computeDriverEligibility(
  driverProfileId: string,
  orderDeliveryRegionId: string | null
): Promise<DriverEligibilityDto | null> {
  const driver = await prisma.driverProfile.findUnique({
    where: { id: driverProfileId },
    include: {
      user: true,
      serviceRegions: { include: { deliveryRegion: true } },
    },
  });

  if (!driver) return null;

  const activeCount = await prisma.orderAssignment.count({
    where: {
      driverProfileId,
      status: { in: ACTIVE_ASSIGNMENT_STATUSES },
      OR: [
        { status: "ACCEPTED" },
        { status: "ASSIGNED", expiresAt: { gt: new Date() } },
        { status: "ASSIGNED", expiresAt: null },
      ],
    },
  });

  const base = toDispatchDriverDto(driver);
  const warnings: string[] = [];

  let regionMatch = false;
  if (orderDeliveryRegionId) {
    regionMatch = driver.serviceRegions.some(
      (sr) => sr.deliveryRegionId === orderDeliveryRegionId
    );
    if (!regionMatch) warnings.push("Region mismatch — driver does not cover this order's region");
  }

  if (!driver.phone) warnings.push("No phone number on file");

  const eligibility = computeCategory(driver.status, driver.availability, regionMatch, activeCount, driver.maxConcurrentAssignments, driver.user.status === UserStatus.ACTIVE && driver.user.role === UserRole.DRIVER);

  return {
    ...base,
    eligibility,
    regionMatch,
    activeAssignmentCount: activeCount,
    warnings,
  };
}

// ─── List eligible drivers for an order ──────────────────────────────────────

export interface EligibleDriversResult {
  recommended: DriverEligibilityDto[];
  available: DriverEligibilityDto[];
  regionMismatch: DriverEligibilityDto[];
  unavailable: DriverEligibilityDto[];
  notEligible: DriverEligibilityDto[];
}

export async function listEligibleDrivers(
  orderDeliveryRegionId: string | null
): Promise<EligibleDriversResult> {
  const drivers = await prisma.driverProfile.findMany({
    where: {
      status: DriverStatus.ACTIVE,
      user: { status: UserStatus.ACTIVE, role: UserRole.DRIVER },
    },
    include: {
      user: true,
      serviceRegions: { include: { deliveryRegion: true } },
    },
    orderBy: { displayName: "asc" },
  });

  // Batch fetch active assignment counts
  const activeAssignmentCounts = await prisma.orderAssignment.groupBy({
    by: ["driverProfileId"],
    where: {
      status: { in: ACTIVE_ASSIGNMENT_STATUSES },
      OR: [
        { status: "ACCEPTED" },
        { status: "ASSIGNED", expiresAt: { gt: new Date() } },
        { status: "ASSIGNED", expiresAt: null },
      ],
    },
    _count: { id: true },
  });

  const countMap = new Map<string, number>(
    activeAssignmentCounts.map((r) => [r.driverProfileId, r._count.id])
  );

  const result: EligibleDriversResult = {
    recommended: [],
    available: [],
    regionMismatch: [],
    unavailable: [],
    notEligible: [],
  };

  for (const driver of drivers) {
    const activeCount = countMap.get(driver.id) ?? 0;
    const base = toDispatchDriverDto(driver);
    const warnings: string[] = [];

    let regionMatch = false;
    if (orderDeliveryRegionId) {
      regionMatch = driver.serviceRegions.some(
        (sr) => sr.deliveryRegionId === orderDeliveryRegionId
      );
      if (!regionMatch) warnings.push("Does not cover this order's region");
    }

    if (!driver.phone) warnings.push("No phone number on file");
    if (activeCount > 0) warnings.push(`${activeCount} active assignment(s)`);

    const eligibility = computeCategory(driver.status, driver.availability, regionMatch, activeCount, driver.maxConcurrentAssignments, driver.user.status === UserStatus.ACTIVE && driver.user.role === UserRole.DRIVER);

    const dto: DriverEligibilityDto = {
      ...base,
      eligibility,
      regionMatch,
      activeAssignmentCount: activeCount,
      warnings,
    };

    switch (eligibility) {
      case "RECOMMENDED":
        result.recommended.push(dto);
        break;
      case "AVAILABLE":
        result.available.push(dto);
        break;
      case "REGION_MISMATCH":
        result.regionMismatch.push(dto);
        break;
      case "UNAVAILABLE":
        result.unavailable.push(dto);
        break;
      default:
        result.notEligible.push(dto);
    }
  }

  return result;
}

// ─── Internal: compute eligibility category ───────────────────────────────────

function computeCategory(
  status: DriverStatus,
  availability: DriverAvailability,
  regionMatch: boolean,
  activeCount: number,
  capacity: number,
  userActive: boolean
): EligibilityCategory {
  if (!userActive || status !== DriverStatus.ACTIVE) return "NOT_ELIGIBLE";

  if (availability === DriverAvailability.AVAILABLE && regionMatch && activeCount < capacity) {
    if (activeCount === 0) return "RECOMMENDED";
    return "AVAILABLE";
  }

  if (availability === DriverAvailability.AVAILABLE && regionMatch && activeCount === 0) {
    return "RECOMMENDED";
  }

  if (availability === DriverAvailability.AVAILABLE && regionMatch) {
    return "AVAILABLE";
  }

  if (availability === DriverAvailability.AVAILABLE && !regionMatch) {
    return "REGION_MISMATCH";
  }

  if (availability === DriverAvailability.ON_DELIVERY) {
    return "BUSY";
  }

  if (
    availability === DriverAvailability.UNAVAILABLE ||
    availability === DriverAvailability.OFFLINE
  ) {
    return "UNAVAILABLE";
  }

  return "NOT_ELIGIBLE";
}
