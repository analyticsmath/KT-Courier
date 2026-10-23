import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CreateVehicleSchema } from "@/lib/validation/private-media";
import { VehicleType } from "@/types/db";

const source = readFileSync(
  new URL("../../components/driver/DriverOnboardingExperience.tsx", import.meta.url),
  "utf8",
);
const capacityControl = source.match(/<input\s+id="vehicle-capacity"[\s\S]*?\/>/)?.[0] ?? "";

const numericAttribute = (name: string): number => {
  const value = capacityControl.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1];
  return value === undefined ? Number.NaN : Number(value);
};

const vehicle = {
  make: "Toyota",
  model: "Hilux",
  registrationNumber: "CA123456",
  vehicleType: VehicleType.VAN,
};

describe("driver vehicle cargo capacity", () => {
  it("lets native number-input validation accept whole kilograms and thousandths", () => {
    expect(capacityControl).not.toBe("");
    const min = numericAttribute("min");
    const step = numericAttribute("step");
    const max = numericAttribute("max");
    expect(min).toBe(0.001);
    expect(step).toBe(0.001);
    expect(max).toBe(99999999);

    // HTML step values form a sequence min + n*step; the former
    // min=0.001 / step=0.1 rejected 800 but accepted 800.001.
    for (const kg of [0.001, 1, 30, 800, 800.001, 99999999]) {
      expect(kg).toBeGreaterThanOrEqual(min);
      expect(kg).toBeLessThanOrEqual(max);
      const steps = (kg - min) / step;
      expect(Math.abs(steps - Math.round(steps))).toBeLessThan(0.000001);
    }
  });

  it.each(["0.001", "30", "800", "800.001", "99999999"])(
    "accepts %s kg in the existing backend contract",
    (capacityKg) => {
      expect(CreateVehicleSchema.safeParse({ ...vehicle, capacityKg }).success).toBe(true);
    },
  );

  it.each(["0", "-1", "0.0001", "800.0001", "100000000", "Infinity"])(
    "rejects invalid or out-of-range %s kg in the backend contract",
    (capacityKg) => {
      expect(CreateVehicleSchema.safeParse({ ...vehicle, capacityKg }).success).toBe(false);
    },
  );
});
