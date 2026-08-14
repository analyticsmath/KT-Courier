import { describe, expect, it } from "vitest";
import { DocumentStatus, VehicleDocumentType } from "@/types/db";
import { evaluateDispatchComplianceEvidence } from "@/lib/services/vehicle-compliance.service";

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
});
