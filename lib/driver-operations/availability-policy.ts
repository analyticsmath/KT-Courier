import { DriverAvailability, DriverStatus } from "@/types/db";

export function canSelectAvailability(status: DriverStatus, availability: DriverAvailability): boolean {
  if (availability === DriverAvailability.ON_DELIVERY) return false;
  return status === DriverStatus.ACTIVE;
}
