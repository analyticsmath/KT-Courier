import { describe, expect, it, vi, beforeEach } from "vitest";
import { DocumentStatus, VehicleDocumentType } from "@/types/db";

const mockPrisma = vi.hoisted(() => ({
  driverProfile: {
    findUnique: vi.fn(),
  },
  order: {
    count: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }));

import {
  evaluateDispatchComplianceEvidence,
  evaluateDriverDispatchCompliance,
} from "@/lib/services/vehicle-compliance.service";

describe("Phase 1 Acceptance: Model B Dispatch Eligibility Decoupling & Truthfulness", () => {
  const futureDate = new Date("2030-01-01T00:00:00.000Z");
  const pastDate = new Date("2020-01-01T00:00:00.000Z");
  const evalDate = new Date("2026-09-13T12:00:00.000Z");

  const validDriverDocs = [
    { documentType: "ID_DOCUMENT", status: DocumentStatus.APPROVED, expiresAt: null },
    { documentType: "LICENSE", status: DocumentStatus.APPROVED, expiresAt: futureDate },
  ];

  const validVehicleDocs = [
    { documentType: VehicleDocumentType.REGISTRATION, status: DocumentStatus.APPROVED, expiresAt: null },
    { documentType: VehicleDocumentType.LICENCE_DISC, status: DocumentStatus.APPROVED, expiresAt: futureDate },
    { documentType: VehicleDocumentType.INSURANCE, status: DocumentStatus.APPROVED, expiresAt: futureDate },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Model B: Approved driver profile without any registered vehicle is NOT dispatch eligible", async () => {
    mockPrisma.driverProfile.findUnique.mockResolvedValueOnce({
      id: "drv-prof-1",
      driverCode: "DRV-101",
      displayName: "Thabo M",
      status: "APPROVED", // Personal profile is approved!
      documents: validDriverDocs,
      vehicles: [], // Zero vehicles
    });

    const result = await evaluateDriverDispatchCompliance("drv-prof-1", { now: evalDate });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("NO_COMPLIANT_APPROVED_VEHICLE");
    expect(result.approvedVehicleId).toBeNull();
  });

  it("Model B: Approved driver with vehicle in PENDING status is NOT dispatch eligible", async () => {
    mockPrisma.driverProfile.findUnique.mockResolvedValueOnce({
      id: "drv-prof-2",
      status: "APPROVED",
      documents: validDriverDocs,
      vehicles: [], // findUnique filters where status: APPROVED, so PENDING vehicle won't appear
    });

    const result = await evaluateDriverDispatchCompliance("drv-prof-2", { now: evalDate });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("NO_COMPLIANT_APPROVED_VEHICLE");
  });

  it("Model B: Approved driver with approved vehicle but expired insurance is NOT dispatch eligible", () => {
    const expiredVehicleDocs = [
      { documentType: VehicleDocumentType.REGISTRATION, status: DocumentStatus.APPROVED, expiresAt: null },
      { documentType: VehicleDocumentType.LICENCE_DISC, status: DocumentStatus.APPROVED, expiresAt: futureDate },
      { documentType: VehicleDocumentType.INSURANCE, status: DocumentStatus.APPROVED, expiresAt: pastDate }, // Expired!
    ];

    const result = evaluateDispatchComplianceEvidence({
      driverDocuments: validDriverDocs,
      vehicles: [{ id: "veh-1", documents: expiredVehicleDocs }],
      now: evalDate,
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("NO_COMPLIANT_APPROVED_VEHICLE");
    expect(result.approvedVehicleId).toBeNull();
  });

  it("Model B: Driver with compliant vehicle but expired driver licence is NOT dispatch eligible", () => {
    const expiredLicenceDocs = [
      { documentType: "ID_DOCUMENT", status: DocumentStatus.APPROVED, expiresAt: null },
      { documentType: "LICENSE", status: DocumentStatus.APPROVED, expiresAt: pastDate }, // Expired!
    ];

    const result = evaluateDispatchComplianceEvidence({
      driverDocuments: expiredLicenceDocs,
      vehicles: [{ id: "veh-1", documents: validVehicleDocs }],
      now: evalDate,
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("DRIVER_DOCUMENT_LICENSE_INVALID");
  });

  it("Model B: Fully compliant driver and vehicle yields eligible: true with approvedVehicleId", () => {
    const result = evaluateDispatchComplianceEvidence({
      driverDocuments: validDriverDocs,
      vehicles: [{ id: "veh-compliant-99", documents: validVehicleDocs }],
      now: evalDate,
    });

    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.approvedVehicleId).toBe("veh-compliant-99");
  });
});
