import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { projectCustomerTrackingStoreOrder, type CustomerTrackingRow } from "@/lib/services/marketplace-delivery-tracking.service";

const base: CustomerTrackingRow = {
  marketplaceOrderReference: "morder_1",
  customerUserId: "customer_1",
  guestConfirmationHash: null,
  marketplaceStatus: "CONFIRMED",
  storeOrderReference: "store_order_1",
  preparationStatus: "HANDED_OFF",
  resolutionStatus: "CLEAR",
  bridgeStatus: "IN_TRANSIT",
  courierOrderReference: "KT-1",
  courierStatus: "IN_TRANSIT",
  assignmentStatus: "ACCEPTED",
  locationLatitude: new Prisma.Decimal("-33.9249"),
  locationLongitude: new Prisma.Decimal("18.4241"),
  locationObservedAt: new Date("2026-08-04T10:00:00.000Z"),
};

describe("marketplace customer tracking projection", () => {
  it("coarsens active-transit location and omits it after delivery", () => {
    expect(projectCustomerTrackingStoreOrder(base).liveLocation).toEqual({
      latitude: -33.92,
      longitude: 18.42,
      observedAt: "2026-08-04T10:00:00.000Z",
    });
    expect(projectCustomerTrackingStoreOrder({ ...base, courierStatus: "DELIVERED", bridgeStatus: "DELIVERED" }).liveLocation).toBeNull();
  });
});
