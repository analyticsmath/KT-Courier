import { beforeEach, expect, it, vi } from "vitest";
import { Prisma, UserRole, UserStatus } from "@prisma/client";

const mocks = vi.hoisted(() => ({ allowed: vi.fn(), find: vi.fn() }));
vi.mock("@/lib/auth/permissions", () => ({ hasPermission: mocks.allowed }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { cashOnDelivery: { findUnique: mocks.find } } }));
import { getAdminCodDeliveryReadiness } from "@/lib/services/admin-cod-delivery-readiness.service";

const admin = { id: "admin", email: "admin@example.invalid", name: null, role: UserRole.ADMIN, status: UserStatus.ACTIVE };
beforeEach(() => { mocks.allowed.mockReset(); mocks.find.mockReset(); });
it("does not read cash details without the cash operations permission", async () => {
  mocks.allowed.mockResolvedValue(false);
  expect(await getAdminCodDeliveryReadiness(admin, "order")).toBeNull();
  expect(mocks.find).not.toHaveBeenCalled();
});
it("shows exact paid deposit and outstanding cash for authorized operations", async () => {
  mocks.allowed.mockResolvedValue(true);
  mocks.find.mockResolvedValue({ publicReference: "COD-1", status: "READY_FOR_COLLECTION", digitalRequired: new Prisma.Decimal("50.50"), digitalPaid: new Prisma.Decimal("50.50"), cashObligation: new Prisma.Decimal("50.51"), cashCollected: new Prisma.Decimal("10.01"), collectorDriverId: null, order: { currentDriverProfileId: "driver-1" } });
  expect(await getAdminCodDeliveryReadiness(admin, "order")).toEqual({ reference: "COD-1", status: "READY_FOR_COLLECTION", digitalRequired: "50.50", digitalPaid: "50.50", cashObligation: "50.51", cashCollected: "10.01", cashOutstanding: "40.50", driverId: "driver-1" });
});
