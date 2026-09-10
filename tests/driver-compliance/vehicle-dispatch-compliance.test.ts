/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { DocumentStatus, VehicleDocumentType } from "@/types/db";

const mockPrisma = vi.hoisted(() => ({
  driverProfile: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }));

import { evaluateDispatchComplianceEvidence, evaluateDriverDispatchCompliance } from "@/lib/services/vehicle-compliance.service";

const validDriverDocuments = [
  { documentType: "ID_DOCUMENT", status: DocumentStatus.APPROVED, expiresAt: null },
  { documentType: "LICENSE", status: DocumentStatus.APPROVED, expiresAt: new Date("2030-01-01T00:00:00.000Z") },
];

const validVehicleDocuments = [
  { documentType: VehicleDocumentType.REGISTRATION, status: DocumentStatus.APPROVED, expiresAt: null },
  { documentType: VehicleDocumentType.LICENCE_DISC, status: DocumentStatus.APPROVED, expiresAt: new Date("2030-01-01T00:00:00.000Z") },
  { documentType: VehicleDocumentType.INSURANCE, status: DocumentStatus.APPROVED, expiresAt: new Date("2030-01-01T00:00:00.000Z") },
];

describe("dispatch compliance", () => {
  it("requires independently approved driver evidence and a compliant approved vehicle", () => {
    expect(evaluateDispatchComplianceEvidence({ driverDocuments: validDriverDocuments, vehicles: [{ id: "vehicle-1", documents: validVehicleDocuments }], now: new Date("2029-01-01T00:00:00.000Z") })).toEqual({ eligible: true, reasons: [], approvedVehicleId: "vehicle-1" });
  });

  it("fails closed for missing vehicle evidence and expired driver licence", () => {
    const result = evaluateDispatchComplianceEvidence({
      driverDocuments: [{ ...validDriverDocuments[0] }, { ...validDriverDocuments[1], expiresAt: new Date("2024-01-01T00:00:00.000Z") }],
      vehicles: [{ id: "vehicle-1", documents: validVehicleDocuments.filter((document) => document.documentType !== VehicleDocumentType.INSURANCE) }],
      now: new Date("2029-01-01T00:00:00.000Z"),
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("DRIVER_DOCUMENT_LICENSE_INVALID");
    expect(result.reasons).toContain("NO_COMPLIANT_APPROVED_VEHICLE");
  });

  it("enforces strict compliance without legacy cutover bypass", async () => {
    mockPrisma.driverProfile.findUnique.mockResolvedValueOnce({
      id: "driver-1",
      vehicleComplianceRequiredAt: new Date(Date.now() + 86400000), // 1 day in future
      documents: [],
      vehicles: [],
    });

    const result = await evaluateDriverDispatchCompliance("driver-1");
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("DRIVER_DOCUMENT_ID_DOCUMENT_INVALID");
    expect(result.reasons).toContain("NO_COMPLIANT_APPROVED_VEHICLE");
  });

  it("permits in-flight trip completion without stranding active delivery when allowActiveTrip is requested", async () => {
    mockPrisma.driverProfile.findUnique.mockResolvedValueOnce({
      id: "driver-active",
      documents: [],
      vehicles: [],
    });
    (mockPrisma as any).order = { count: vi.fn(async () => 1) };

    const result = await evaluateDriverDispatchCompliance("driver-active", { allowActiveTrip: true });
    expect(result.eligible).toBe(true);
    expect(result.reasons).toContain("ACTIVE_TRIP_COMPLETION_PERMITTED");
  });

  it("enforces strict vehicle compliance when driver has no approved vehicles", async () => {
    mockPrisma.driverProfile.findUnique.mockResolvedValueOnce({
      id: "driver-1",
      vehicleComplianceRequiredAt: new Date(Date.now() - 86400000), // 1 day in past
      documents: validDriverDocuments,
      vehicles: [], // no approved vehicles
    });

    const result = await evaluateDriverDispatchCompliance("driver-1");
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("NO_COMPLIANT_APPROVED_VEHICLE");
  });
});

