import { beforeEach, describe, expect, it, vi } from "vitest";
import { VehicleType } from "@/types/db";

const mock = vi.hoisted(() => ({
  driverProfile: { findUnique: vi.fn() },
  vehicle: { findFirst: vi.fn(), create: vi.fn() },
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: mock }));

import { createOwnVehicle, VehicleComplianceError } from "@/lib/services/vehicle-compliance.service";

const input = {
  make: "Toyota", model: "Hilux", year: 2024, colour: "White",
  registrationNumber: "CA 123-456", vehicleType: VehicleType.VAN,
  vehicleSubtype: "BAKKIE" as const, capacityKg: "750.000",
};
const stored = {
  id: "vehicle-one", publicReference: "VEH-vehicle-one",
  driverProfileId: "driver-one", make: "Toyota", model: "Hilux",
  year: 2024, colour: "White", registrationNumber: "CA123-456",
  vehicleType: VehicleType.VAN, vehicleSubtype: "BAKKIE",
  capacityKg: { toString: () => "750" }, status: "PENDING_REVIEW",
  createdAt: new Date("2026-10-14T00:00:00.000Z"),
};

beforeEach(() => {
  vi.resetAllMocks();
  mock.driverProfile.findUnique.mockResolvedValue({ id: "driver-one" });
  mock.$transaction.mockImplementation((work: (tx: typeof mock) => unknown) => work(mock));
  mock.vehicle.findFirst.mockResolvedValue(null);
  mock.vehicle.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    ...stored, id: "created", publicReference: data.publicReference,
  }));
});

describe("driver vehicle registration remains single-owner and retry safe", () => {
  it("locks the normalized plate before looking up and inserting the active vehicle", async () => {
    const result = await createOwnVehicle("driver-user", input);
    expect(result.id).toBe("created");
    expect(mock.$executeRaw).toHaveBeenCalledTimes(1);
    expect(mock.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(mock.vehicle.findFirst.mock.invocationCallOrder[0]!);
    expect(mock.vehicle.findFirst.mock.invocationCallOrder[0]).toBeLessThan(mock.vehicle.create.mock.invocationCallOrder[0]!);
    expect(mock.vehicle.create.mock.calls[0]![0].data).toMatchObject({
      registrationNumber: "CA123-456", driverProfileId: "driver-one", vehicleType: VehicleType.VAN,
    });
  });
  it("returns the same existing vehicle for an exact same-driver retry", async () => {
    mock.vehicle.findFirst.mockResolvedValue(stored);
    const result = await createOwnVehicle("driver-user", input);
    expect(result.id).toBe(stored.id);
    expect(result.publicReference).toBe(stored.publicReference);
    expect(mock.vehicle.create).not.toHaveBeenCalled();
  });
  it("refuses another driver's vehicle without changing its owner or record", async () => {
    mock.vehicle.findFirst.mockResolvedValue({ ...stored, driverProfileId: "another-driver" });
    await expect(createOwnVehicle("driver-user", input)).rejects.toMatchObject({
      code: "VEHICLE_REGISTRATION_CONFLICT", status: 409,
    });
    expect(mock.vehicle.create).not.toHaveBeenCalled();
  });
  it("rejects conflicting details on the same driver's current registration", async () => {
    mock.vehicle.findFirst.mockResolvedValue({ ...stored, model: "Corolla" });
    await expect(createOwnVehicle("driver-user", input)).rejects.toBeInstanceOf(VehicleComplianceError);
    expect(mock.vehicle.create).not.toHaveBeenCalled();
  });
});
