import { VehicleType } from "@/types/db";

/** The exact customer-requested vehicle categories, independent of legacy dispatch classes. */
export const VEHICLE_SUBTYPES = [
  "MOTORCYCLE", "SCOOTER", "SEDAN", "HATCHBACK", "BAKKIE",
  "PANEL_VAN", "VAN", "TRUCK", "OTHER",
] as const;
export type VehicleSubtype = (typeof VEHICLE_SUBTYPES)[number];
export const VEHICLE_TYPE_FOR_SUBTYPE: Record<VehicleSubtype, VehicleType> = {
  MOTORCYCLE: VehicleType.MOTORBIKE,
  SCOOTER: VehicleType.MOTORBIKE,
  SEDAN: VehicleType.CAR,
  HATCHBACK: VehicleType.CAR,
  BAKKIE: VehicleType.VAN,
  PANEL_VAN: VehicleType.VAN,
  VAN: VehicleType.VAN,
  TRUCK: VehicleType.TRUCK,
  OTHER: VehicleType.OTHER,
};
export const VEHICLE_SUBTYPE_LABELS: Record<VehicleSubtype, string> = {
  MOTORCYCLE: "Motorcycle", SCOOTER: "Scooter", SEDAN: "Sedan",
  HATCHBACK: "Hatchback", BAKKIE: "Bakkie", PANEL_VAN: "Panel van",
  VAN: "Van", TRUCK: "Truck", OTHER: "Other",
};
