import { describe, expect, it } from "vitest";
import { VehicleType } from "@/types/db";
import { CreateVehicleSchema } from "@/lib/validation/private-media";
import { VEHICLE_SUBTYPES, VEHICLE_TYPE_FOR_SUBTYPE } from "@/lib/driver-operations/vehicle-subtypes";

const base = {
  make: "Toyota", model: "Hilux", year: 2024, colour: "White",
  registrationNumber: "CA 123 456", capacityKg: "750.000",
};

describe("client vehicle category registration", () => {
  it.each(VEHICLE_SUBTYPES)("accepts %s with an unambiguous legacy dispatch class", subtype => {
    const vehicleType = VEHICLE_TYPE_FOR_SUBTYPE[subtype];
    expect(CreateVehicleSchema.safeParse({ ...base, vehicleSubtype: subtype, vehicleType }).success).toBe(true);
    const mismatched = vehicleType === VehicleType.CAR ? VehicleType.TRUCK : VehicleType.CAR;
    expect(CreateVehicleSchema.safeParse({ ...base, vehicleSubtype: subtype, vehicleType: mismatched }).success).toBe(false);
  });
  it("rejects invalid capacity values and non-integer years", () => {
    for (const capacityKg of ["0", "0.000", "-3.5", "1,2", "12.9999"]) {
      expect(CreateVehicleSchema.safeParse({ ...base, vehicleType: VehicleType.VAN, vehicleSubtype: "PANEL_VAN", capacityKg }).success).toBe(false);
    }
    expect(CreateVehicleSchema.safeParse({ ...base, vehicleType: VehicleType.VAN, vehicleSubtype: "PANEL_VAN", year: 2024.5 }).success).toBe(false);
  });
  it("retains existing registrations that do not yet specify a subtype", () => {
    expect(CreateVehicleSchema.safeParse({ ...base, vehicleType: VehicleType.VAN }).success).toBe(true);
  });
});
