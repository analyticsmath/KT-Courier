import { beforeEach, describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "@/types/domain";
const db = vi.hoisted(() => ({
  paymentMethodPolicy: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
  },
  systemSetting: { findUnique: vi.fn() },
  store: { findUnique: vi.fn() },
  deliveryServiceDefinition: { findFirst: vi.fn() },
  deliveryRegion: { findFirst: vi.fn() },
  order: { findUnique: vi.fn(), update: vi.fn() },
  cashOnDelivery: { delete: vi.fn(), update: vi.fn() },
  adminActivityLog: { create: vi.fn(), findFirst: vi.fn() },
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
  approvePaymentConfiguration,
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
  effectiveFrom: new Date("2020-01-01T00:00:00Z"),
  effectiveTo: null,
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
  it("rejects reversed effective windows and expired activation", async () => {
    db.paymentMethodPolicy.findMany.mockResolvedValue([{ ...base, deliveryServiceId: input.deliveryServiceId, provinceScope: input.provinces }]);
    expect(PaymentConfigurationSchema.safeParse({ ...input, effectiveFrom: "2030-01-02T00:00:00Z", effectiveTo: "2030-01-01T00:00:00Z" }).success).toBe(false);
    await expect(savePaymentConfiguration(actor, { ...input, effectiveFrom: "2020-01-01T00:00:00Z", effectiveTo: "2020-01-02T00:00:00Z" })).rejects.toMatchObject({ code: "PAYMENT_POLICY_PERIOD_INVALID" });
    expect(db.paymentMethodPolicy.create).not.toHaveBeenCalled();
  });
  it("schedules a digital successor without superseding current authority early", async () => {
    db.paymentMethodPolicy.findMany.mockResolvedValue([{ ...base, deliveryServiceId: input.deliveryServiceId, provinceScope: input.provinces }]);
    await savePaymentConfiguration(actor, { ...input, mode: "DIGITAL", depositPercent: null, maximumCodAmount: null, effectiveFrom: "2030-01-01T00:00:00Z", effectiveTo: "2030-02-01T00:00:00Z" });
    expect(db.paymentMethodPolicy.updateMany).toHaveBeenCalledWith({ where: { id: base.id, status: "ACTIVE" }, data: { effectiveTo: new Date("2030-01-01T00:00:00Z") } });
    expect(db.paymentMethodPolicy.create.mock.calls[0][0].data).toMatchObject({ status: "ACTIVE", effectiveFrom: new Date("2030-01-01T00:00:00Z"), effectiveTo: new Date("2030-02-01T00:00:00Z") });
  });
  it("cancels a future authority without writing an end before its start", async () => {
    db.paymentMethodPolicy.findMany.mockResolvedValue([{ ...base, deliveryServiceId: input.deliveryServiceId, provinceScope: input.provinces, effectiveFrom: new Date("2030-01-01T00:00:00Z") }]);
    await savePaymentConfiguration(actor, { ...input, active: false });
    expect(db.paymentMethodPolicy.updateMany).toHaveBeenCalledWith({ where: { id: base.id, status: "ACTIVE" }, data: { status: "SUPERSEDED" } });
  });
  it("requires explicit cancellation before an overlapping scheduled replacement", async () => {
    db.paymentMethodPolicy.findMany.mockResolvedValue([{ ...base, deliveryServiceId: input.deliveryServiceId, provinceScope: input.provinces, effectiveFrom: new Date("2030-02-01T00:00:00Z") }]);
    await expect(savePaymentConfiguration(actor, { ...input, mode: "DIGITAL", depositPercent: null, effectiveFrom: "2030-01-01T00:00:00Z" })).rejects.toMatchObject({ code: "PAYMENT_POLICY_SCHEDULE_CONFLICT" });
    expect(db.paymentMethodPolicy.create).not.toHaveBeenCalled();
  });
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
  it("accepts an explicitly scoped 100% cash parcel policy for individual customers", () => {
    expect(PaymentConfigurationSchema.safeParse({
      ...input, storeId: null, mode: "FULL_COD", depositPercent: null,
    }).success).toBe(true);
    expect(PaymentConfigurationSchema.safeParse({
      ...input, storeId: null, mode: "DEPOSIT_PLUS_COD",
    }).success).toBe(false);
    expect(PaymentConfigurationSchema.safeParse({
      ...input, storeId: null, mode: "FULL_COD", deliveryServiceId: null,
    }).success).toBe(false);
  });

  it("creates a review-required parcel-only full COD policy without approving it", async () => {
    db.paymentMethodPolicy.findMany.mockResolvedValue([]);
    await savePaymentConfiguration(actor, {
      ...input, storeId: null, mode: "FULL_COD", depositPercent: null,
      maximumCodAmount: "300.00", expectedVersion: 0,
      reason: "Offer full COD for eligible parcel customers",
    });
    expect(db.paymentMethodPolicy.create.mock.calls[0][0].data).toMatchObject({
      storeId: null, orderType: "PARCEL_DOCUMENT", mode: "FULL_COD",
      depositPercent: null, status: "INACTIVE",
    });
    expect(db.store.findUnique).not.toHaveBeenCalled();
  });

  it("requires zero upfront payment for eligible full cash parcel delivery", async () => {
    db.paymentMethodPolicy.findMany.mockResolvedValue([{
      ...base, storeId: null, orderType: "PARCEL_DOCUMENT", mode: "FULL_COD",
      deliveryServiceId: "CLIENT_STANDARD", provinceScope: ["Gauteng"],
      depositPercent: null, maximumCodAmount: new Prisma.Decimal("300.00"),
    }]);
    const full = await resolvePaymentBreakdown({
      orderType: "PARCEL_DOCUMENT", deliveryServiceKey: "CLIENT_STANDARD",
      provinces: ["Gauteng"], authoritativeTotal: "249.00",
    });
    expect(full).toMatchObject({
      mode: "FULL_COD", digitalRequired: "0.00",
      cashRequired: "249.00", cashOutstanding: "249.00",
    });
    expect(db.store.findUnique).not.toHaveBeenCalled();
    await expect(resolvePaymentBreakdown({
      orderType: "GROCERY", deliveryServiceKey: "CLIENT_STANDARD",
      provinces: ["Gauteng"], authoritativeTotal: "249.00",
    })).rejects.toMatchObject({ code: "PAYMENT_POLICY_NOT_CONFIGURED" });
  });

  it("requires documented independent approval before production 100% cash checkout", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("KT_RUNTIME_ENV", "production");
    try {
      db.paymentMethodPolicy.findMany.mockResolvedValue([{
        ...base, createdByUserId: "author", storeId: null,
        orderType: "PARCEL_DOCUMENT", mode: "FULL_COD",
        deliveryServiceId: "CLIENT_STANDARD", provinceScope: ["Gauteng"],
        depositPercent: null, maximumCodAmount: new Prisma.Decimal("300.00"),
        policyEvidence: {},
      }]);
      await expect(resolvePaymentBreakdown({
        orderType: "PARCEL_DOCUMENT", deliveryServiceKey: "CLIENT_STANDARD",
        provinces: ["Gauteng"], authoritativeTotal: "179.00",
      })).rejects.toMatchObject({ code: "COD_PRODUCTION_APPROVAL_REQUIRED" });
    } finally { vi.unstubAllEnvs(); }
  });

  it("permits production zero-deposit COD only with approved cash remittance instructions", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("KT_RUNTIME_ENV", "production");
    try {
      const date = new Date("2026-10-15T10:00:00.000Z");
      db.paymentMethodPolicy.findMany.mockResolvedValue([{
        ...base, createdByUserId: "author", storeId: null,
        orderType: "PARCEL_DOCUMENT", mode: "FULL_COD",
        deliveryServiceId: "CLIENT_STANDARD", provinceScope: ["Gauteng"],
        depositPercent: null, maximumCodAmount: new Prisma.Decimal("300.00"),
        policyEvidence: { approvedByUserId: "reviewer", approvedAt: date.toISOString(),
          remittanceApproved: true, remittanceUpdatedAt: date.toISOString(), settlementTiming: "Bank receipt within 24 hours" },
      }]);
      const args = { orderType: "PARCEL_DOCUMENT", deliveryServiceKey: "CLIENT_STANDARD",
        provinces: ["Gauteng"], authoritativeTotal: "179.00" };
      await expect(resolvePaymentBreakdown(args)).rejects.toMatchObject({ code: "COD_REMITTANCE_NOT_CONFIGURED" });
      db.systemSetting.findUnique.mockResolvedValue({
        value: { bankName: "Test bank", accountName: "KT Couriers", accountNumber: "1234567890", branchCode: "123456", referenceHint: "Use order reference", expectedVersion: 1 },
        updatedAt: date,
      });
      expect(await resolvePaymentBreakdown(args)).toMatchObject({
        mode: "FULL_COD", digitalRequired: "0.00", cashRequired: "179.00",
      });
    } finally { vi.unstubAllEnvs(); }
  });

  it("activates reviewed full parcel COD without mutating older 50/50 scopes", async () => {
    const draft = { ...base, id: "cm00000000000000000000001", status: "INACTIVE",
      createdByUserId: "different-author", storeId: null, mode: "FULL_COD",
      orderType: "PARCEL_DOCUMENT", deliveryServiceId: "CLIENT_STANDARD",
      provinceScope: ["Gauteng"], depositPercent: null,
      maximumCodAmount: new Prisma.Decimal("300.00") };
    db.paymentMethodPolicy.findUnique.mockResolvedValue(draft);
    db.paymentMethodPolicy.findMany.mockResolvedValue([draft]);
    db.systemSetting.findUnique.mockResolvedValue({
      value: { bankName: "Test bank", accountName: "KT Couriers", accountNumber: "1234567890", branchCode: "123456", referenceHint: "Use order reference", expectedVersion: 1 },
      updatedAt: new Date("2026-10-15T10:00:00.000Z"),
    });
    db.adminActivityLog.findFirst.mockResolvedValue({ actorUserId: "bank-author" });
    await approvePaymentConfiguration(actor, {
      policyId: draft.id, expectedVersion: 1, remittanceVerified: true,
      settlementTiming: "Bank receipt within 24 hours", reason: "Verified parcel full cash operations",
    });
    expect(db.paymentMethodPolicy.create.mock.calls[0][0].data).toMatchObject({
      mode: "FULL_COD", orderType: "PARCEL_DOCUMENT", status: "ACTIVE",
      storeId: null, createdByUserId: "different-author",
      policyEvidence: { approvedByUserId: "admin", remittanceApproved: true },
    });
  });

});
