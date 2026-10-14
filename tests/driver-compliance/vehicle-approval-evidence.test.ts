import { describe, expect, it, vi } from "vitest";
import { DocumentStatus, VehicleDocumentType, VehicleMediaPurpose } from "@/types/db";

const fake = vi.hoisted(() => ({
  vehicle: { findUnique: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: fake }));
import { reviewVehicle } from "@/lib/services/vehicle-compliance.service";

const documents = [VehicleDocumentType.REGISTRATION, VehicleDocumentType.LICENCE_DISC, VehicleDocumentType.INSURANCE]
  .map(documentType => ({ documentType, status: DocumentStatus.APPROVED, expiresAt: null }));

describe("driver fleet administrator verification", () => {
  it("rejects approval without both submitted front and side photographs", async () => {
    fake.vehicle.findUnique.mockResolvedValue({
      id: "v", publicReference: "VEH-1", documents,
      media: [{ purpose: VehicleMediaPurpose.FRONT }],
    });
    await expect(reviewVehicle({ adminUserId: "admin", vehicleId: "v", status: "APPROVED" }))
      .rejects.toMatchObject({ code: "VEHICLE_PHOTOS_INCOMPLETE", status: 409 });
    expect(fake.vehicle.update).not.toHaveBeenCalled();
  });
  it("retains independent registration, disc and insurance review requirements", async () => {
    fake.vehicle.findUnique.mockResolvedValue({
      id: "v", publicReference: "VEH-1", documents: documents.slice(0, 2),
      media: [{ purpose: VehicleMediaPurpose.FRONT }, { purpose: VehicleMediaPurpose.SIDE }],
    });
    await expect(reviewVehicle({ adminUserId: "admin", vehicleId: "v", status: "APPROVED" }))
      .rejects.toMatchObject({ code: "VEHICLE_COMPLIANCE_INCOMPLETE", status: 409 });
    expect(fake.vehicle.update).not.toHaveBeenCalled();
  });
});
