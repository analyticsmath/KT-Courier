import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@/types/db";

const mocks = vi.hoisted(() => ({
  orderFindUnique: vi.fn(),
  driverFindUnique: vi.fn(),
  storeAccess: vi.fn(),
  hasPermission: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    order: { findUnique: mocks.orderFindUnique },
    driverProfile: { findUnique: mocks.driverFindUnique },
  },
}));
vi.mock("@/lib/client-platform/store-access", () => ({
  storeAccess: mocks.storeAccess,
}));
vi.mock("@/lib/auth/permissions", () => ({
  hasPermission: mocks.hasPermission,
}));

import { authorizeShipmentDocumentAccess } from "@/lib/shipment-documents/authorization";
import { buildPublicTrackingMilestones, formatPublicAreaLabel } from "@/lib/tracking/public-timeline";
import { hashTrackingGrantToken } from "@/lib/tracking/recipient-access.server";

describe("Recipient Tracking Timeline & Document BOLA Authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("formats recipient public area without exposing street lines or GPS coordinates", () => {
    const label = formatPublicAreaLabel(
      { suburb: "Sandhurst", city: "Sandton", province: "Gauteng" },
      "Area pending",
    );
    expect(label).toBe("Sandton, Gauteng");
    expect(formatPublicAreaLabel(null, "Fallback area")).toBe("Fallback area");
  });

  it("maps parcel statuses into deterministic customer-safe milestone timelines", () => {
    const milestones = buildPublicTrackingMilestones({
      currentStatus: "IN_TRANSIT",
      createdAt: new Date("2026-11-26T08:00:00.000Z"),
      deliveredAt: null,
      history: [
        { status: "CONFIRMED", createdAt: new Date("2026-11-26T08:05:00.000Z") },
        { status: "DRIVER_ASSIGNED", createdAt: new Date("2026-11-26T09:00:00.000Z") },
        { status: "PICKED_UP", createdAt: new Date("2026-11-26T09:30:00.000Z") },
      ],
    });
    expect(milestones.find((m) => m.key === "CONFIRMED")?.state).toBe("COMPLETED");
    expect(milestones.find((m) => m.key === "COLLECTED")?.state).toBe("CURRENT");
    expect(milestones.find((m) => m.key === "DELIVERED")?.state).toBe("UPCOMING");
  });

  it("hashes tracking grant tokens as 64-char SHA-256 hex without storing plaintext", () => {
    const raw = "secret_grant_token_value_123456";
    const digest = hashTrackingGrantToken(raw);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toContain(raw);
  });

  it("rejects unauthenticated callers and enforces strict BOLA across customer, store, driver, and admin roles", async () => {
    await expect(
      authorizeShipmentDocumentAccess({ user: null, orderId: "ord_1", action: "WAYBILL" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED", statusCode: 401 });

    // Customer cannot view another customer's order
    mocks.orderFindUnique.mockResolvedValueOnce({
      id: "ord_other",
      orderNumber: "KT-2026-000111",
      status: "CONFIRMED",
      source: "CUSTOMER",
      customerId: "user_other",
      storeId: null,
    });
    await expect(
      authorizeShipmentDocumentAccess({
        user: { id: "user_me", email: "me@example.com", role: UserRole.CUSTOMER, status: "ACTIVE" } as never,
        orderId: "ord_other",
        action: "WAYBILL",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });

    // Driver cannot create tracking share links or call recover
    await expect(
      authorizeShipmentDocumentAccess({
        user: { id: "drv_u", email: "d@example.com", role: UserRole.DRIVER, status: "ACTIVE" } as never,
        orderId: "ord_1",
        action: "TRACKING_GRANT",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });

    // Unassigned driver cannot download another driver's assignment waybill
    mocks.driverFindUnique.mockResolvedValueOnce({ id: "drv_me", status: "ACTIVE" });
    mocks.orderFindUnique.mockResolvedValueOnce({
      id: "ord_other_drv",
      orderNumber: "KT-2026-000222",
      status: "DISPATCHED",
      source: "CUSTOMER",
      customerId: "c1",
      storeId: null,
      currentDriverProfileId: "drv_other",
      assignments: [],
    });
    await expect(
      authorizeShipmentDocumentAccess({
        user: { id: "drv_u", email: "d@example.com", role: UserRole.DRIVER, status: "ACTIVE" } as never,
        orderId: "ord_other_drv",
        action: "WAYBILL",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });

    // Assigned driver with ACCEPTED assignment CAN view WAYBILL and POD
    mocks.driverFindUnique.mockResolvedValueOnce({ id: "drv_me", status: "ACTIVE" });
    mocks.orderFindUnique.mockResolvedValueOnce({
      id: "ord_mine_drv",
      orderNumber: "KT-2026-000333",
      status: "DELIVERED",
      source: "CUSTOMER",
      customerId: "c1",
      storeId: null,
      currentDriverProfileId: null,
      assignments: [{ id: "assign_1" }],
    });
    const ctx = await authorizeShipmentDocumentAccess({
      user: { id: "drv_u", email: "d@example.com", role: UserRole.DRIVER, status: "ACTIVE" } as never,
      orderId: "ord_mine_drv",
      action: "POD",
    });
    expect(ctx.viewerRole).toBe("DRIVER");

    // Admin lacking ORDERS_STATUS_MANAGE cannot call RECOVER
    mocks.hasPermission.mockResolvedValueOnce(false);
    await expect(
      authorizeShipmentDocumentAccess({
        user: { id: "adm_ro", email: "ro@ktcouriers.com", role: UserRole.ADMIN, status: "ACTIVE" } as never,
        orderId: "ord_1",
        action: "RECOVER",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
  });
});
