import { describe, expect, it } from "vitest";
import { shouldRefreshParcelStatus, shouldRefreshMarketplaceStatus } from "@/lib/tracking/delivery-status-refresh";

describe("customer delivery progress refresh decisions", () => {
  it("refreshes active parcel deliveries while stopping after completion or cancellation", () => {
    for (const status of ["PENDING", "CONFIRMED", "PICKUP_SCHEDULED", "PICKED_UP", "IN_TRANSIT", "DELIVERY_ATTEMPTED", "FAILED"]) {
      expect(shouldRefreshParcelStatus(status)).toBe(true);
    }
    for (const status of ["DELIVERED", "COMPLETED", "CANCELLED"]) {
      expect(shouldRefreshParcelStatus(status)).toBe(false);
    }
  });
  it("stops polling cancelled marketplace orders, including those without store deliveries", () => {
    expect(shouldRefreshMarketplaceStatus(["DRIVER_ASSIGNED"], "CANCELLED")).toBe(false);
    expect(shouldRefreshMarketplaceStatus([], "CANCELLED")).toBe(false);
    expect(shouldRefreshMarketplaceStatus(["FAILED"], "RECONCILIATION_REQUIRED")).toBe(true);
    expect(shouldRefreshMarketplaceStatus(["DRIVER_ASSIGNED"], "CONFIRMED")).toBe(true);
  });
  it("refreshes marketplace orders until all their store deliveries finish", () => {
    expect(shouldRefreshMarketplaceStatus(["DELIVERED", "DRIVER_ASSIGNED"])).toBe(true);
    expect(shouldRefreshMarketplaceStatus(["DELIVERED", "DELIVERED"])).toBe(false);
    expect(shouldRefreshMarketplaceStatus(["DELIVERED", "FAILED"])).toBe(true);
    expect(shouldRefreshMarketplaceStatus([])).toBe(true);
  });
});
