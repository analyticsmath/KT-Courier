import { beforeEach, describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "@/types/domain";
const db = vi.hoisted(() => ({
  paymentMethodPolicy: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  store: { findUnique: vi.fn() },
  deliveryServiceDefinition: { findFirst: vi.fn() },
  deliveryRegion: { findFirst: vi.fn() },
  order: { findUnique: vi.fn(), update: vi.fn() },
  cashOnDelivery: { delete: vi.fn(), update: vi.fn() },
  adminActivityLog: { create: vi.fn() },
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
  $queryRaw: vi.fn(),
}));
const permission = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth/permissions", () => ({ hasPermission: permission }));
import {
  resolvePaymentBreakdown,
  resolvePaymentPolicy,
} from "@/lib/payments/payment-policy.service";
import {
  PaymentConfigurationSchema,
  savePaymentConfiguration,
} from "@/lib/client-platform/payment-configuration.service";
const base = {
  id: "policy",
  versionNumber: 1,
  status: "ACTIVE",
  mode: "DEPOSIT_PLUS_COD",
  storeId: "corder12345678901234567890",
  businessModuleId: null,
  deliveryServiceId: null,
  orderType: null,
  provinceScope: null,
  regionId: null,
  orderId: null,
  depositPercent: new Prisma.Decimal("0.5"),
  depositAmount: null,
  maximumCodAmount: new Prisma.Decimal(100),
};
const actor = {
  id: "admin",
  role: "ADMIN",
  status: "ACTIVE",
} as AuthenticatedUser;
const input = {
  storeId: base.storeId,
  deliveryServiceId: "CLIENT_STANDARD",
  provinces: ["Gauteng"] as ["Gauteng"],
  regionId: null,
  orderId: null,
  mode: "DEPOSIT_PLUS_COD" as const,
  depositPercent: "0.5",
  maximumCodAmount: "100",
  active: true,
  expectedVersion: 1,
  reason: "Approved business cash split",
};
beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) =>
    fn(db),
  );
  db.paymentMethodPolicy.findMany.mockResolvedValue([base]);
  db.paymentMethodPolicy.create.mockResolvedValue({ id: "new-policy" });
  db.store.findUnique.mockResolvedValue({
    status: "ACTIVE",
    ownerUser: { status: "ACTIVE", emailVerifiedAt: new Date() },
  });
  permission.mockResolvedValue(true);
  db.deliveryServiceDefinition.findFirst.mockResolvedValue({ stableKey: "CLIENT_STANDARD" });
});
describe("scoped cash payment policies", () => {
  it("matches every province, service and destination scope", async () => {
    db.paymentMethodPolicy.findMany.mockResolvedValue([
      {
        ...base,
        provinceScope: ["Gauteng"],
        deliveryServiceId: "CLIENT_STANDARD",
        regionId: "jhb",
      },
    ]);
    expect(
      (
        await resolvePaymentBreakdown({
          storeId: base.storeId,
          provinces: ["Gauteng", "Gauteng"],
          deliveryServiceKey: "CLIENT_STANDARD",
          regionId: "jhb",
          authoritativeTotal: "179.00",
        })
      ).digitalRequired,
    ).toBe("89.50");
    await expect(
      resolvePaymentBreakdown({
        storeId: base.storeId,
        provinces: ["Gauteng", "Western Cape"],
        deliveryServiceKey: "CLIENT_STANDARD",
        regionId: "jhb",
        authoritativeTotal: "179.00",
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_POLICY_NOT_CONFIGURED" });
  });
  it("requires province evidence when the policy has a province scope", async () => {
    db.paymentMethodPolicy.findMany.mockResolvedValue([
      { ...base, provinceScope: ["Gauteng"] },
    ]);
    await expect(
      resolvePaymentPolicy({ storeId: base.storeId }),
    ).rejects.toMatchObject({ code: "PAYMENT_POLICY_NOT_CONFIGURED" });
  });
  it("applies the maximum to required cash, not the full total", async () => {
    expect(
      (
        await resolvePaymentBreakdown({
          storeId: base.storeId,
          authoritativeTotal: "200.00",
        })
      ).cashRequired,
    ).toBe("100.00");
    await expect(
      resolvePaymentBreakdown({
        storeId: base.storeId,
        authoritativeTotal: "200.02",
      }),
    ).rejects.toMatchObject({ code: "COD_LIMIT_EXCEEDED" });
  });
  it("denies global cash eligibility", async () => {
    db.paymentMethodPolicy.findMany.mockResolvedValue([
      { ...base, storeId: null },
    ]);
    await expect(
      resolvePaymentBreakdown({
        storeId: base.storeId,
        authoritativeTotal: "100.00",
      }),
    ).rejects.toMatchObject({ code: "COD_BUSINESS_NOT_APPROVED" });
  });
  it("denies suspended businesses", async () => {
    db.store.findUnique.mockResolvedValue({
      status: "SUSPENDED",
      ownerUser: { status: "ACTIVE", emailVerifiedAt: new Date() },
    });
    await expect(
      resolvePaymentBreakdown({
        storeId: base.storeId,
        authoritativeTotal: "100.00",
      }),
    ).rejects.toMatchObject({ code: "COD_BUSINESS_NOT_APPROVED" });
  });
  it("rejects equally specific overlapping scopes", async () => {
    db.paymentMethodPolicy.findMany.mockResolvedValue([
      { ...base, provinceScope: ["Gauteng"] },
      { ...base, id: "other", provinceScope: ["Gauteng", "Limpopo"] },
    ]);
    await expect(
      resolvePaymentPolicy({ storeId: base.storeId, provinces: ["Gauteng"] }),
    ).rejects.toMatchObject({ code: "PAYMENT_POLICY_CONFLICT" });
  });
  it("selects the newest version of the same scope", async () => {
    db.paymentMethodPolicy.findMany.mockResolvedValue([
      base,
      { ...base, id: "new", versionNumber: 2 },
    ]);
    expect((await resolvePaymentPolicy({ storeId: base.storeId })).id).toBe(
      "new",
    );
  });
  it("gives order overrides priority", async () => {
    db.paymentMethodPolicy.findMany.mockResolvedValue([
      {
        ...base,
        provinceScope: ["Gauteng"],
        regionId: "jhb",
        deliveryServiceId: "CLIENT_STANDARD",
      },
      { ...base, id: "override", orderId: "order" },
    ]);
    expect(
      (
        await resolvePaymentPolicy({
          storeId: base.storeId,
          orderId: "order",
          provinces: ["Gauteng"],
          regionId: "jhb",
          deliveryServiceKey: "CLIENT_STANDARD",
        })
      ).id,
    ).toBe("override");
  });
  it("requires a business and cash maximum for admin configuration", () => {
    expect(
      PaymentConfigurationSchema.safeParse({ ...input, storeId: null }).success,
    ).toBe(false);
  });
  it("rejects a stale edit before writing", async () => {
    db.paymentMethodPolicy.findMany.mockResolvedValue([{ ...base, deliveryServiceId: input.deliveryServiceId, provinceScope: input.provinces }]);
    await expect(
      savePaymentConfiguration(actor, { ...input, expectedVersion: 0 }),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.paymentMethodPolicy.create).not.toHaveBeenCalled();
  });
  it("audits the actual administrator and creates the successor version", async () => {
    db.paymentMethodPolicy.findMany.mockResolvedValue([{ ...base, deliveryServiceId: input.deliveryServiceId, provinceScope: input.provinces }]);
    await savePaymentConfiguration(actor, input);
    expect(db.paymentMethodPolicy.create.mock.calls[0][0].data).toMatchObject({
      versionNumber: 2,
      createdByUserId: "admin",
      status: "INACTIVE",
    });
    expect(db.adminActivityLog.create.mock.calls[0][0].data.actorUserId).toBe(
      "admin",
    );
    expect(db.paymentMethodPolicy.updateMany).not.toHaveBeenCalled();
  });
  it("blocks per-order digital changes once payment is prepared", async () => {
    db.paymentMethodPolicy.findMany.mockResolvedValue([]);
    db.order.findUnique.mockResolvedValue({
      storeId: base.storeId,
      status: "CONFIRMED",
      payments: [{ id: "prepared" }],
      pricingQuote: { total: new Prisma.Decimal(100) },
      priceEstimate: new Prisma.Decimal(100),
    });
    await expect(
      savePaymentConfiguration(actor, {
        ...input,
        mode: "DIGITAL",
        depositPercent: null,
        expectedVersion: 0,
        orderId: "corder22345678901234567890",
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_ORDER_LOCKED" });
    expect(db.order.update).not.toHaveBeenCalled();
  });
  it("denies unauthorized admins before reading the policy", async () => {
    permission.mockResolvedValue(false);
    await expect(savePaymentConfiguration(actor, input)).rejects.toMatchObject({
      status: 403,
    });
    expect(db.paymentMethodPolicy.findMany).not.toHaveBeenCalled();
  });
});
