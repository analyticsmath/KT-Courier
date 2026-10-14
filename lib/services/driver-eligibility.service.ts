import { prisma } from "@/lib/db/prisma";
import { DriverStatus, DriverAvailability } from "@/types/db";
import {
  toDispatchDriverDto,
  type DriverEligibilityDto,
} from "@/lib/dto/assignment.dto";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/constants/assignments";
import { UserStatus, UserRole } from "@/types/db";
import { evaluateDriverEligibility } from "@/lib/dispatch/eligibility";
import { evaluateDispatchComplianceEvidence } from "@/lib/services/vehicle-compliance.service";

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
      documents: true,
      vehicles: { where: { status: "APPROVED", archivedAt: null }, include: { documents: true } },
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

  return projectDriver(driver, orderDeliveryRegionId, activeCount, new Date());
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
    include: {
      user: true,
      serviceRegions: { include: { deliveryRegion: true } },
      documents: true,
      vehicles: { where: { status: "APPROVED", archivedAt: null }, include: { documents: true } },
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

  const now = new Date();
  for (const driver of drivers) {
    const activeCount = countMap.get(driver.id) ?? 0;
    const dto = projectDriver(driver, orderDeliveryRegionId, activeCount, now);
    const eligibility = dto.eligibility;

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
      case "BUSY":
      case "UNAVAILABLE":
        result.unavailable.push(dto);
        break;
      default:
        result.notEligible.push(dto);
    }
  }

  return result;
}

// Use the same eligibility authority as the assignment mutation. A board with
// no selected order reports readiness across configured regions; order details
// still require an exact region match before offering a driver.
type EligibilityDriver = Parameters<typeof toDispatchDriverDto>[0] & {
  documents: Parameters<typeof evaluateDispatchComplianceEvidence>[0]["driverDocuments"];
  vehicles: Parameters<typeof evaluateDispatchComplianceEvidence>[0]["vehicles"];
};

function projectDriver(driver: EligibilityDriver, regionId: string | null, activeCount: number, now: Date): DriverEligibilityDto {
  const regionMatch = regionId
    ? driver.serviceRegions.some(region => region.deliveryRegionId === regionId)
    : driver.serviceRegions.length > 0;
  const userActive = driver.user.status === UserStatus.ACTIVE && driver.user.role === UserRole.DRIVER;
  const compliance = evaluateDispatchComplianceEvidence({ driverDocuments: driver.documents, vehicles: driver.vehicles, now });
  const result = evaluateDriverEligibility({ userActive, profileActive: driver.status === DriverStatus.ACTIVE, available: driver.availability === DriverAvailability.AVAILABLE, regionMatch, activeLoad: activeCount, capacity: driver.maxConcurrentAssignments, complianceEligible: compliance.eligible });
  const warnings: string[] = [];
  if (!userActive) warnings.push("Driver account must be active with the DRIVER role");
  if (driver.status !== DriverStatus.ACTIVE) warnings.push(`Driver profile is ${driver.status}`);
  if (!regionMatch) warnings.push(driver.serviceRegions.length ? "Does not cover this order's region" : "No delivery regions configured");
  if (driver.availability !== DriverAvailability.AVAILABLE) warnings.push(`Driver availability is ${driver.availability}`);
  if (result.reasons.includes("DRIVER_CAPACITY_REACHED")) warnings.push("Driver has reached assignment capacity");
  if (activeCount > 0) warnings.push(`${activeCount} active assignment(s)`);
  if (!driver.phone) warnings.push("No phone number on file");
  warnings.push(...compliance.reasons);

  const eligibility = !userActive || driver.status !== DriverStatus.ACTIVE || !compliance.eligible
    ? "NOT_ELIGIBLE"
    : result.reasons.includes("DRIVER_CAPACITY_REACHED") || driver.availability === DriverAvailability.ON_DELIVERY
      ? "BUSY"
      : driver.availability !== DriverAvailability.AVAILABLE
        ? "UNAVAILABLE"
        : !regionMatch
          ? "REGION_MISMATCH"
          : regionId && activeCount === 0 ? "RECOMMENDED" : "AVAILABLE";
  return { ...toDispatchDriverDto(driver), eligibility, regionMatch, activeAssignmentCount: activeCount, warnings };
}
