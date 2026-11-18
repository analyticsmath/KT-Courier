import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { OrderStatus, UserRole, UserStatus } from "@/types/db";
import { createPublicQuote } from "@/lib/client-platform/delivery.service";
import { createOrder } from "@/lib/services/orders.service";
import { updateAdminOrderStatus } from "@/lib/services/admin-orders.service";
import { transitionOrderStatusInTx } from "@/lib/services/order-status.service";
import { prepareOrderPayment } from "@/lib/services/payment-preparation.service";
import { createProviderCheckoutSession } from "@/lib/services/payment-provider-session.service";
import { recoverPaystackAttemptViaVerify } from "@/lib/services/paystack-verify-recovery.service";
import { expireUnpaidCourierOrdersBatch } from "@/lib/services/parcel-unpaid-expiry.service";
import { listAdminAlertOverview } from "@/lib/notifications/admin-alert-dispatch.service";
import {
  savePaymentConfiguration,
  approvePaymentConfiguration,
} from "@/lib/client-platform/payment-configuration.service";
import { resolvePaymentBreakdown } from "@/lib/payments/payment-policy.service";
import {
  ensureWalletForOwner,
  ensureLedgerAccount,
} from "@/lib/services/wallet-account.service";
import { ensureWalletAvailableAccountInTx } from "@/lib/services/wallet-spending.service";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";
import { executeRegisteredProcessor } from "@/lib/processors/processor-service";
import { PaystackAdapter } from "@/lib/payments/providers/paystack/paystack-adapter";
import type { PaystackClient } from "@/lib/payments/providers/paystack/paystack-client";
import type { PaymentProviderRegistry } from "@/lib/payments/providers/payment-provider-registry";

import { DeliveryConfigurationSchema } from "@/lib/client-platform/contracts";

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ value: "b".repeat(64) }),
    set: vi.fn(),
  }),
}));

vi.mock("@/lib/maps/geocode.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/maps/geocode.service")>();
  return {
    ...actual,
    geocodeSouthAfricanAddress: vi.fn(async (addr: { city?: string | null }) => {
      if ((addr.city ?? "").toLowerCase().includes("pretoria")) {
        return { latitude: -25.7479, longitude: 28.2293 };
      }
      return { latitude: -26.2041, longitude: 28.0473 };
    }),
    reverseGeocodeSouthAfricanProvince: vi.fn(async () => "Gauteng" as const),
  };
});

vi.mock("@/lib/maps/routes.service", () => ({
  calculateRoute: vi.fn(async () => ({
    ok: true as const,
    route: {
      distanceMeters: 12000,
      durationSeconds: 900,
      provider: "TEST_ROUTE",
      routeSummary: "Johannesburg -> Pretoria",
    },
  })),
}));

describe("KT Couriers Payment -> Ledger -> Auto Acceptance -> 24h Expiry -> 50/50 COD -> Notifications Closure (PostgreSQL)", () => {
  const prefix = `ktcls${randomUUID().replace(/-/g, "").slice(0, 8)}`;
  let safetyChecked = false;
  let customerUser!: { id: string; email: string; name: string; role: UserRole; status: UserStatus };
  let adminUser!: { id: string; email: string; name: string; role: UserRole; status: UserStatus };
  let superAdminUser!: { id: string; email: string; name: string; role: UserRole; status: UserStatus };
  let gautengRegion!: { id: string; name: string };
  const deliveryServiceKey = `CLIENT_${prefix.toUpperCase()}`;
  let createdRuleId: string | null = null;
  let createdServiceId: string | null = null;
  const suspendedInvalidServiceIds: string[] = [];
  const createdPolicyIds: string[] = [];
  let prevBankSetting: { value: Prisma.InputJsonValue | typeof Prisma.JsonNull } | null = null;
  let createdBankSetting = false;
  let createdBankLogId: string | null = null;

  beforeEach(() => {
    vi.stubEnv("PAYMENT_APP_ORIGIN", "http://127.0.0.1:3000");
  });

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent");
    if (
      process.env.NODE_ENV === "production" ||
      process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS !== "1" ||
      url.pathname !== "/kt_launch_test" ||
      !["localhost", "127.0.0.1"].includes(url.hostname)
    ) {
      throw new Error("Disposable closure database required.");
    }
    safetyChecked = true;
    vi.stubEnv("PAYMENT_APP_ORIGIN", "http://127.0.0.1:3000");

    const existingBank = await prisma.systemSetting.findUnique({
      where: { key: "client_cash_deposit_bank" },
      select: { value: true },
    });
    if (existingBank) {
      prevBankSetting = {
        value: existingBank.value === null ? Prisma.JsonNull : (existingBank.value as Prisma.InputJsonValue),
      };
    }

    const [cust, adm, sup, reg] = await Promise.all([
      prisma.user.create({
        data: {
          email: `${prefix}-cust@example.test`,
          name: "Closure Customer",
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.user.create({
        data: {
          email: `${prefix}-admin@example.test`,
          name: "Closure Admin",
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.user.create({
        data: {
          email: `${prefix}-super@example.test`,
          name: "Closure SuperAdmin",
          role: UserRole.SUPER_ADMIN,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.deliveryRegion.create({
        data: {
          name: `${prefix}-gauteng`,
          slug: `${prefix}-gauteng`,
          active: true,
          pricingEnabled: true,
          city: "Johannesburg",
          province: "Gauteng",
          coverageMode: "RADIUS",
          centerLat: "-26.1000000",
          centerLng: "28.1000000",
          coverageRadiusKm: "150.00",
          maxDistanceKm: "150.00",
        },
      }),
    ]);

    customerUser = { id: cust.id, email: cust.email, name: cust.name ?? "", role: cust.role, status: cust.status };
    adminUser = { id: adm.id, email: adm.email, name: adm.name ?? "", role: adm.role, status: adm.status };
    superAdminUser = { id: sup.id, email: sup.email, name: sup.name ?? "", role: sup.role, status: sup.status };
    gautengRegion = { id: reg.id, name: reg.name };

    await prisma.$transaction(async (tx) => {
      const pw = await ensureWalletForOwner({ ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" }, tx);
      await ensureLedgerAccount({ walletId: pw.id, code: "PLATFORM-CASH-CLEARING-ZAR", purpose: "CASH_CLEARING", category: "ASSET", currency: "ZAR" }, tx);
      await ensureLedgerAccount({ walletId: pw.id, code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR", purpose: "HELD", category: "LIABILITY", currency: "ZAR" }, tx);

      const rule = await tx.pricingRule.create({
        data: {
          name: `${prefix}-rule`,
          type: "FLAT",
          deliveryType: "PARCEL_DOCUMENT",
          regionId: reg.id,
          amount: new Prisma.Decimal("120.00"),
          baseFee: new Prisma.Decimal("120.00"),
          perKmRate: new Prisma.Decimal("0.00"),
          includedDistanceKm: 100,
          distanceIncrementKm: 1,
          currency: "ZAR",
          active: true,
          revision: 1,
          allowGlobalFallback: false,
        },
      });
      createdRuleId = rule.id;

      const svc = await tx.deliveryServiceDefinition.create({
        data: {
          stableKey: deliveryServiceKey,
          versionNumber: 1,
          displayName: `Standard Parcel ${prefix}`,
          status: "ACTIVE",
          effectiveFrom: new Date(Date.now() - 3600_000),
          createdByUserId: sup.id,
          pricingPolicy: {
            stableKey: deliveryServiceKey,
            displayName: `Standard Parcel ${prefix}`,
            active: true,
            turnaround: "1-2 business days",
            provinces: ["Gauteng"],
            regionIds: [reg.id],
            tariffs: {
              SMALL: { baseFee: "120.00", perKmRate: "0.00", maximumWeightKg: null, minimumCharge: null },
              MEDIUM: { baseFee: "170.00", perKmRate: "0.00", maximumWeightKg: null, minimumCharge: null },
              LARGE: { baseFee: "240.00", perKmRate: "0.00", maximumWeightKg: null, minimumCharge: null },
            },
            expectedVersion: 0,
            reason: "Closure parcel service",
          },
          coveragePolicy: { provinces: ["Gauteng"], regionIds: [reg.id] },
          slaMetadata: { turnaround: "1-2 business days" },
        },
      });
      createdServiceId = svc.id;

      await tx.parcelProfileVersion.upsert({
        where: { stableKey_versionNumber: { stableKey: "SMALL", versionNumber: 1 } },
        create: {
          stableKey: "SMALL",
          versionNumber: 1,
          displayName: "Small",
          lengthCm: 30,
          widthCm: 20,
          heightCm: 10,
          maximumWeightKg: new Prisma.Decimal("5"),
          status: "ACTIVE",
          effectiveFrom: new Date(Date.now() - 60_000),
          createdByUserId: adm.id,
        },
        update: { status: "ACTIVE" },
      });

      const existingInvalidServices = await tx.deliveryServiceDefinition.findMany({
        where: {
          stableKey: { startsWith: "CLIENT_" },
          status: "ACTIVE",
          id: { not: svc.id },
        },
        select: { id: true, pricingPolicy: true },
      });
      const invalidIds = existingInvalidServices
        .filter((row) => !DeliveryConfigurationSchema.safeParse(row.pricingPolicy).success)
        .map((row) => row.id);
      if (invalidIds.length > 0) {
        await tx.deliveryServiceDefinition.updateMany({
          where: { id: { in: invalidIds } },
          data: { status: "RETIRED" },
        });
        suspendedInvalidServiceIds.push(...invalidIds);
      }

      const permKeys = [
        "orders.read",
        "orders.status.manage",
        "payment_policies.manage",
        "cod_operations.manage",
        "notifications.audit.read",
      ];
      for (const pk of permKeys) {
        const perm = await tx.permission.upsert({
          where: { key: pk },
          update: {},
          create: { key: pk, name: pk, description: pk, category: "ADMIN" },
        });
        for (const role of [UserRole.ADMIN, UserRole.SUPER_ADMIN]) {
          await tx.rolePermission.upsert({
            where: { role_permissionId: { role, permissionId: perm.id } },
            update: {},
            create: { role, permissionId: perm.id },
          });
        }
      }

      if (!prevBankSetting) {
        await tx.systemSetting.create({
          data: {
            key: "client_cash_deposit_bank",
            type: "JSON",
            label: "Cash deposit bank",
            value: {
              bankName: "FNB",
              accountName: "KT Couriers Pty Ltd",
              accountNumber: "62000000001",
              branchCode: "250655",
              referenceHint: "Order ref",
              expectedVersion: 1,
            },
          },
        });
        createdBankSetting = true;
      } else {
        await tx.systemSetting.update({
          where: { key: "client_cash_deposit_bank" },
          data: {
            value: {
              bankName: "FNB",
              accountName: "KT Couriers Pty Ltd",
              accountNumber: "62000000001",
              branchCode: "250655",
              referenceHint: "Order ref",
              expectedVersion: 1,
            },
          },
        });
      }
      const bankLog = await tx.adminActivityLog.create({
        data: {
          actorUserId: adm.id,
          action: "UPDATE",
          entityType: "SystemSetting",
          entityId: "client_cash_deposit_bank",
          message: "Seeded isolated closure bank instructions",
        },
      });
      createdBankLogId = bankLog.id;

      // Seed scoped DIGITAL policy strictly for our test service so we never pollute global scopes
      const digitalPol = await tx.paymentMethodPolicy.create({
        data: {
          deliveryServiceId: deliveryServiceKey,
          orderType: "PARCEL_DOCUMENT",
          provinceScope: ["Gauteng"],
          versionNumber: 1,
          status: "ACTIVE",
          mode: "DIGITAL",
          effectiveFrom: new Date(Date.now() - 3600_000),
          createdByUserId: sup.id,
        },
      });
      createdPolicyIds.push(digitalPol.id);
    });
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    if (!safetyChecked) return;
    if (gautengRegion?.id) {
      await prisma.deliveryRegion.updateMany({
        where: { id: gautengRegion.id },
        data: { active: false, pricingEnabled: false },
      });
    }
    if (createdPolicyIds.length) {
      await prisma.paymentMethodPolicy.deleteMany({
        where: { deliveryServiceId: deliveryServiceKey },
      });
    }
    if (createdServiceId) {
      await prisma.deliveryServiceDefinition.deleteMany({
        where: { id: createdServiceId },
      });
    }
    if (createdRuleId) {
      await prisma.pricingRule.updateMany({
        where: { id: createdRuleId },
        data: { active: false },
      });
    }
    if (createdBankLogId) {
      await prisma.adminActivityLog.deleteMany({ where: { id: createdBankLogId } });
    }
    if (createdBankSetting) {
      await prisma.systemSetting.deleteMany({ where: { key: "client_cash_deposit_bank" } });
    } else if (prevBankSetting) {
      await prisma.systemSetting.updateMany({
        where: { key: "client_cash_deposit_bank" },
        data: { value: prevBankSetting.value },
      });
    }
  });

  async function bookParcelOrder(opts: {
    paymentMethod: "DIGITAL_ONLY" | "DEPOSIT_PLUS_COD";
    recipientName: string;
    recipientPhone: string;
    recipientEmail?: string;
  }) {
    const publicQuote = await createPublicQuote({
      serviceKey: deliveryServiceKey,
      parcelSize: "SMALL",
      weightKg: "1.5",
      pickupAddress: {
        line1: "10 Commissioner Street",
        suburb: "Sandton",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "2196",
      },
      dropoffAddress: {
        line1: "250 Paul Kruger Street",
        suburb: "Hatfield",
        city: "Pretoria",
        province: "Gauteng",
        postalCode: "0028",
      },
    });
    const quoteRow = await prisma.pricingQuote.findUniqueOrThrow({ where: { id: publicQuote.id } });
    const bookingMeta = (
      quoteRow.metadata as {
        bookingInput: {
          deliveryType: "PARCEL_DOCUMENT";
          pickupAddress: Record<string, unknown>;
          dropoffAddress: Record<string, unknown>;
          actualWeightKg: string;
        };
      }
    ).bookingInput;

    const order = await prisma.$transaction(async (tx) => {
      await tx.pricingQuote.update({
        where: { id: publicQuote.id },
        data: { ownerId: customerUser.id, ownerType: "CUSTOMER", storeId: null },
      });
      return createOrder(
        customerUser,
        {
          deliveryType: "PARCEL_DOCUMENT",
          pickupAddress: bookingMeta.pickupAddress as Parameters<typeof createOrder>[1]["pickupAddress"],
          dropoffAddress: bookingMeta.dropoffAddress as Parameters<typeof createOrder>[1]["dropoffAddress"],
          actualWeightKg: bookingMeta.actualWeightKg,
          pricingQuoteId: publicQuote.id,
          recipientName: opts.recipientName,
          recipientPhone: opts.recipientPhone,
          recipientEmail: opts.recipientEmail,
          parcelCount: 1,
          paymentMethod: opts.paymentMethod,
        },
        false,
        tx,
      );
    });
    return { quote: publicQuote, order };
  }

  function mockPaystackRegistry(merchantReferenceCapture: { value?: string }): PaymentProviderRegistry {
    const mockClient = {
      initializeTransaction: async (input: { reference: string }) => {
        merchantReferenceCapture.value = input.reference;
        return {
          authorization_url: "https://checkout.paystack.com/disposable-session-abc",
          access_code: "access_disposable",
          reference: input.reference,
        };
      },
    } as unknown as PaystackClient;
    const adapter = new PaystackAdapter(
      {
        mode: "test",
        environment: "sandbox",
        secretKey: "sk_test_disposable_mock_key_0000",
        appOrigin: "http://127.0.0.1:3000",
        apiBaseUrl: "https://api.paystack.co",
        credentialVersion: "test-v1",
        checkoutAuditVersion: "paystack-redirect-v1",
        configurationFingerprint: "paystack-v1:sandbox",
        eftChannelEnabled: false,
      },
      mockClient,
    );
    return { getAdapter: () => adapter } as unknown as PaymentProviderRegistry;
  }

  it("PAY-01..06: keeps digital bookings PENDING with 24h deadline, blocks ADMIN/SUPER_ADMIN manual confirm, and confirms atomically via Paystack Verify API", async () => {
    const { order } = await bookParcelOrder({
      recipientName: "Jane Doe",
      recipientPhone: "+27821112222",
      recipientEmail: "jane@example.test",
      paymentMethod: "DIGITAL_ONLY",
    });

    expect(order.status).toBe(OrderStatus.PENDING);
    expect(order.paymentDueAt).not.toBeNull();
    const diffHours =
      (new Date(order.paymentDueAt!).getTime() - new Date(order.createdAt).getTime()) / 3_600_000;
    expect(diffHours).toBeCloseTo(24, 1);

    const pendingCustomerIntent = await prisma.notificationEventIntent.findUnique({
      where: { operationId: `courier-booking-pending:${order.id}` },
    });
    expect(pendingCustomerIntent).not.toBeNull();
    const falseConfirmedIntent = await prisma.notificationEventIntent.findUnique({
      where: { operationId: `legacy-order-confirmed:${order.id}` },
    });
    expect(falseConfirmedIntent).toBeNull();

    // P0-01: Admin & SuperAdmin CANNOT manually override PENDING -> CONFIRMED
    const adminAttempt = await updateAdminOrderStatus(adminUser, order.id, {
      status: OrderStatus.CONFIRMED,
      note: "Trying manual override",
    });
    expect("error" in adminAttempt && adminAttempt.reasonCode).toBe("PAYMENT_PENDING");

    await expect(
      prisma.$transaction((tx) =>
        transitionOrderStatusInTx(tx, {
          orderId: order.id,
          toStatus: OrderStatus.CONFIRMED,
          actorUserId: superAdminUser.id,
          actorRole: UserRole.SUPER_ADMIN,
          reason: "Superadmin override check",
          context: { allowAdminOverride: true, reason: "Superadmin override check" },
        }),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN", reasonCode: "PAYMENT_PENDING" });

    const prepared = await prepareOrderPayment(customerUser, {
      orderId: order.id,
      idempotencyKey: `prep-${randomUUID()}`,
    });
    const paymentRow = await prisma.payment.findUniqueOrThrow({
      where: { publicReference: prepared.publicReference },
    });
    const refCap: { value?: string } = {};
    const session = await createProviderCheckoutSession(
      { id: customerUser.id },
      { paymentId: paymentRow.id, provider: "PAYSTACK", idempotencyKey: `sess-${randomUUID()}` },
      { registry: mockPaystackRegistry(refCap) },
    );
    expect(session.attempt.merchantReference).toBe(refCap.value);

    const verifyClient = {
      verifyTransaction: vi.fn().mockResolvedValue({
        id: 777001,
        status: "success",
        reference: session.attempt.merchantReference,
        amount: Math.round(Number(prepared.amount) * 100),
        currency: "ZAR",
      }),
    };

    const recovery = await recoverPaystackAttemptViaVerify({
      attemptId: session.attempt.id,
      trigger: "integration_test_verify",
      clientOverride: verifyClient as never,
    });
    expect(recovery.recovered).toBe(true);
    expect(recovery.outcome).toBe("SETTLED_VIA_VERIFY");

    const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updatedOrder.status).toBe(OrderStatus.CONFIRMED);

    const settledPayment = await prisma.payment.findUniqueOrThrow({
      where: { publicReference: prepared.publicReference },
      include: { successLedgerJournal: true },
    });
    expect(settledPayment.status).toBe("SUCCEEDED");
    expect(settledPayment.successLedgerJournal?.type).toBe("EXTERNAL_PAYMENT_RECEIPT");

    expect(
      await prisma.notificationEventIntent.findUnique({
        where: { operationId: `courier-payment-confirmed:${order.id}:${prepared.publicReference}` },
      }),
    ).not.toBeNull();
    expect(
      await prisma.notificationEventIntent.findUnique({
        where: { operationId: `courier-accepted:${order.id}` },
      }),
    ).not.toBeNull();

    const overview = await listAdminAlertOverview({ limit: 50 });
    expect(
      overview.events.some(
        (e) => e.eventType === "PARCEL_ORDER_ACCEPTED" && e.summary.includes(prepared.publicReference),
      ),
    ).toBe(true);
  });

  it("COD-01..05: approves scoped 50/50 personal-parcel DEPOSIT_PLUS_COD with maker/checker, blocks pre-deposit confirm, and auto-accepts after verified deposit", async () => {
    const draft = await savePaymentConfiguration(adminUser, {
      storeId: null,
      deliveryServiceId: deliveryServiceKey,
      provinces: ["Gauteng"],
      regionId: null,
      orderId: null,
      orderType: "PARCEL_DOCUMENT",
      mode: "DEPOSIT_PLUS_COD",
      depositPercent: "0.5",
      maximumCodAmount: "500.00",
      active: true,
      expectedVersion: 1,
      reason: "Scoped 50/50 personal parcel Gauteng COD approval test",
    });

    const approved = await approvePaymentConfiguration(superAdminUser, {
      policyId: draft.id,
      expectedVersion: draft.version,
      remittanceVerified: true,
      settlementTiming: "Daily bank remittance within 24h",
      reason: "Independent superadmin approval for 50/50 personal parcel COD",
    });
    createdPolicyIds.push(draft.id, approved.id);

    const breakdown = await resolvePaymentBreakdown({
      storeId: null,
      orderType: "PARCEL_DOCUMENT",
      deliveryServiceKey,
      provinces: ["Gauteng"],
      regionId: gautengRegion.id,
      originLocality: { city: "Johannesburg", suburb: "Sandton", province: "Gauteng" },
      destinationLocality: { city: "Pretoria", suburb: "Hatfield", province: "Gauteng" },
      authoritativeTotal: "120.00",
    });
    expect(breakdown).toMatchObject({
      mode: "DEPOSIT_PLUS_COD",
      digitalRequired: "60.00",
      cashRequired: "60.00",
    });

    const { order: codOrder } = await bookParcelOrder({
      recipientName: "COD Receiver",
      recipientPhone: "+27823334444",
      recipientEmail: "cod@example.test",
      paymentMethod: "DEPOSIT_PLUS_COD",
    });

    expect(codOrder.status).toBe(OrderStatus.PENDING);
    expect(codOrder.paymentDueAt).not.toBeNull();

    const preDepositAttempt = await updateAdminOrderStatus(adminUser, codOrder.id, {
      status: OrderStatus.CONFIRMED,
      note: "Attempt manual confirm before deposit",
    });
    expect("error" in preDepositAttempt && preDepositAttempt.reasonCode).toBe("COD_DEPOSIT_PENDING");

    const depPay = await prepareOrderPayment(customerUser, {
      orderId: codOrder.id,
      idempotencyKey: `dep-${randomUUID()}`,
    });
    expect(depPay.amount).toBe("60.00");
    const dbPay = await prisma.payment.findUniqueOrThrow({ where: { publicReference: depPay.publicReference } });
    const refCap: { value?: string } = {};
    const depSess = await createProviderCheckoutSession(
      { id: customerUser.id },
      { paymentId: dbPay.id, provider: "PAYSTACK", idempotencyKey: `dep-sess-${randomUUID()}` },
      { registry: mockPaystackRegistry(refCap) },
    );

    const depRecovery = await recoverPaystackAttemptViaVerify({
      attemptId: depSess.attempt.id,
      trigger: "integration_cod_deposit_verify",
      clientOverride: {
        verifyTransaction: vi.fn().mockResolvedValue({
          id: 888001,
          status: "success",
          reference: depSess.attempt.merchantReference,
          amount: 6000,
          currency: "ZAR",
        }),
      } as never,
    });
    expect(depRecovery.recovered).toBe(true);

    const confirmedCodOrder = await prisma.order.findUniqueOrThrow({
      where: { id: codOrder.id },
      include: { cashOnDelivery: true },
    });
    expect(confirmedCodOrder.status).toBe(OrderStatus.CONFIRMED);
    expect(confirmedCodOrder.cashOnDelivery?.status).toBe("READY_FOR_COLLECTION");
    expect(confirmedCodOrder.cashOnDelivery?.digitalPaid.toFixed(2)).toBe("60.00");
    expect(confirmedCodOrder.cashOnDelivery?.cashObligation.toFixed(2)).toBe("60.00");
  });

  it("EXP-01..07: enforces 24h expiry strictly, preserves historic null & <24h orders, releases split wallet & COD, and supports registered DRY_RUN + APPLY processor", async () => {
    const t0 = new Date("2026-11-18T10:00:00.000Z");
    const tBefore24 = new Date("2026-11-19T09:59:00.000Z");
    const tAfter24 = new Date("2026-11-19T10:01:00.000Z");

    let customerAvailableAccountId = "";
    await prisma.$transaction(async (tx) => {
      const cashClearing = await tx.ledgerAccount.findFirstOrThrow({
        where: { code: "PLATFORM-CASH-CLEARING-ZAR" },
      });
      const custAvail = await ensureWalletAvailableAccountInTx(tx, {
        ownerType: "CUSTOMER",
        ownerId: customerUser.id,
      });
      customerAvailableAccountId = custAvail.id;
      await postLedgerJournalWithinTransaction(tx, {
        idempotencyKey: `grant-${prefix}`,
        type: "ACCOUNT_TRANSFER",
        currency: "ZAR",
        sourceReference: `GRANT:${prefix}`,
        memo: "Test wallet seed",
        actor: { kind: "SYSTEM" },
        entries: [
          { accountId: cashClearing.id, direction: "DEBIT", amount: "40.00", lineCode: "SEED_CASH_DEBIT" },
          { accountId: custAvail.id, direction: "CREDIT", amount: "40.00", lineCode: "SEED_CUSTOMER_WALLET_CREDIT" },
        ],
      });
    });

    const { quote: qExpired, order: overdueOrder } = await bookParcelOrder({
      recipientName: "Expired Booking",
      recipientPhone: "+27825556666",
      paymentMethod: "DIGITAL_ONLY",
    });

    const splitPrep = await prepareOrderPayment(customerUser, {
      orderId: overdueOrder.id,
      idempotencyKey: `split-exp-${randomUUID()}`,
      walletAmount: "40.00",
    });
    expect(splitPrep.amount).toBe(
      new Prisma.Decimal(qExpired.total).sub("40.00").toFixed(2),
    );

    const custAvailAcc = await prisma.ledgerAccount.findUniqueOrThrow({
      where: { id: customerAvailableAccountId },
    });
    expect(custAvailAcc.currentBalance.toFixed(2)).toBe("0.00");

    const dueOverdue = new Date(t0.getTime() + 24 * 3600_000);
    await prisma.order.update({
      where: { id: overdueOrder.id },
      data: { createdAt: t0, paymentDueAt: dueOverdue },
    });

    const { order: historicOrder } = await bookParcelOrder({
      recipientName: "Historic Null",
      recipientPhone: "+27827778888",
      paymentMethod: "DIGITAL_ONLY",
    });
    await prisma.order.update({
      where: { id: historicOrder.id },
      data: { paymentDueAt: null },
    });

    const preWindow = await expireUnpaidCourierOrdersBatch({ mode: "APPLY", now: tBefore24 });
    expect(preWindow.expiredOrderIds).not.toContain(overdueOrder.id);

    const dryRunRes = await executeRegisteredProcessor({
      name: "expire-unpaid-courier-orders",
      partition: `test-${randomUUID()}`,
      mode: "DRY_RUN",
      operationId: `dry-${randomUUID()}`,
    });
    expect(dryRunRes.success).toBe(true);
    expect(dryRunRes.status).toBe("DRY_RUN_COMPLETED");

    const applyRes = await expireUnpaidCourierOrdersBatch({ mode: "APPLY", now: tAfter24 });
    expect(applyRes.expiredOrderIds).toContain(overdueOrder.id);
    expect(applyRes.expiredOrderIds).not.toContain(historicOrder.id);

    const [freshOverdue, freshHistoric, freshAvail] = await Promise.all([
      prisma.order.findUniqueOrThrow({ where: { id: overdueOrder.id }, include: { parcelCancellationResolution: true } }),
      prisma.order.findUniqueOrThrow({ where: { id: historicOrder.id } }),
      prisma.ledgerAccount.findUniqueOrThrow({ where: { id: customerAvailableAccountId } }),
    ]);

    expect(freshOverdue.status).toBe(OrderStatus.CANCELLED);
    expect(freshOverdue.parcelCancellationResolution?.status).toBe("COMPLETED_UNPAID_CANCELLED");
    expect(freshHistoric.status).toBe(OrderStatus.PENDING);
    expect(freshAvail.currentBalance.toFixed(2)).toBe("40.00");

    expect(
      await prisma.notificationEventIntent.findUnique({
        where: { operationId: `courier-unpaid-cancelled:${overdueOrder.id}` },
      }),
    ).not.toBeNull();
    expect(
      await prisma.notificationEventIntent.findUnique({
        where: { operationId: `admin-alert:PARCEL_ORDER_UNPAID_EXPIRED:parcel-expiry:${overdueOrder.id}` },
      }),
    ).not.toBeNull();

    const replayRes = await expireUnpaidCourierOrdersBatch({ mode: "APPLY", now: tAfter24 });
    expect(replayRes.expiredOrderIds).not.toContain(overdueOrder.id);
  });
});
