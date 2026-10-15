import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { projectCustomerTrackingStoreOrder, type CustomerTrackingRow } from "@/lib/services/marketplace-delivery-tracking.service";

const base: CustomerTrackingRow = {
  marketplaceOrderReference: "morder_1",
  customerUserId: "customer_1",
  guestConfirmationHash: null,
  marketplaceStatus: "CONFIRMED",
  storeOrderReference: "store_order_1",
  storeName: "Market A",
  storeSlug: "market-a",
  preparationStatus: "HANDED_OFF",
  resolutionStatus: "CLEAR",
  bridgeStatus: "IN_TRANSIT",
  courierOrderReference: "KT-1",
  courierStatus: "IN_TRANSIT",
  assignmentStatus: "ACCEPTED",
  locationLatitude: new Prisma.Decimal("-33.9249"),
  locationLongitude: new Prisma.Decimal("18.4241"),
  locationObservedAt: new Date("2026-08-04T10:00:00.000Z"),
  proofMethod: null,
  proofDeliveredAt: null,
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
  it("shows cash still due, collected or cancelled without confusing bank remittance with customer debt", () => {
    const cash = { ...base, cashObligation: new Prisma.Decimal("60.01"), cashCollected: new Prisma.Decimal(0), cashStatus: "READY" };
    expect(projectCustomerTrackingStoreOrder(cash).cashOnDelivery).toEqual({ obligation: "60.01", collected: "0.00", outstanding: "60.01", status: "READY" });
    expect(projectCustomerTrackingStoreOrder({ ...cash, cashCollected: new Prisma.Decimal("60.01"), cashStatus: "COLLECTED" }).cashOnDelivery?.outstanding).toBe("0.00");
    expect(projectCustomerTrackingStoreOrder({ ...cash, cashStatus: "CANCELLED" }).cashOnDelivery?.outstanding).toBe("0.00");
    expect(projectCustomerTrackingStoreOrder({ ...cash, acceptanceStatus: "REJECTED", cashStatus: null }).cashOnDelivery).toMatchObject({ status: "CANCELLED", outstanding: "0.00" });
    expect(projectCustomerTrackingStoreOrder(base).cashOnDelivery).toBeNull();
  });
  it("retains customer-safe POD at DELIVERED and COMPLETED without retaining courier GPS", () => {
    const confirmed = { ...base, proofMethod: "OTP", proofDeliveredAt: new Date("2026-08-04T11:00:00.000Z") };
    expect(projectCustomerTrackingStoreOrder(confirmed).proofOfDelivery).toBeNull();
    for (const terminal of ["DELIVERED", "COMPLETED"]) {
      const view = projectCustomerTrackingStoreOrder({ ...confirmed, courierStatus: terminal });
      expect(view.liveLocation).toBeNull();
      expect(view.proofOfDelivery).toEqual({ method: "OTP", deliveredAt: "2026-08-04T11:00:00.000Z" });
      expect(JSON.stringify(view)).not.toMatch(/recipientPhone|otpCode|evidenceReference/);
    }
  });
});
