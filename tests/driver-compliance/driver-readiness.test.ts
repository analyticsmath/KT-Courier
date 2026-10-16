import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  DocumentStatus,
  DocumentType,
  DriverAvailability,
  DriverStatus,
  UserRole,
  UserStatus,
  VehicleComplianceStatus,
  VehicleDocumentType,
} from "@/types/db";

const mockPrisma = vi.hoisted(() => ({
  driverProfile: {
    findUnique: vi.fn(),
  },
  orderAssignment: {
    count: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }));

import { evaluateDriverReadiness } from "@/lib/services/driver-readiness.service";

describe("evaluateDriverReadiness", () => {
  const now = new Date("2026-10-16T12:00:00.000Z");
  const futureDate = new Date("2027-01-01T00:00:00.000Z");
  const pastDate = new Date("2025-01-01T00:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null if driver does not exist", async () => {
    mockPrisma.driverProfile.findUnique.mockResolvedValueOnce(null);
    const result = await evaluateDriverReadiness("non-existent-id", { now });
    expect(result).toBeNull();
  });

  it("identifies blocked state when user account is inactive or not DRIVER role", async () => {
    mockPrisma.driverProfile.findUnique.mockResolvedValueOnce({
      id: "drv-1",
      driverCode: "DRV-1",
      displayName: "John Doe",
      status: DriverStatus.ACTIVE,
      availability: DriverAvailability.AVAILABLE,
      maxConcurrentAssignments: 1,
      user: {
        id: "usr-1",
        status: UserStatus.SUSPENDED,
        role: UserRole.DRIVER,
        email: "john@example.com",
        phone: "+27821234567",
      },
      documents: [],
      vehicles: [],
      serviceRegions: [],
    });
    mockPrisma.orderAssignment.count.mockResolvedValueOnce(0);

    const result = await evaluateDriverReadiness("drv-1", { now });
    expect(result).not.toBeNull();
    expect(result?.isDispatchReady).toBe(false);
    expect(result?.canBeAvailable).toBe(false);
    expect(result?.reasons).toContain("DRIVER_USER_INACTIVE");
    const accountCheck = result?.checklist.find((c) => c.key === "USER_ACCOUNT");
    expect(accountCheck?.status).toBe("BLOCKED");
  });

  it("identifies real production blockers: missing docs, no vehicle, no regions, offline", async () => {
    // Simulating one of the 25 real production profiles: pending review, no approved docs, no vehicle, no regions
    mockPrisma.driverProfile.findUnique.mockResolvedValueOnce({
      id: "drv-prod-1",
      driverCode: "DRV-PROD-1",
      displayName: "Real Driver Profile",
      status: DriverStatus.PENDING_REVIEW,
      availability: DriverAvailability.OFFLINE,
      maxConcurrentAssignments: 1,
      user: {
        id: "usr-prod-1",
        status: UserStatus.ACTIVE,
        role: UserRole.DRIVER,
        email: "driver@ktcouriers.co.za",
        phone: "+27829990001",
      },
      documents: [],
      vehicles: [],
      serviceRegions: [],
    });
    mockPrisma.orderAssignment.count.mockResolvedValueOnce(0);

    const result = await evaluateDriverReadiness("drv-prod-1", { now });
    expect(result).not.toBeNull();
    expect(result?.isDispatchReady).toBe(false);
    expect(result?.canBeAvailable).toBe(false);

    // Exact blocker reasons present
    expect(result?.reasons).toContain("DRIVER_PROFILE_PENDING_REVIEW");
    expect(result?.reasons).toContain("DRIVER_DOCUMENT_ID_DOCUMENT_INVALID");
    expect(result?.reasons).toContain("DRIVER_DOCUMENT_LICENSE_INVALID");
    expect(result?.reasons).toContain("DRIVER_NO_SERVICE_REGIONS");
    expect(result?.reasons).toContain("NO_COMPLIANT_APPROVED_VEHICLE");
    expect(result?.reasons).toContain("DRIVER_UNAVAILABLE");

    // Actionable blocker list
    const blockerKeys = result?.blockers.map((b) => b.key);
    expect(blockerKeys).toContain("PROFILE_PENDING_REVIEW");
    expect(blockerKeys).toContain("ID_DOCUMENT_MISSING");
    expect(blockerKeys).toContain("LICENSE_MISSING");
    expect(blockerKeys).toContain("NO_SERVICE_REGIONS");
    expect(blockerKeys).toContain("NO_REGISTERED_VEHICLE");

    // Fix links are actionable
    const idBlocker = result?.blockers.find((b) => b.key === "ID_DOCUMENT_MISSING");
    expect(idBlocker?.actionHref).toBe("/driver/onboarding?tab=documents");

    const regionBlocker = result?.blockers.find((b) => b.key === "NO_SERVICE_REGIONS");
    expect(regionBlocker?.actionHref).toBe("/driver/onboarding?tab=regions");
  });

  it("identifies expired licence blocker and unapproved vehicle", async () => {
    mockPrisma.driverProfile.findUnique.mockResolvedValueOnce({
      id: "drv-2",
      driverCode: "DRV-2",
      displayName: "Jane Smith",
      status: DriverStatus.ACTIVE,
      availability: DriverAvailability.AVAILABLE,
      maxConcurrentAssignments: 1,
      user: {
        id: "usr-2",
        status: UserStatus.ACTIVE,
        role: UserRole.DRIVER,
        email: "jane@example.com",
        phone: "+27821234568",
      },
      documents: [
        {
          id: "doc-1",
          documentType: DocumentType.ID_DOCUMENT,
          status: DocumentStatus.APPROVED,
          expiresAt: null,
          rejectionReason: null,
        },
        {
          id: "doc-2",
          documentType: DocumentType.LICENSE,
          status: DocumentStatus.APPROVED,
          expiresAt: pastDate, // EXPIRED!
          rejectionReason: null,
        },
      ],
      vehicles: [
        {
          id: "veh-1",
          status: VehicleComplianceStatus.PENDING_REVIEW,
          archivedAt: null,
          documents: [],
          media: [],
        },
      ],
      serviceRegions: [
        {
          deliveryRegionId: "reg-1",
          isPrimary: true,
          deliveryRegion: { id: "reg-1", name: "Johannesburg North" },
        },
      ],
    });
    mockPrisma.orderAssignment.count.mockResolvedValueOnce(0);

    const result = await evaluateDriverReadiness("drv-2", { now });
    expect(result?.isDispatchReady).toBe(false);
    expect(result?.reasons).toContain("DRIVER_DOCUMENT_LICENSE_EXPIRED");
    expect(result?.reasons).toContain("NO_COMPLIANT_APPROVED_VEHICLE");

    const licenseCheck = result?.checklist.find((c) => c.key === "DRIVING_LICENCE");
    expect(licenseCheck?.status).toBe("EXPIRED");

    const vehicleCheck = result?.checklist.find((c) => c.key === "COMPLIANT_VEHICLE");
    expect(vehicleCheck?.status).toBe("PENDING_REVIEW");
  });

  it("marks a fully compliant driver as dispatch ready when online and below capacity", async () => {
    mockPrisma.driverProfile.findUnique.mockResolvedValueOnce({
      id: "drv-ready",
      driverCode: "DRV-READY-1",
      displayName: "Sipho Khumalo",
      status: DriverStatus.ACTIVE,
      availability: DriverAvailability.AVAILABLE,
      maxConcurrentAssignments: 2,
      user: {
        id: "usr-ready",
        status: UserStatus.ACTIVE,
        role: UserRole.DRIVER,
        email: "sipho@ktcouriers.co.za",
        phone: "+27821234569",
      },
      documents: [
        {
          id: "doc-id",
          documentType: DocumentType.ID_DOCUMENT,
          status: DocumentStatus.APPROVED,
          expiresAt: null,
          rejectionReason: null,
        },
        {
          id: "doc-lic",
          documentType: DocumentType.LICENSE,
          status: DocumentStatus.APPROVED,
          expiresAt: futureDate,
          rejectionReason: null,
        },
      ],
      vehicles: [
        {
          id: "veh-approved-1",
          make: "Toyota",
          model: "Corolla Quest",
          registrationNumber: "ND123456",
          status: VehicleComplianceStatus.APPROVED,
          archivedAt: null,
          documents: [
            {
              documentType: VehicleDocumentType.REGISTRATION,
              status: DocumentStatus.APPROVED,
              expiresAt: null,
            },
            {
              documentType: VehicleDocumentType.LICENCE_DISC,
              status: DocumentStatus.APPROVED,
              expiresAt: futureDate,
            },
            {
              documentType: VehicleDocumentType.INSURANCE,
              status: DocumentStatus.APPROVED,
              expiresAt: futureDate,
            },
          ],
          media: [
            { purpose: "FRONT" },
            { purpose: "SIDE" },
          ],
        },
      ],
      serviceRegions: [
        {
          deliveryRegionId: "reg-dbn",
          isPrimary: true,
          deliveryRegion: { id: "reg-dbn", name: "Durban Metro" },
        },
      ],
    });
    mockPrisma.orderAssignment.count.mockResolvedValueOnce(0);

    const result = await evaluateDriverReadiness("drv-ready", { now });
    expect(result).not.toBeNull();
    expect(result?.isDispatchReady).toBe(true);
    expect(result?.canBeAvailable).toBe(true);
    expect(result?.approvedVehicleId).toBe("veh-approved-1");
    expect(result?.reasons).toHaveLength(0);
    expect(result?.blockers).toHaveLength(0);

    // All checklist items completed
    expect(result?.checklist.every((item) => item.status === "COMPLETED")).toBe(true);
  });

  it("blocks dispatch readiness if active assignments reach maximum concurrent capacity", async () => {
    mockPrisma.driverProfile.findUnique.mockResolvedValueOnce({
      id: "drv-busy",
      driverCode: "DRV-BUSY-1",
      displayName: "Busy Driver",
      status: DriverStatus.ACTIVE,
      availability: DriverAvailability.AVAILABLE,
      maxConcurrentAssignments: 1,
      user: {
        id: "usr-busy",
        status: UserStatus.ACTIVE,
        role: UserRole.DRIVER,
        email: "busy@ktcouriers.co.za",
        phone: "+27821234570",
      },
      documents: [
        {
          id: "doc-id",
          documentType: DocumentType.ID_DOCUMENT,
          status: DocumentStatus.APPROVED,
          expiresAt: null,
        },
        {
          id: "doc-lic",
          documentType: DocumentType.LICENSE,
          status: DocumentStatus.APPROVED,
          expiresAt: futureDate,
        },
      ],
      vehicles: [
        {
          id: "veh-1",
          make: "Nissan",
          model: "NP200",
          registrationNumber: "CA999888",
          status: VehicleComplianceStatus.APPROVED,
          archivedAt: null,
          documents: [
            { documentType: VehicleDocumentType.REGISTRATION, status: DocumentStatus.APPROVED, expiresAt: null },
            { documentType: VehicleDocumentType.LICENCE_DISC, status: DocumentStatus.APPROVED, expiresAt: futureDate },
            { documentType: VehicleDocumentType.INSURANCE, status: DocumentStatus.APPROVED, expiresAt: futureDate },
          ],
          media: [],
        },
      ],
      serviceRegions: [
        { deliveryRegionId: "reg-cpt", isPrimary: true, deliveryRegion: { id: "reg-cpt", name: "Cape Town" } },
      ],
    });
    // Already 1 active assignment, max is 1
    mockPrisma.orderAssignment.count.mockResolvedValueOnce(1);

    const result = await evaluateDriverReadiness("drv-busy", { now });
    expect(result?.isDispatchReady).toBe(false);
    expect(result?.reasons).toContain("DRIVER_CAPACITY_REACHED");
    const capacityCheck = result?.checklist.find((c) => c.key === "ASSIGNMENT_CAPACITY");
    expect(capacityCheck?.status).toBe("BLOCKED");
  });
});
