import { createHmac, randomInt, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { OrderAssignmentStatus, OrderStatus, UserRole, UserStatus } from "@/types/db";
import { ADMIN_ALERT_EVENT_TYPES } from "@/lib/settings/admin-alert-recipient-policy";
import {
  dispatchAdminAlertsForEvent,
  retryPendingAdminAlertDeliveries,
} from "@/lib/notifications/admin-alert-dispatch.service";
import type { NotificationProvider } from "@/lib/notifications/providers";
import { POST as resendWebhookPost } from "@/app/api/webhooks/resend/route";
import { recoverPendingResendWebhooks } from "@/lib/notifications/resend-webhook.service";
import { updateSettingValue } from "@/lib/services/admin-settings.service";
import {
  prepareRequiredDomainNotifications,
  reviewRequiredDomainNotification,
} from "@/lib/notifications/required-domain-configuration";
import { consumeCustomerOrderNotifications } from "@/lib/notifications/customer-order-publication";
import { prepareOrderPayment } from "@/lib/services/payment-preparation.service";
import { createProviderCheckoutSession } from "@/lib/services/payment-provider-session.service";
import { recoverPaystackAttemptViaVerify } from "@/lib/services/paystack-verify-recovery.service";
import {
  applyPaystackWebhookEventsBatch,
  ingestPaystackWebhook,
} from "@/lib/services/paystack-webhook-application.service";
import { createApprovedDriverEvidence } from "./phase7-5-fixtures";
import { createOrder } from "@/lib/services/orders.service";
import { createPublicQuote } from "@/lib/client-platform/delivery.service";
import {
  savePaymentConfiguration,
  approvePaymentConfiguration,
} from "@/lib/client-platform/payment-configuration.service";
import {
  ensureWalletForOwner,
  ensureLedgerAccount,
} from "@/lib/services/wallet-account.service";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";
import {
  driverCashSummary,
  reviewDriverDeposit,
  submitDriverDeposit,
} from "@/lib/client-platform/driver-cash.service";
import { recordCashCollection, reconcileCashCollection } from "@/lib/services/cash-on-delivery.service";
import { adminManualDeliveryComplete } from "@/lib/services/delivery-execution.service";
import { updateAdminOrderStatus } from "@/lib/services/admin-orders.service";
import { reportCodPhysicalDeliveryException, reviewCodPhysicalDeliveryException } from "@/lib/services/cod-physical-delivery-exception.service";
import {
  acceptDispatchAssignment,
  offerAssignment,
} from "@/lib/services/dispatch-assignment.service";
import { DriverCashRemittanceOverdueError } from "@/lib/services/driver-cash-capacity.service";
import { computeDriverCashRemittanceDueAt } from "@/lib/services/driver-cash-overdue-policy";
import { executeRegisteredProcessor } from "@/lib/processors/processor-service";
import { scanUnassignedCourierOrdersBatch } from "@/lib/services/unassigned-order-escalation.service";
import { creditCustomerWalletBySuperAdmin } from "@/lib/services/admin-customer-wallet-grant.service";
import { createRefundRequest } from "@/lib/services/refund-request.service";
import { approveRefund } from "@/lib/services/refund-finance-review.service";
import { completeRefundToCustomerWallet } from "@/lib/services/refund-wallet-completion.service";
import { openRefundReconciliationCase } from "@/lib/services/refund-provider-execution.service";
import { adjustCustomerLoyaltyPoints } from "@/lib/rewards/customer-loyalty-admin.service";
import { redeemCustomerLoyaltyPoints } from "@/lib/rewards/customer-loyalty-redemption.service";
import { reconcileCompletedParcelLoyalty } from "@/lib/rewards/customer-parcel-loyalty.service";
import { awardVerifiedOrdinaryReferral } from "@/lib/rewards/ordinary-referral-award.service";
import { DeliveryConfigurationSchema } from "@/lib/client-platform/contracts";
import { PaystackAdapter } from "@/lib/payments/providers/paystack/paystack-adapter";
import type { PaystackClient } from "@/lib/payments/providers/paystack/paystack-client";
import type { PaymentProviderRegistry } from "@/lib/payments/providers/payment-provider-registry";

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ value: "c".repeat(64) }),
    set: vi.fn(),
  }),
}));

vi.mock("@/lib/notifications/production-readiness", () => ({
  NOTIFICATION_PRODUCTION_VALIDATION_APPROVED: true,
  assertNotificationProductionReady: () => {},
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

function mockPaystackRegistry(
  capturedRef?: { value?: string },
  opts?: { production?: boolean },
): PaymentProviderRegistry {
  const mockClient = {
    initializeTransaction: async (input: { reference: string }) => {
      if (capturedRef) capturedRef.value = input.reference;
      return {
        authorization_url: "https://checkout.paystack.com/audit-disposable-session",
        access_code: "access_audit_disposable",
        reference: input.reference,
      };
    },
  } as unknown as PaystackClient;
  const isProd = opts?.production === true;
  const adapter = new PaystackAdapter(
    {
      mode: isProd ? "live" : "test",
      environment: isProd ? "production" : "sandbox",
      secretKey: isProd ? "sk_live_audit_disposable_0000" : "sk_test_audit_disposable_0000",
      appOrigin: "http://127.0.0.1:3000",
      apiBaseUrl: "https://api.paystack.co",
      credentialVersion: isProd ? "live-v1" : "test-v1",
      checkoutAuditVersion: "paystack-redirect-v1",
      configurationFingerprint: isProd ? "paystack-v1:production" : "paystack-v1:sandbox",
      eftChannelEnabled: false,
    },
    mockClient,
  );
  return {
    getAdapter: () => adapter,
  } as unknown as PaymentProviderRegistry;
}

function signSvixWebhook(secretRaw: string, svixId: string, svixTimestamp: string, payload: string): string {
  const secretBytes = Buffer.from(secretRaw.replace(/^whsec_/, ""), "base64");
  const digest = createHmac("sha256", secretBytes)
    .update(`${svixId}.${svixTimestamp}.${payload}`)
    .digest("base64");
  return `v1,${digest}`;
}

describe("KT Couriers Targeted Audit Remediation Closure (PostgreSQL + Providers)", () => {
  const prefix = `aud${randomUUID().replace(/-/g, "").slice(0, 8)}`;
  const svixSecret = `whsec_${Buffer.from("kt-courier-audit-resend-webhook-key-32").toString("base64")}`;
  let customerUser!: { id: string; email: string; name: string; role: UserRole; status: UserStatus };
  let customerUser2!: { id: string; email: string; name: string; role: UserRole; status: UserStatus };
  let adminUser!: { id: string; email: string; name: string; role: UserRole; status: UserStatus };
  let foreignAdminUser!: { id: string; email: string; name: string; role: UserRole; status: UserStatus };
  let settingsAdminUser!: { id: string; email: string; name: string; role: UserRole; status: UserStatus };
  let superAdminUser!: { id: string; email: string; name: string; role: UserRole; status: UserStatus };
  let gautengRegion!: { id: string; name: string };
  const deliveryServiceKey = `CLIENT_${prefix.toUpperCase()}`;
  let createdRuleId: string | null = null;
  let createdServiceId: string | null = null;
  const suspendedInvalidServiceIds: string[] = [];
  const createdPolicyIds: string[] = [];
  const createdOrderIds: string[] = [];
  let intentSnapshot = new Set<string>();
  let routeVersionSnapshot = new Set<string>();
  let prevRecipientSetting: { value: Prisma.InputJsonValue | typeof Prisma.JsonNull } | null = null;
  let prevBankSetting: { value: Prisma.InputJsonValue | typeof Prisma.JsonNull } | null = null;
  let prevLoyaltyConvSetting: { value: Prisma.InputJsonValue | typeof Prisma.JsonNull } | null = null;
  let prevReferralIssuingSetting: { value: Prisma.InputJsonValue | typeof Prisma.JsonNull } | null = null;

  beforeEach(() => {
    vi.stubEnv("PAYMENT_APP_ORIGIN", "http://127.0.0.1:3000");
    vi.stubEnv("REFUNDS_PRODUCTION_ACTIVATED", "true");
    vi.stubEnv("NOTIFICATION_PRODUCTION_VALIDATION_APPROVED", "true");
    vi.stubEnv("RESEND_WEBHOOK_SECRET", svixSecret);
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

    const [existingRecips, existingBank, existingLoyalty, existingReferral, intentRows, routeVersionRows] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: "notifications.admin_alert_recipients" }, select: { value: true } }),
      prisma.systemSetting.findUnique({ where: { key: "client_cash_deposit_bank" }, select: { value: true } }),
      prisma.systemSetting.findUnique({ where: { key: "loyalty.conversion_enabled" }, select: { value: true } }),
      prisma.systemSetting.findUnique({ where: { key: "referral.reward_issuing_enabled" }, select: { value: true } }),
      prisma.notificationEventIntent.findMany({ select: { id: true } }),
      prisma.notificationEventRouteVersion.findMany({ select: { id: true } }),
    ]);
    intentSnapshot = new Set(intentRows.map((row) => row.id));
    routeVersionSnapshot = new Set(routeVersionRows.map((row) => row.id));

    // Mark any un-dispatched ADMIN_ALERT domain intents left behind by prior suites in
    // the shared disposable database as dispatched so DEFECT-1 retry tests stay isolated.
    const priorAdminDomainIntents = await prisma.notificationEventIntent.findMany({
      where: {
        sourceAuthority: "ADMIN_ALERT",
        operationId: { startsWith: "admin-alert:" },
      },
    });
    for (const row of priorAdminDomainIntents) {
      const p =
        row.safePayload && typeof row.safePayload === "object" && !Array.isArray(row.safePayload)
          ? (row.safePayload as Record<string, unknown>)
          : null;
      if (p && p.kind === "DOMAIN_EVENT" && !p.dispatchedAt) {
        await prisma.notificationEventIntent.update({
          where: { id: row.id },
          data: {
            safePayload: {
              ...p,
              dispatchedAt: new Date().toISOString(),
            } as Prisma.InputJsonValue,
          },
        });
      }
    }
    if (existingRecips) {
      prevRecipientSetting = {
        value: existingRecips.value === null ? Prisma.JsonNull : (existingRecips.value as Prisma.InputJsonValue),
      };
    }
    if (existingBank) {
      prevBankSetting = {
        value: existingBank.value === null ? Prisma.JsonNull : (existingBank.value as Prisma.InputJsonValue),
      };
    }
    if (existingLoyalty) {
      prevLoyaltyConvSetting = {
        value: existingLoyalty.value === null ? Prisma.JsonNull : (existingLoyalty.value as Prisma.InputJsonValue),
      };
    }
    if (existingReferral) {
      prevReferralIssuingSetting = {
        value: existingReferral.value === null ? Prisma.JsonNull : (existingReferral.value as Prisma.InputJsonValue),
      };
    }

    const [cust, cust2, adm, foreignAdm, settingsAdm, sup, reg] = await Promise.all([
      prisma.user.create({
        data: {
          email: `${prefix}-cust@example.test`,
          name: "Audit Customer",
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.user.create({
        data: {
          email: `${prefix}-cust2@example.test`,
          name: "Audit Referred Customer",
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.user.create({
        data: {
          email: `${prefix}-admin@ktcouriers.co.za`,
          name: "Audit Admin",
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.user.create({
        data: {
          email: `${prefix}-foreign-admin@ktcouriers.co.za`,
          name: "Foreign Admin No Settings",
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.user.create({
        data: {
          email: `${prefix}-settings-admin@ktcouriers.co.za`,
          name: "Settings Admin With Perm",
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.user.create({
        data: {
          email: `${prefix}-super@ktcouriers.co.za`,
          name: "Audit SuperAdmin",
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
    customerUser2 = { id: cust2.id, email: cust2.email, name: cust2.name ?? "", role: cust2.role, status: cust2.status };
    adminUser = { id: adm.id, email: adm.email, name: adm.name ?? "", role: adm.role, status: adm.status };
    foreignAdminUser = { id: foreignAdm.id, email: foreignAdm.email, name: foreignAdm.name ?? "", role: foreignAdm.role, status: foreignAdm.status };
    settingsAdminUser = { id: settingsAdm.id, email: settingsAdm.email, name: settingsAdm.name ?? "", role: settingsAdm.role, status: settingsAdm.status };
    superAdminUser = { id: sup.id, email: sup.email, name: sup.name ?? "", role: sup.role, status: sup.status };
    gautengRegion = { id: reg.id, name: reg.name };

    await prisma.$transaction(async (tx) => {
      const pw = await ensureWalletForOwner({ ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" }, tx);
      const clearing = await ensureLedgerAccount({ walletId: pw.id, code: "PLATFORM-CASH-CLEARING-ZAR", purpose: "CASH_CLEARING", category: "ASSET", currency: "ZAR" }, tx);
      await ensureLedgerAccount({ walletId: pw.id, code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR", purpose: "HELD", category: "LIABILITY", currency: "ZAR" }, tx);
      await ensureLedgerAccount({ walletId: pw.id, code: "PLATFORM-REFUND-HELD-GUEST-ZAR", purpose: "CUSTOMER_REFUND_HELD", category: "LIABILITY", currency: "ZAR" }, tx);
      const equity = await ensureLedgerAccount({ walletId: pw.id, code: "PLATFORM-ADJUSTMENT-ZAR", purpose: "ADJUSTMENT", category: "EQUITY", currency: "ZAR" }, tx);
      await postLedgerJournalWithinTransaction(tx, {
        idempotencyKey: `aud-seed-clearing:${prefix}`,
        type: "GENERAL",
        currency: "ZAR",
        sourceReference: `AUDIT_SEED:${prefix}`,
        memo: "Seed clearing",
        actor: { kind: "SYSTEM" },
        entries: [
          { accountId: clearing.id, direction: "DEBIT", amount: "10000.00", lineCode: "CASH_SEED_DEBIT" },
          { accountId: equity.id, direction: "CREDIT", amount: "10000.00", lineCode: "EQUITY_SEED_CREDIT" },
        ],
      });

      const rule = await tx.pricingRule.create({
        data: {
          name: `${prefix}-odd-cent-rule`,
          type: "FLAT",
          deliveryType: "PARCEL_DOCUMENT",
          regionId: reg.id,
          amount: new Prisma.Decimal("101.01"),
          baseFee: new Prisma.Decimal("101.01"),
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
          displayName: `Audit Standard ${prefix}`,
          status: "ACTIVE",
          effectiveFrom: new Date(Date.now() - 3600_000),
          createdByUserId: sup.id,
          pricingPolicy: {
            stableKey: deliveryServiceKey,
            displayName: `Audit Standard ${prefix}`,
            active: true,
            turnaround: "1-2 business days",
            provinces: ["Gauteng"],
            regionIds: [reg.id],
            tariffs: {
              SMALL: { baseFee: "101.01", perKmRate: "0.00", maximumWeightKg: null, minimumCharge: null },
              MEDIUM: { baseFee: "170.00", perKmRate: "0.00", maximumWeightKg: null, minimumCharge: null },
              LARGE: { baseFee: "240.00", perKmRate: "0.00", maximumWeightKg: null, minimumCharge: null },
            },
            expectedVersion: 0,
            reason: "Audit parcel service",
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
        where: { stableKey: { startsWith: "CLIENT_" }, status: "ACTIVE", id: { not: svc.id } },
        select: { id: true, pricingPolicy: true },
      });
      const invalidIds = existingInvalidServices
        .filter((row) => !DeliveryConfigurationSchema.safeParse(row.pricingPolicy).success)
        .map((row) => row.id);
      if (invalidIds.length > 0) {
        await tx.deliveryServiceDefinition.updateMany({ where: { id: { in: invalidIds } }, data: { status: "RETIRED" } });
        suspendedInvalidServiceIds.push(...invalidIds);
      }

      const permKeys = [
        "orders.read",
        "orders.status.manage",
        "dispatch.manage",
        "payment_policies.manage",
        "cod_operations.manage",
        "notifications.audit.read",
        "notifications.delivery.retry",
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
      const settingsPerm = await tx.permission.upsert({
        where: { key: "settings.update" },
        update: {},
        create: { key: "settings.update", name: "settings.update", description: "settings.update", category: "ADMIN" },
      });
      await tx.rolePermission.upsert({
        where: { role_permissionId: { role: UserRole.SUPER_ADMIN, permissionId: settingsPerm.id } },
        update: {},
        create: { role: UserRole.SUPER_ADMIN, permissionId: settingsPerm.id },
      });
      await tx.userPermission.upsert({
        where: { userId_permissionId: { userId: settingsAdm.id, permissionId: settingsPerm.id } },
        update: { effect: "ALLOW" },
        create: { userId: settingsAdm.id, permissionId: settingsPerm.id, effect: "ALLOW", createdByUserId: sup.id, reason: "Audit settings BOLA check" },
      });
      // Explicit deny on foreignAdminUser so even role changes cannot grant settings.update
      await tx.userPermission.upsert({
        where: { userId_permissionId: { userId: foreignAdm.id, permissionId: settingsPerm.id } },
        update: { effect: "DENY" },
        create: { userId: foreignAdm.id, permissionId: settingsPerm.id, effect: "DENY", createdByUserId: sup.id, reason: "Audit foreign admin deny" },
      });

      const bankValue = {
        bankName: "FNB",
        accountName: "KT Couriers Pty Ltd",
        accountNumber: "62000000001",
        branchCode: "250655",
        referenceHint: "Order ref",
        handoverEnabled: false,
        expectedVersion: 1,
      };
      await tx.systemSetting.upsert({
        where: { key: "client_cash_deposit_bank" },
        update: { value: bankValue },
        create: { key: "client_cash_deposit_bank", type: "JSON", label: "Cash deposit bank", value: bankValue },
      });
      await tx.adminActivityLog.create({
        data: {
          actorUserId: adm.id,
          action: "UPDATE",
          entityType: "SystemSetting",
          entityId: "client_cash_deposit_bank",
          message: "Seeded audit bank instructions",
        },
      });

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
    // Every row this suite created in the shared disposable database is removed
    // so later closure files observe the state they would have seen without it.
    const swallow = () => {};
    const [allIntents, allRouteVersions] = await Promise.all([
      prisma.notificationEventIntent.findMany({ select: { id: true, operationId: true } }),
      prisma.notificationEventRouteVersion.findMany({ select: { id: true } }),
    ]);
    const newIntents = allIntents.filter((row) => !intentSnapshot.has(row.id));
    const newRouteVersionIds = allRouteVersions.map((row) => row.id).filter((id) => !routeVersionSnapshot.has(id));
    const suiteUserIds = [customerUser, customerUser2, adminUser, foreignAdminUser, settingsAdminUser, superAdminUser]
      .filter(Boolean)
      .map((user) => user.id);
    if (suiteUserIds.length) {
      await prisma.notificationDelivery.deleteMany({ where: { recipientUserId: { in: suiteUserIds } } }).catch(swallow);
      await prisma.notificationInboxItem.deleteMany({ where: { ownerUserId: { in: suiteUserIds } } }).catch(swallow);
      await prisma.notificationRecipient.deleteMany({ where: { subjectUserId: { in: suiteUserIds } } }).catch(swallow);
      await prisma.notificationMessage.deleteMany({ where: { recipientUserId: { in: suiteUserIds } } }).catch(swallow);
    }
    if (newIntents.length) {
      const receipts = await prisma.notificationSourceReceipt.findMany({
        where: { sourceEventId: { in: newIntents.map((row) => row.operationId) } },
        select: { id: true },
      });
      if (receipts.length) {
        await prisma.notificationReconciliationCase.deleteMany({ where: { sourceReceiptId: { in: receipts.map((r) => r.id) } } }).catch(swallow);
        await prisma.notificationSourceReceipt.deleteMany({ where: { id: { in: receipts.map((r) => r.id) } } }).catch(swallow);
      }
      await prisma.notificationEventIntent.deleteMany({ where: { id: { in: newIntents.map((row) => row.id) } } }).catch(swallow);
    }
    if (newRouteVersionIds.length) {
      await prisma.notificationEventRouteVersion.deleteMany({ where: { id: { in: newRouteVersionIds } } }).catch(swallow);
    }
    const restoreOrDelete = async (
      key: string,
      type: "JSON" | "BOOLEAN",
      label: string,
      previous: { value: Prisma.InputJsonValue | typeof Prisma.JsonNull } | null,
    ) => {
      if (previous) {
        await prisma.systemSetting.upsert({
          where: { key },
          update: { type, value: previous.value },
          create: { key, type, label, value: previous.value },
        });
      } else {
        await prisma.systemSetting.deleteMany({ where: { key } });
      }
    };
    await restoreOrDelete("notifications.admin_alert_recipients", "JSON", "Admin alert recipients", prevRecipientSetting);
    await restoreOrDelete("client_cash_deposit_bank", "JSON", "Cash deposit bank", prevBankSetting);
    await restoreOrDelete("loyalty.conversion_enabled", "BOOLEAN", "Loyalty wallet conversion", prevLoyaltyConvSetting);
    await restoreOrDelete("referral.reward_issuing_enabled", "BOOLEAN", "Ordinary referral issuing", prevReferralIssuingSetting);
    if (gautengRegion?.id) {
      await prisma.deliveryRegion.updateMany({ where: { id: gautengRegion.id }, data: { active: false, pricingEnabled: false } });
    }
    if (createdPolicyIds.length) {
      await prisma.paymentMethodPolicy.deleteMany({ where: { deliveryServiceId: deliveryServiceKey } });
    }
    if (createdServiceId) {
      await prisma.deliveryServiceDefinition.deleteMany({ where: { id: createdServiceId } }).catch(() => {});
    }
    if (createdRuleId) {
      await prisma.pricingRule.update({ where: { id: createdRuleId }, data: { active: false } }).catch(() => {});
    }
  });

  async function setRecipients(value: unknown) {
    await prisma.systemSetting.upsert({
      where: { key: "notifications.admin_alert_recipients" },
      update: { value: value as Prisma.InputJsonValue },
      create: { key: "notifications.admin_alert_recipients", label: "Admin alert recipients", type: "JSON", value: value as Prisma.InputJsonValue },
    });
  }

  async function bookCodOrder(
    paymentMethod: "DIGITAL_ONLY" | "DEPOSIT_PLUS_COD" = "DEPOSIT_PLUS_COD",
    payer = customerUser,
  ) {
    const publicQuote = await createPublicQuote({
      serviceKey: deliveryServiceKey,
      parcelSize: "SMALL",
      weightKg: "1.5",
      pickupAddress: { line1: "10 Commissioner Street", suburb: "Sandton", city: "Johannesburg", province: "Gauteng", postalCode: "2196" },
      dropoffAddress: { line1: "250 Paul Kruger Street", suburb: "Hatfield", city: "Pretoria", province: "Gauteng", postalCode: "0028" },
    });
    const quoteRow = await prisma.pricingQuote.findUniqueOrThrow({ where: { id: publicQuote.id } });
    const bookingMeta = (quoteRow.metadata as { bookingInput: { pickupAddress: Record<string, unknown>; dropoffAddress: Record<string, unknown>; actualWeightKg: string } }).bookingInput;

    const order = await prisma.$transaction(async (tx) => {
      await tx.pricingQuote.update({
        where: { id: publicQuote.id },
        data: { ownerId: payer.id, ownerType: "CUSTOMER", storeId: null },
      });
      return createOrder(
        payer,
        {
          deliveryType: "PARCEL_DOCUMENT",
          pickupAddress: bookingMeta.pickupAddress as Parameters<typeof createOrder>[1]["pickupAddress"],
          dropoffAddress: bookingMeta.dropoffAddress as Parameters<typeof createOrder>[1]["dropoffAddress"],
          actualWeightKg: bookingMeta.actualWeightKg,
          pricingQuoteId: publicQuote.id,
          recipientName: "Split Notify",
          recipientPhone: "+27821110000",
          recipientEmail: "split-notify@example.test",
          parcelCount: 1,
          paymentMethod,
        },
        false,
        tx,
      );
    });
    createdOrderIds.push(order.id);
    return order;
  }

  async function payOrderViaVerify(
    orderId: string,
    payer = customerUser,
    opts?: { walletAmount?: string; viaWebhook?: boolean; production?: boolean },
  ) {
    const prep = await prepareOrderPayment(payer, {
      orderId,
      idempotencyKey: `aud-prep-${randomUUID()}`,
      ...(opts?.walletAmount ? { walletAmount: opts.walletAmount } : {}),
    });
    const paymentRow = await prisma.payment.findUniqueOrThrow({ where: { publicReference: prep.publicReference } });
    if (paymentRow.status === "SUCCEEDED") {
      return { prep, paymentRow, attemptId: null };
    }
    const isProd = opts?.production === true;
    const sess = await createProviderCheckoutSession(
      { id: payer.id },
      { paymentId: paymentRow.id, provider: "PAYSTACK", idempotencyKey: `aud-sess-${randomUUID()}` },
      { registry: mockPaystackRegistry(undefined, { production: isProd }) },
    );
    const minor = Math.round(Number(prep.amount) * 100);
    if (opts?.viaWebhook) {
      const secretKey = isProd ? "sk_live_audit_disposable_0000" : "sk_test_audit_disposable_0000";
      const providerId = randomInt(100_000_000, 999_999_999);
      const rawBody = JSON.stringify({
        event: "charge.success",
        data: { id: providerId, reference: sess.attempt.merchantReference, status: "success", amount: minor, currency: "ZAR" },
      });
      const signature = createHmac("sha512", secretKey).update(rawBody).digest("hex");
      await ingestPaystackWebhook({
        rawBody,
        signature,
        secretKey,
        sourceAddress: isProd ? "52.31.139.75" : undefined,
        environment: isProd ? "PRODUCTION" : "SANDBOX",
      });
      await applyPaystackWebhookEventsBatch({
        batchSize: 50,
        secretKey,
        clientOverride: {
          verifyTransaction: vi.fn().mockResolvedValue({
            id: providerId,
            status: "success",
            reference: sess.attempt.merchantReference,
            amount: minor,
            currency: "ZAR",
          }),
        } as never,
      });
    } else {
      await recoverPaystackAttemptViaVerify({
        attemptId: sess.attempt.id,
        trigger: "audit_pay_verify",
        clientOverride: {
          verifyTransaction: vi.fn().mockResolvedValue({
            id: 990000 + Math.floor(Math.random() * 10000),
            status: "success",
            reference: sess.attempt.merchantReference,
            amount: minor,
            currency: "ZAR",
          }),
        } as never,
      });
    }
    return { prep, paymentRow: await prisma.payment.findUniqueOrThrow({ where: { id: paymentRow.id } }), attemptId: sess.attempt.id };
  }

  it("DEFECT-1 (Sec 2 & 3C): enforces retry authority, DB user revocation, settings BOLA, and Svix HMAC Resend webhook receipt lifecycle", async () => {
    const t = randomUUID().slice(0, 8);
    const emailDisabled = `disabled-${t}@ktcouriers.co.za`;
    const emailDeleted = `deleted-${t}@ktcouriers.co.za`;
    const emailUnsub = `unsub-${t}@ktcouriers.co.za`;
    const emailRoleChanged = `scope-${t}@ktcouriers.co.za`;
    const emailSuspendedDb = `suspended-${t}@ktcouriers.co.za`;
    const emailProviderRecover = `recover-${t}@ktcouriers.co.za`;
    const emailAlreadyAccepted = `accepted-${t}@ktcouriers.co.za`;

    const suspendedUser = await prisma.user.create({
      data: {
        email: emailSuspendedDb,
        name: "Suspended Admin User",
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });

    await setRecipients([
      { email: emailDisabled, label: "Disabled", active: true, roleScope: "ADMIN", events: ["PARCEL_ORDER_PAID"] },
      { email: emailDeleted, label: "Deleted", active: true, roleScope: "ADMIN", events: ["PARCEL_ORDER_PAID"] },
      { email: emailUnsub, label: "Unsub", active: true, roleScope: "ADMIN", events: ["PARCEL_ORDER_PAID"] },
      { email: emailRoleChanged, label: "RoleChanged", active: true, roleScope: "ADMIN", events: ["PARCEL_ORDER_PAID"] },
      { email: emailSuspendedDb, label: "SuspendedDB", active: true, roleScope: "ADMIN", events: ["PARCEL_ORDER_PAID"] },
      { email: emailProviderRecover, label: "Recover", active: true, roleScope: "ALL", events: ["PARCEL_ORDER_PAID"] },
    ]);

    const sentLog: string[] = [];
    const providerMsgIds = new Map<string, string>();
    const okProvider: NotificationProvider = {
      channel: "EMAIL",
      name: "resend-stub",
      async send(msg) {
        sentLog.push(msg.destination);
        const id = `re_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
        providerMsgIds.set(msg.destination, id);
        return { accepted: true, providerMessageReference: id };
      },
    };
    const downProvider: NotificationProvider = {
      channel: "EMAIL",
      name: "stub-down",
      async send() {
        return { accepted: false, failureClass: "PROVIDER_UNAVAILABLE", safeCode: "DOWN", retryAfterSeconds: 0 };
      },
    };

    const refFail = `retry-rev-${t}`;
    await dispatchAdminAlertsForEvent(
      {
        eventType: "PARCEL_ORDER_PAID",
        aggregateReference: refFail,
        title: "Paid parcel",
        summary: "Verify retry authority check.",
      },
      { providerOverride: downProvider },
    );

    await setRecipients([
      { email: emailAlreadyAccepted, label: "Accepted", active: true, roleScope: "ALL", events: ["PARCEL_ORDER_PAID"] },
    ]);
    const refAccepted = `retry-acc-${t}`;
    await dispatchAdminAlertsForEvent(
      {
        eventType: "PARCEL_ORDER_PAID",
        aggregateReference: refAccepted,
        title: "Already accepted",
        summary: "Verify accepted delivery never resends.",
      },
      { providerOverride: okProvider },
    );
    const recoveredEmailIdAtAcc = providerMsgIds.get(emailAlreadyAccepted)!;
    sentLog.length = 0;

    // Suspend DB User for emailSuspendedDb & mutate settings concurrently before retry
    await prisma.user.update({ where: { id: suspendedUser.id }, data: { status: UserStatus.SUSPENDED } });
    await setRecipients([
      { email: emailDisabled, label: "Disabled", active: false, roleScope: "ADMIN", events: ["PARCEL_ORDER_PAID"] },
      { email: emailUnsub, label: "Unsub", active: true, roleScope: "ADMIN", events: ["PARCEL_ORDER_CANCELLED"] },
      { email: emailRoleChanged, label: "RoleChanged", active: true, roleScope: "SUPER_ADMIN", events: ["PARCEL_ORDER_PAID"] },
      { email: emailSuspendedDb, label: "SuspendedDB", active: true, roleScope: "ADMIN", events: ["PARCEL_ORDER_PAID"] },
      { email: emailProviderRecover, label: "Recover", active: true, roleScope: "ALL", events: ["PARCEL_ORDER_PAID"] },
      { email: emailAlreadyAccepted, label: "Accepted", active: true, roleScope: "ALL", events: ["PARCEL_ORDER_PAID"] },
    ]);

    await retryPendingAdminAlertDeliveries({
      now: new Date(Date.now() + 600_000),
      providerOverride: null,
    });
    expect(sentLog).toEqual([]);

    await retryPendingAdminAlertDeliveries({
      now: new Date(Date.now() + 1_200_000),
      providerOverride: okProvider,
    });
    expect(sentLog).toEqual([emailProviderRecover]);

    const deliveryIntents = await prisma.notificationEventIntent.findMany({
      where: {
        sourceAuthority: "ADMIN_ALERT",
        operationId: { startsWith: `admin-alert-delivery:PARCEL_ORDER_PAID:${refFail}:` },
      },
    });
    const statuses = deliveryIntents.map((d) => (d.safePayload as Record<string, unknown>).deliveryStatus);
    expect(statuses.filter((s) => s === "CANCELLED_BY_POLICY").length).toBe(5);
    expect(statuses.filter((s) => s === "PROVIDER_ACCEPTED").length).toBe(1);

    // Verify BOLA in updateSettingValue:
    const deniedNoPerm = await updateSettingValue(foreignAdminUser.id, "notifications.admin_alert_recipients", []);
    expect("error" in deniedNoPerm).toBe(true);

    // An ADMIN even WITH settings.update cannot modify SUPER_ADMIN or ALL recipient entries
    const deniedSuperScope = await updateSettingValue(settingsAdminUser.id, "notifications.admin_alert_recipients", [
      { email: "hijack@ktcouriers.co.za", label: "Hijack", active: true, roleScope: "SUPER_ADMIN", events: ["PARCEL_ORDER_PAID"] },
    ]);
    expect("error" in deniedSuperScope).toBe(true);

    // Verify Resend Webhook Svix signature enforcement & DELIVERED / BOUNCED updates
    const deliverPayload = JSON.stringify({
      type: "email.delivered",
      created_at: new Date().toISOString(),
      data: { email_id: providerMsgIds.get(emailProviderRecover), to: [emailProviderRecover] },
    });
    const badSigRes = await resendWebhookPost(new NextRequest("http://127.0.0.1/api/webhooks/resend", {
      method: "POST",
      headers: { "svix-id": `msg_${t}_1`, "svix-timestamp": String(Math.floor(Date.now() / 1000)), "svix-signature": "v1,invalid", "x-forwarded-for": "10.0.0.1" },
      body: deliverPayload,
    }));
    expect(badSigRes.status).toBe(401);

    const oldTs = String(Math.floor(Date.now() / 1000) - 600);
    const staleSigRes = await resendWebhookPost(new NextRequest("http://127.0.0.1/api/webhooks/resend", {
      method: "POST",
      headers: { "svix-id": `msg_${t}_2`, "svix-timestamp": oldTs, "svix-signature": signSvixWebhook(svixSecret, `msg_${t}_2`, oldTs, deliverPayload), "x-forwarded-for": "10.0.0.2" },
      body: deliverPayload,
    }));
    expect(staleSigRes.status).toBe(401);

    const freshTs = String(Math.floor(Date.now() / 1000));
    const svixId = `msg_${t}_ok`;
    const okRes = await resendWebhookPost(new NextRequest("http://127.0.0.1/api/webhooks/resend", {
      method: "POST",
      headers: {
        "svix-id": svixId,
        "svix-timestamp": freshTs,
        "svix-signature": signSvixWebhook(svixSecret, svixId, freshTs, deliverPayload),
        "x-forwarded-for": "10.0.0.3",
      },
      body: deliverPayload,
    }));
    expect(okRes.status).toBe(200);

    // Replay with same svix-id returns duplicate=true
    const replayRes = await resendWebhookPost(new NextRequest("http://127.0.0.1/api/webhooks/resend", {
      method: "POST",
      headers: {
        "svix-id": svixId,
        "svix-timestamp": freshTs,
        "svix-signature": signSvixWebhook(svixSecret, svixId, freshTs, deliverPayload),
        "x-forwarded-for": "10.0.0.4",
      },
      body: deliverPayload,
    }));
    expect(replayRes.status).toBe(200);
    expect(await replayRes.json()).toMatchObject({ ok: true, replayed: true });

    const updatedDelivered = deliveryIntents.length
      ? await prisma.notificationEventIntent.findFirstOrThrow({
          where: {
            sourceAuthority: "ADMIN_ALERT",
            safePayload: { path: ["providerMessageReference"], equals: providerMsgIds.get(emailProviderRecover)! },
          },
        })
      : null;
    expect((updatedDelivered?.safePayload as Record<string, unknown>)?.deliveryStatus).toBe("DELIVERED");
    expect((updatedDelivered?.safePayload as Record<string, unknown>)?.inboxDeliveryStatus).toBe("DELIVERED");

    // Bounce updates the already-accepted record
    const bouncePayload = JSON.stringify({
      type: "email.bounced",
      created_at: new Date().toISOString(),
      data: { email_id: recoveredEmailIdAtAcc, to: [emailAlreadyAccepted] },
    });
    const bounceId = `msg_${t}_bounce`;
    const bounceRes = await resendWebhookPost(new NextRequest("http://127.0.0.1/api/webhooks/resend", {
      method: "POST",
      headers: {
        "svix-id": bounceId,
        "svix-timestamp": freshTs,
        "svix-signature": signSvixWebhook(svixSecret, bounceId, freshTs, bouncePayload),
        "x-forwarded-for": "10.0.0.5",
      },
      body: bouncePayload,
    }));
    expect(bounceRes.status).toBe(200);
    const bouncedRow = await prisma.notificationEventIntent.findFirstOrThrow({
      where: {
        sourceAuthority: "ADMIN_ALERT",
        safePayload: { path: ["providerMessageReference"], equals: recoveredEmailIdAtAcc },
      },
    });
    expect((bouncedRow.safePayload as Record<string, unknown>)?.deliveryStatus).toBe("BOUNCED");
  });

  it("DEFECT-1B: enforces durable, recoverable Resend webhook inbox idempotency across failure modes (a-h) with zero financial journal mutation", async () => {
    const t = randomUUID().replace(/-/g, "").slice(0, 8);
    const nowSec = Math.floor(Date.now() / 1000);

    // Track baseline financial record counts
    const journalCountBefore = await prisma.ledgerJournal.count();
    const entryCountBefore = await prisma.ledgerEntry.count();
    const paymentCountBefore = await prisma.payment.count();
    const refundCountBefore = await prisma.paymentRefund.count();
    const codCountBefore = await prisma.cashOnDelivery.count();

    // (a) Crash after inbox insert before customer fanout
    const emailA = `re_a_${t}`;
    const svixIdA = `msg_${t}_a`;
    const delA = await prisma.notificationDelivery.create({
      data: {
        publicReference: `del-${t}-a`,
        messageId: `msg-id-${t}-a`,
        recipientUserId: customerUser.id,
        channel: "EMAIL",
        status: "PROVIDER_ACCEPTED",
        provider: "RESEND_EMAIL",
        providerMessageReference: emailA,
        renderedBody: "Order update A",
      },
    });

    const bodyA = JSON.stringify({
      type: "email.delivered",
      created_at: new Date().toISOString(),
      data: { email_id: emailA },
    });

    await prisma.$executeRawUnsafe(`CREATE FUNCTION test_resend_customer_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id = '${delA.id}' THEN RAISE EXCEPTION 'Simulated customer projection failure'; END IF; RETURN NEW; END; $$`);
    await prisma.$executeRawUnsafe('CREATE TRIGGER test_resend_customer_failure BEFORE UPDATE ON "NotificationDelivery" FOR EACH ROW EXECUTE FUNCTION test_resend_customer_failure()');

    const crashARes = await resendWebhookPost(new NextRequest("http://127.0.0.1/api/webhooks/resend", {
      method: "POST",
      headers: {
        "svix-id": svixIdA,
        "svix-timestamp": String(nowSec),
        "svix-signature": signSvixWebhook(svixSecret, svixIdA, String(nowSec), bodyA),
        "x-forwarded-for": "10.0.1.1",
      },
      body: bodyA,
    }));
    expect(crashARes.status).toBe(500);
    await prisma.$executeRawUnsafe('DROP TRIGGER test_resend_customer_failure ON "NotificationDelivery"');
    await prisma.$executeRawUnsafe('DROP FUNCTION test_resend_customer_failure()');

    // Verify inbox record remains in PROCESSING, not prematurely completed
    const inboxA = await prisma.notificationAuditEvent.findUniqueOrThrow({
      where: { publicReference: `resend-wh:${svixIdA}` },
    });
    expect(inboxA.eventType).toBe("RESEND_WEBHOOK_PROCESSING");

    // Retry succeeds and finishes the projection
    const retryARes = await resendWebhookPost(new NextRequest("http://127.0.0.1/api/webhooks/resend", {
      method: "POST",
      headers: {
        "svix-id": svixIdA,
        "svix-timestamp": String(nowSec),
        "svix-signature": signSvixWebhook(svixSecret, svixIdA, String(nowSec), bodyA),
        "x-forwarded-for": "10.0.1.2",
      },
      body: bodyA,
    }));
    expect(retryARes.status).toBe(200);
    const retryAJson = await retryARes.json();
    expect(retryAJson.ok).toBe(true);
    expect(retryAJson.replayed).toBe(false);

    const updatedDelA = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: delA.id } });
    expect(updatedDelA.status).toBe("DELIVERED");

    const finalInboxA = await prisma.notificationAuditEvent.findUniqueOrThrow({
      where: { publicReference: `resend-wh:${svixIdA}` },
    });
    expect(finalInboxA.eventType).toBe("RESEND_WEBHOOK_FULLY_APPLIED");

    vi.restoreAllMocks();

    // (b) Crash after customer fanout before admin update
    const emailB = `re_b_${t}`;
    const svixIdB = `msg_${t}_b`;
    const delB = await prisma.notificationDelivery.create({
      data: {
        publicReference: `del-${t}-b`,
        messageId: `msg-id-${t}-b`,
        recipientUserId: customerUser.id,
        channel: "EMAIL",
        status: "PROVIDER_ACCEPTED",
        provider: "RESEND_EMAIL",
        providerMessageReference: emailB,
        renderedBody: "Order update B",
      },
    });
    const intentB = await prisma.notificationEventIntent.create({
      data: {
        sourceAuthority: "ADMIN_ALERT",
        eventType: "PARCEL_ORDER_PAID",
        aggregateReference: `ref-b-${t}`,
        operationId: `admin-alert-delivery:PARCEL_ORDER_PAID:test-b-${t}:${adminUser.email}`,
        safePayload: {
          kind: "RECIPIENT_DELIVERY",
          eventType: "PARCEL_ORDER_PAID",
          providerMessageReference: emailB,
          deliveryStatus: "PROVIDER_ACCEPTED",
          inboxDeliveryStatus: "UNKNOWN_PENDING_PROVIDER_RECEIPT",
          emailLogId: null,
        },
      },
    });

    const bodyB = JSON.stringify({
      type: "email.delivered",
      created_at: new Date().toISOString(),
      data: { email_id: emailB },
    });

    await prisma.$executeRawUnsafe(`CREATE FUNCTION test_resend_admin_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id = '${intentB.id}' THEN RAISE EXCEPTION 'Simulated admin projection failure'; END IF; RETURN NEW; END; $$`);
    await prisma.$executeRawUnsafe('CREATE TRIGGER test_resend_admin_failure BEFORE UPDATE ON "NotificationEventIntent" FOR EACH ROW EXECUTE FUNCTION test_resend_admin_failure()');

    const crashBRes = await resendWebhookPost(new NextRequest("http://127.0.0.1/api/webhooks/resend", {
      method: "POST",
      headers: {
        "svix-id": svixIdB,
        "svix-timestamp": String(nowSec),
        "svix-signature": signSvixWebhook(svixSecret, svixIdB, String(nowSec), bodyB),
        "x-forwarded-for": "10.0.1.3",
      },
      body: bodyB,
    }));
    expect(crashBRes.status).toBe(500);
    await prisma.$executeRawUnsafe('DROP TRIGGER test_resend_admin_failure ON "NotificationEventIntent"');
    await prisma.$executeRawUnsafe('DROP FUNCTION test_resend_admin_failure()');

    // Customer and admin projections roll back together on a failed update.
    const partialDelB = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: delB.id } });
    expect(partialDelB.status).toBe("PROVIDER_ACCEPTED");

    // Retry finishes admin projection without re-throwing or failing on customer receipt
    const retryBRes = await resendWebhookPost(new NextRequest("http://127.0.0.1/api/webhooks/resend", {
      method: "POST",
      headers: {
        "svix-id": svixIdB,
        "svix-timestamp": String(nowSec),
        "svix-signature": signSvixWebhook(svixSecret, svixIdB, String(nowSec), bodyB),
        "x-forwarded-for": "10.0.1.4",
      },
      body: bodyB,
    }));
    expect(retryBRes.status).toBe(200);

    const finalIntentB = await prisma.notificationEventIntent.findUniqueOrThrow({ where: { id: intentB.id } });
    expect((finalIntentB.safePayload as Record<string, unknown>).deliveryStatus).toBe("DELIVERED");

    vi.restoreAllMocks();

    // (c) Concurrent signed duplicate requests
    const emailC = `re_c_${t}`;
    const svixIdC = `msg_${t}_c`;
    const delC = await prisma.notificationDelivery.create({
      data: {
        publicReference: `del-${t}-c`,
        messageId: `msg-id-${t}-c`,
        recipientUserId: customerUser.id,
        channel: "EMAIL",
        status: "PROVIDER_ACCEPTED",
        provider: "RESEND_EMAIL",
        providerMessageReference: emailC,
        renderedBody: "Order update C",
      },
    });
    const bodyC = JSON.stringify({
      type: "email.delivered",
      created_at: new Date().toISOString(),
      data: { email_id: emailC },
    });

    const [conc1, conc2] = await Promise.all([
      resendWebhookPost(new NextRequest("http://127.0.0.1/api/webhooks/resend", {
        method: "POST",
        headers: {
          "svix-id": svixIdC,
          "svix-timestamp": String(nowSec),
          "svix-signature": signSvixWebhook(svixSecret, svixIdC, String(nowSec), bodyC),
          "x-forwarded-for": "10.0.1.5",
        },
        body: bodyC,
      })),
      resendWebhookPost(new NextRequest("http://127.0.0.1/api/webhooks/resend", {
        method: "POST",
        headers: {
          "svix-id": svixIdC,
          "svix-timestamp": String(nowSec),
          "svix-signature": signSvixWebhook(svixSecret, svixIdC, String(nowSec), bodyC),
          "x-forwarded-for": "10.0.1.6",
        },
        body: bodyC,
      })),
    ]);
    expect(conc1.status).toBe(200);
    expect(conc2.status).toBe(200);
    const json1 = await conc1.json();
    const json2 = await conc2.json();
    const nonReplays = [json1, json2].filter((j) => !j.replayed);
    const replays = [json1, json2].filter((j) => j.replayed);
    expect(nonReplays.length).toBe(1);
    expect(replays.length).toBe(1);
    const updatedDelC = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: delC.id } });
    expect(updatedDelC.status).toBe("DELIVERED");

    // (d) Unmatched provider ID becomes available later
    const emailD = `re_d_unmatched_${t}`;
    const svixIdD = `msg_${t}_d`;
    const bodyD = JSON.stringify({
      type: "email.delivered",
      created_at: new Date().toISOString(),
      data: { email_id: emailD },
    });
    const unmatchedRes = await resendWebhookPost(new NextRequest("http://127.0.0.1/api/webhooks/resend", {
      method: "POST",
      headers: {
        "svix-id": svixIdD,
        "svix-timestamp": String(nowSec),
        "svix-signature": signSvixWebhook(svixSecret, svixIdD, String(nowSec), bodyD),
        "x-forwarded-for": "10.0.1.7",
      },
      body: bodyD,
    }));
    expect(unmatchedRes.status).toBe(200);
    const unmatchedJson = await unmatchedRes.json();
    expect(unmatchedJson.status).toBe("UNMATCHED_PENDING");

    const inboxD = await prisma.notificationAuditEvent.findUniqueOrThrow({
      where: { publicReference: `resend-wh:${svixIdD}` },
    });
    expect(inboxD.eventType).toBe("RESEND_WEBHOOK_UNMATCHED_PENDING");

    // Later: delivery row is committed
    const delD = await prisma.notificationDelivery.create({
      data: {
        publicReference: `del-${t}-d`,
        messageId: `msg-id-${t}-d`,
        recipientUserId: customerUser.id,
        channel: "EMAIL",
        status: "PROVIDER_ACCEPTED",
        provider: "RESEND_EMAIL",
        providerMessageReference: emailD,
        renderedBody: "Order update D",
      },
    });

    // Background processor recovers and reconciles
    const recoveryResult = await recoverPendingResendWebhooks({
      db: prisma,
      limit: 10,
      now: new Date(Date.now() + 30_000),
    });
    expect(recoveryResult.reconciled).toBeGreaterThanOrEqual(1);

    const updatedDelD = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: delD.id } });
    expect(updatedDelD.status).toBe("DELIVERED");

    const resolvedInboxD = await prisma.notificationAuditEvent.findUniqueOrThrow({
      where: { publicReference: `resend-wh:${svixIdD}` },
    });
    expect(resolvedInboxD.eventType).toBe("RESEND_WEBHOOK_FULLY_APPLIED");

    // (e) Conflicting replay body
    const bodyEConflict = JSON.stringify({
      type: "email.bounced",
      created_at: new Date().toISOString(),
      data: { email_id: emailA },
    });
    const conflictRes = await resendWebhookPost(new NextRequest("http://127.0.0.1/api/webhooks/resend", {
      method: "POST",
      headers: {
        "svix-id": svixIdA,
        "svix-timestamp": String(nowSec),
        "svix-signature": signSvixWebhook(svixSecret, svixIdA, String(nowSec), bodyEConflict),
        "x-forwarded-for": "10.0.1.8",
      },
      body: bodyEConflict,
    }));
    expect(conflictRes.status).toBe(422);

    // (f) Out-of-order delayed/delivered/bounced statuses
    const svixIdF = `msg_${t}_f`;
    const delayedBody = JSON.stringify({
      type: "email.delivery_delayed",
      created_at: new Date().toISOString(),
      data: { email_id: emailA },
    });
    const delayedRes = await resendWebhookPost(new NextRequest("http://127.0.0.1/api/webhooks/resend", {
      method: "POST",
      headers: {
        "svix-id": svixIdF,
        "svix-timestamp": String(nowSec),
        "svix-signature": signSvixWebhook(svixSecret, svixIdF, String(nowSec), delayedBody),
        "x-forwarded-for": "10.0.1.9",
      },
      body: delayedBody,
    }));
    expect(delayedRes.status).toBe(200);
    // DELIVERED status is preserved and not rolled back to FAILED_RETRYABLE
    const preservedDelA = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: delA.id } });
    expect(preservedDelA.status).toBe("DELIVERED");

    // (g) Genuine duplicate after FULLY_APPLIED
    const dupRes = await resendWebhookPost(new NextRequest("http://127.0.0.1/api/webhooks/resend", {
      method: "POST",
      headers: {
        "svix-id": svixIdA,
        "svix-timestamp": String(nowSec),
        "svix-signature": signSvixWebhook(svixSecret, svixIdA, String(nowSec), bodyA),
        "x-forwarded-for": "10.0.1.10",
      },
      body: bodyA,
    }));
    expect(dupRes.status).toBe(200);
    expect(await dupRes.json()).toMatchObject({ ok: true, replayed: true });

    // (h) Invalid and stale signatures
    const badSigRes = await resendWebhookPost(new NextRequest("http://127.0.0.1/api/webhooks/resend", {
      method: "POST",
      headers: {
        "svix-id": `msg_${t}_bad`,
        "svix-timestamp": String(nowSec),
        "svix-signature": "v1,invalidSig",
        "x-forwarded-for": "10.0.1.11",
      },
      body: bodyA,
    }));
    expect(badSigRes.status).toBe(401);

    const staleSigRes = await resendWebhookPost(new NextRequest("http://127.0.0.1/api/webhooks/resend", {
      method: "POST",
      headers: {
        "svix-id": `msg_${t}_stale`,
        "svix-timestamp": String(nowSec - 600),
        "svix-signature": signSvixWebhook(svixSecret, `msg_${t}_stale`, String(nowSec - 600), bodyA),
        "x-forwarded-for": "10.0.1.12",
      },
      body: bodyA,
    }));
    expect(staleSigRes.status).toBe(401);

    // Financial invariant assertion: exactly zero mutations to financial tables
    expect(await prisma.ledgerJournal.count()).toBe(journalCountBefore);
    expect(await prisma.ledgerEntry.count()).toBe(entryCountBefore);
    expect(await prisma.payment.count()).toBe(paymentCountBefore);
    expect(await prisma.paymentRefund.count()).toBe(refundCountBefore);
    expect(await prisma.cashOnDelivery.count()).toBe(codCountBefore);
  });

  it("DEFECT-2 (Sec 3A): records atomic owner alerts across refund, SuperAdmin wallet grant, loyalty, referral, anomaly, and unassigned escalation (zero pre-verification alerts & zero PII)", async () => {
    const t = randomUUID().slice(0, 8);
    await setRecipients([
      {
        email: superAdminUser.email,
        label: "SuperAdmin Desk",
        active: true,
        roleScope: "SUPER_ADMIN",
        events: [...ADMIN_ALERT_EVENT_TYPES],
      },
    ]);

    // 1. WALLET_CREDIT_ISSUED via SuperAdmin wallet grant
    const grant = await creditCustomerWalletBySuperAdmin({
      actorUserId: superAdminUser.id,
      customerUserId: customerUser.id,
      amount: "250.00",
      reason: "Goodwill audit wallet grant",
      operationId: `aud-grant-${t}`,
    });
    expect(grant.status).toBe("CREDITED");

    // 2. LOYALTY_ADJUSTED via admin adjust + wallet conversion, plus negative non-awarded check
    await adjustCustomerLoyaltyPoints({
      actorUserId: superAdminUser.id,
      customerUserId: customerUser.id,
      deltaPoints: 500n,
      reason: "Manual audit loyalty bonus",
    });
    await prisma.systemSetting.upsert({
      where: { key: "loyalty.conversion_enabled" },
      update: { type: "BOOLEAN", value: true },
      create: { key: "loyalty.conversion_enabled", type: "BOOLEAN", label: "Loyalty conv", value: true },
    });
    await redeemCustomerLoyaltyPoints({
      userId: customerUser.id,
      operationId: `aud-loy-redeem-${t}`,
      points: "100",
    });

    // 3. Paid parcel order -> REFUND_REQUESTED, REFUND_COMPLETED, FINANCE_ANOMALY_ALERT, UNASSIGNED_ORDER_ESCALATED
    const refundOrder = await bookCodOrder("DIGITAL_ONLY");
    const { paymentRow } = await payOrderViaVerify(refundOrder.id, customerUser, { viaWebhook: true });

    // Verify UNPAID payment does NOT trigger LOYALTY_ADJUSTED
    const unpaidOrder = await bookCodOrder("DIGITAL_ONLY");
    const unpaidPrep = await prepareOrderPayment(customerUser, {
      orderId: unpaidOrder.id,
      idempotencyKey: `aud-unpaid-${randomUUID()}`,
    });
    const unpaidPay = await prisma.payment.findUniqueOrThrow({ where: { publicReference: unpaidPrep.publicReference } });
    await expect(reconcileCompletedParcelLoyalty(customerUser.id, unpaidPay.id)).rejects.toThrow();

    // Unassigned SLA escalation on stalled CONFIRMED order vs skipping PENDING unpaid order
    await prisma.order.update({
      where: { id: refundOrder.id },
      data: { updatedAt: new Date(Date.now() - 45 * 60_000) },
    });
    await prisma.order.update({
      where: { id: unpaidOrder.id },
      data: { updatedAt: new Date(Date.now() - 45 * 60_000) },
    });
    const esc = await scanUnassignedCourierOrdersBatch({
      mode: "APPLY",
      thresholdMinutes: 15,
    });
    expect(esc.escalatedCount).toBeGreaterThanOrEqual(1);

    const unpaidEscIntent = await prisma.notificationEventIntent.findFirst({
      where: {
        sourceAuthority: "ADMIN_ALERT",
        eventType: "UNASSIGNED_ORDER_ESCALATED",
        aggregateReference: { contains: unpaidOrder.id },
      },
    });
    expect(unpaidEscIntent).toBeNull();

    // Cancel paid order refund flow
    const refund = await createRefundRequest(
      {
        actorUserId: customerUser.id,
        paymentPublicReference: paymentRow.publicReference,
        amount: "20.00",
        method: "CUSTOMER_WALLET",
        reasonCode: "CUSTOMER_SERVICE_RESOLUTION",
        customerNote: "Partial goodwill audit refund",
        operationId: `aud-ref-req-${t}`,
      },
      { assertProductionReady: () => {} },
    );
    await approveRefund({
      actorUserId: adminUser.id,
      publicReference: refund.publicReference,
      operationId: `aud-ref-app-${t}`,
    });
    await completeRefundToCustomerWallet(
      {
        actorUserId: superAdminUser.id,
        publicReference: refund.publicReference,
        operationId: `aud-ref-comp-${t}`,
      },
      { assertProductionReady: () => {} },
    );

    await prisma.$transaction(async (tx) => {
      await openRefundReconciliationCase(tx, {
        refundId: refund.id,
        refundReference: refund.publicReference,
        reason: "PROVIDER_QUERY_UNAVAILABLE",
        safeSummary: "Audit reconciliation anomaly test case",
      });
    });

    // 4. REFERRAL_REWARD_AWARDED on verified completed paid order + zero alert when referral ineligible
    await prisma.systemSetting.upsert({
      where: { key: "referral.reward_issuing_enabled" },
      update: { type: "BOOLEAN", value: true },
      create: { key: "referral.reward_issuing_enabled", type: "BOOLEAN", label: "Referral issuing", value: true },
    });
    const refCode = await prisma.referralCode.create({
      data: {
        ownerType: "CUSTOMER",
        ownerId: customerUser.id,
        code: `AUDREF${t.toUpperCase()}`,
        isActive: true,
        metadata: { program: "ORDINARY_REFERRAL_V1" },
      },
    });
    const pendingRef = await prisma.referralEvent.create({
      data: {
        referralCodeId: refCode.id,
        targetUserId: foreignAdminUser.id,
        targetType: "CUSTOMER",
        source: "ORDINARY_SIGNUP",
        status: "PENDING",
      },
    });
    await expect(
      awardVerifiedOrdinaryReferral({
        actorUserId: superAdminUser.id,
        referralEventId: pendingRef.id,
        operationId: `aud-ref-bad-${t}`,
      }),
    ).rejects.toThrow();
    expect(
      await prisma.notificationEventIntent.findFirst({
        where: { sourceAuthority: "ADMIN_ALERT", eventType: "REFERRAL_REWARD_AWARDED", aggregateReference: `referral-award:${pendingRef.id}` },
      }),
    ).toBeNull();

    // Attribution must predate the qualifying first paid & completed order
    const qualifyingRef = await prisma.referralEvent.create({
      data: {
        referralCodeId: refCode.id,
        targetUserId: customerUser2.id,
        targetType: "CUSTOMER",
        source: "ORDINARY_SIGNUP",
        status: "PENDING",
      },
    });
    const refOrder = await bookCodOrder("DIGITAL_ONLY", customerUser2);
    const refPay = await payOrderViaVerify(refOrder.id, customerUser2, { viaWebhook: true, production: true });
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: refPay.paymentRow.id },
        data: { reconciliationStatus: "CLEAR" },
      }),
      prisma.order.update({ where: { id: refOrder.id }, data: { status: OrderStatus.COMPLETED } }),
    ]);
    await awardVerifiedOrdinaryReferral({
      actorUserId: superAdminUser.id,
      referralEventId: qualifyingRef.id,
      operationId: `aud-ref-ok-${t}`,
    });

    const eventsToVerify = [
      { type: "WALLET_CREDIT_ISSUED", ref: `wallet-grant:${grant.journalReference}` },
      { type: "LOYALTY_ADJUSTED", ref: `loyalty-adj:${customerUser.id}:` },
      { type: "LOYALTY_ADJUSTED", ref: `loyalty-redeem:` },
      { type: "REFUND_REQUESTED", ref: `refund-req:${refund.publicReference}` },
      { type: "REFUND_COMPLETED", ref: `refund-comp:${refund.publicReference}` },
      { type: "FINANCE_ANOMALY_ALERT", ref: `refund-recon:${refund.publicReference}:` },
      { type: "UNASSIGNED_ORDER_ESCALATED", ref: `unassigned-order:${refundOrder.id}:` },
      { type: "REFERRAL_REWARD_AWARDED", ref: `referral-award:${qualifyingRef.id}` },
    ];
    for (const check of eventsToVerify) {
      const row = await prisma.notificationEventIntent.findFirst({
        where: {
          sourceAuthority: "ADMIN_ALERT",
          eventType: check.type,
          aggregateReference: { startsWith: check.ref },
        },
      });
      expect(row, `Expected ADMIN_ALERT domain event ${check.type} (${check.ref})`).not.toBeNull();
      const rawJson = JSON.stringify(row!.safePayload);
      expect(rawJson).not.toContain(customerUser.email);
      expect(rawJson).not.toContain(customerUser2.email);
      expect(rawJson).not.toContain("+27821110000");
    }
  });

  it("DEFECT-3 (Sec 3B): covers 50/50 DEPOSIT_PLUS_COD (odd cent + wallet+Paystack split), FULL_COD, and WALLET_ONLY payment/acceptance notifications with exact DB split copy", async () => {
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
      reason: "Odd-cent COD split notification verification",
    });
    const approved = await approvePaymentConfiguration(superAdminUser, {
      policyId: draft.id,
      expectedVersion: draft.version,
      remittanceVerified: true,
      settlementTiming: "Daily bank remittance by end of operating day",
      reason: "Approve 50/50 split notification test policy",
    });
    createdPolicyIds.push(draft.id, approved.id);

    await prisma.$transaction(prepareRequiredDomainNotifications);
    for (const evType of ["COURIER_PAYMENT_CONFIRMED", "COURIER_ACCEPTED"]) {
      await prisma.$transaction((tx) => reviewRequiredDomainNotification(tx, evType, "APPROVE_RECIPIENT_POLICY", `${prefix}-rev1`)).catch(() => {});
      await prisma.$transaction((tx) => reviewRequiredDomainNotification(tx, evType, "APPROVE_TEMPLATE", `${prefix}-rev1`)).catch(() => {});
      await prisma.$transaction((tx) => reviewRequiredDomainNotification(tx, evType, "PUBLISH_TEMPLATE", `${prefix}-pub1`)).catch(() => {});
      await prisma.$transaction((tx) => reviewRequiredDomainNotification(tx, evType, "PREPARE_ROUTE", `${prefix}-rev1`)).catch(() => {});
      await prisma.$transaction((tx) => reviewRequiredDomainNotification(tx, evType, "APPROVE_ROUTE", `${prefix}-rev1`)).catch(() => {});
      await prisma.$transaction((tx) => reviewRequiredDomainNotification(tx, evType, "ACTIVATE_ROUTE", `${prefix}-pub1`)).catch(() => {});
    }

    // Case A: 50/50 DEPOSIT_PLUS_COD odd-cent R101.01 -> R50.51 deposit + R50.50 cash due
    const codOrder = await bookCodOrder("DEPOSIT_PLUS_COD");
    await payOrderViaVerify(codOrder.id);
    const guardDriverUser = await prisma.user.create({ data: { email: `${prefix}-manual-guard-${randomUUID()}@example.test`, role: UserRole.DRIVER, status: UserStatus.ACTIVE, emailVerifiedAt: new Date() } });
    const guardDriver = await prisma.driverProfile.create({ data: { userId: guardDriverUser.id, driverCode: `MG-${randomUUID().slice(0, 12)}`, active: true, status: "ACTIVE", availability: "AVAILABLE", maxConcurrentAssignments: 1, cashLimitAmount: new Prisma.Decimal("5000.00") } });
    await prisma.driverServiceRegion.create({ data: { driverProfileId: guardDriver.id, deliveryRegionId: gautengRegion.id, isPrimary: true } });
    await createApprovedDriverEvidence(guardDriver.id, guardDriverUser.id, `manual-guard-${randomUUID()}`);
    await prisma.order.update({ where: { id: codOrder.id }, data: { deliveryRegionId: gautengRegion.id } });
    const guardOffer = await offerAssignment(adminUser.id, codOrder.id, { driverProfileId: guardDriver.id });
    await acceptDispatchAssignment(guardDriver.id, guardOffer.id, { expectedVersion: guardOffer.version });
    await prisma.order.update({ where: { id: codOrder.id }, data: { status: OrderStatus.IN_TRANSIT } });
    const depositCodBefore = await prisma.cashOnDelivery.findUniqueOrThrow({ where: { orderId: codOrder.id } });
    expect(depositCodBefore.digitalPaid.equals(depositCodBefore.digitalRequired)).toBe(true);
    expect(depositCodBefore.cashCollected.isZero()).toBe(true);
    const depositProofs = await prisma.proofOfDelivery.count({ where: { orderId: codOrder.id } });
    expect(await adminManualDeliveryComplete(codOrder.id, adminUser.id, UserRole.ADMIN, { recipientName: "Recipient", reason: "Disposable deposit COD guard test" })).toMatchObject({ ok: false });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: codOrder.id } })).status).toBe("IN_TRANSIT");
    expect(await prisma.cashOnDelivery.findUniqueOrThrow({ where: { orderId: codOrder.id } })).toEqual(depositCodBefore);
    expect(await prisma.proofOfDelivery.count({ where: { orderId: codOrder.id } })).toBe(depositProofs);

    // Case B: Full WALLET_ONLY parcel order settlement (credit wallet first so balance >= 101.01)
    await creditCustomerWalletBySuperAdmin({
      actorUserId: superAdminUser.id,
      customerUserId: customerUser.id,
      amount: "150.00",
      reason: "Fund full wallet settlement test",
      operationId: `aud-wal-fund-${randomUUID().slice(0, 8)}`,
    });
    const walletOrder = await bookCodOrder("DIGITAL_ONLY");
    const { paymentRow: walPay } = await payOrderViaVerify(walletOrder.id, customerUser, { walletAmount: "101.01" });
    expect(walPay.provider).toBe("MANUAL");
    expect((walPay.metadata as Record<string, unknown>)?.walletSettled).toBe(true);
    expect(walPay.status).toBe("SUCCEEDED");

    await consumeCustomerOrderNotifications(50);

    async function findCustomerDeliveriesForOrder(orderId: string, recipientUserId: string) {
      const intents = await prisma.notificationEventIntent.findMany({
        where: { sourceAuthority: "COURIER_ORDER", aggregateReference: orderId },
        select: { operationId: true, eventType: true },
      });
      const opMap = new Map(intents.map((i) => [i.operationId, i.eventType]));
      const receipts = intents.length
        ? await prisma.notificationSourceReceipt.findMany({
            where: { sourceEventId: { in: intents.map((i) => i.operationId) } },
            select: { id: true, sourceEventId: true },
          })
        : [];
      const receiptToEvent = new Map(receipts.map((r) => [r.id, opMap.get(r.sourceEventId) ?? ""]));
      const messages = receipts.length
        ? await prisma.notificationMessage.findMany({
            where: { recipientUserId, sourceReceiptId: { in: receipts.map((r) => r.id) } },
            select: { id: true, sourceReceiptId: true },
          })
        : [];
      const msgToEvent = new Map(messages.map((m) => [m.id, receiptToEvent.get(m.sourceReceiptId) ?? ""]));
      const deliveries = messages.length
        ? await prisma.notificationDelivery.findMany({
            where: { messageId: { in: messages.map((m) => m.id) }, channel: "EMAIL" },
          })
        : [];
      return deliveries.map((d) => ({ ...d, eventType: msgToEvent.get(d.messageId) ?? "" }));
    }

    const [codMessages, walletMessages, walAdminPaid, walAdminAccepted] = await Promise.all([
      findCustomerDeliveriesForOrder(codOrder.id, customerUser.id),
      findCustomerDeliveriesForOrder(walletOrder.id, customerUser.id),
      prisma.notificationEventIntent.findFirst({
        where: { sourceAuthority: "ADMIN_ALERT", eventType: "PARCEL_ORDER_PAID", aggregateReference: `parcel:${walletOrder.id}` },
      }),
      prisma.notificationEventIntent.findFirst({
        where: { sourceAuthority: "ADMIN_ALERT", eventType: "PARCEL_ORDER_ACCEPTED", aggregateReference: `parcel-accepted:${walletOrder.id}` },
      }),
    ]);

    const paidDelivery = codMessages.find((m) => m.eventType === "COURIER_PAYMENT_CONFIRMED");
    expect(paidDelivery?.renderedBody).toContain("50.51");
    expect(paidDelivery?.renderedBody).toContain("50.50");
    expect(paidDelivery?.renderedBody).toMatch(/deposit.*verified/i);
    expect(paidDelivery?.renderedBody).toMatch(/cash.*due.*driver.*delivery/i);
    expect(paidDelivery?.renderedBody).not.toMatch(/fully paid/i);
    expect(paidDelivery?.renderedBody).not.toMatch(/bank deposit received/i);

    const walPaid = walletMessages.find((m) => m.eventType === "COURIER_PAYMENT_CONFIRMED");
    const walAcc = walletMessages.find((m) => m.eventType === "COURIER_ACCEPTED");
    expect(walPaid?.renderedBody).toContain("101.01");
    expect(walPaid?.renderedBody).not.toMatch(/cash.*due/i);
    expect(walAcc).toBeDefined();
    expect(walAdminPaid).not.toBeNull();
    expect(walAdminAccepted).not.toBeNull();

    // Case C: Hybrid wallet + Paystack 50/50 DEPOSIT_PLUS_COD split (R20.00 wallet + R30.51 Paystack = R50.51 deposit)
    const hybridCodOrder = await bookCodOrder("DEPOSIT_PLUS_COD");
    await payOrderViaVerify(hybridCodOrder.id, customerUser, { walletAmount: "20.00" });
    await consumeCustomerOrderNotifications(50);
    const hybridMsgs = await findCustomerDeliveriesForOrder(hybridCodOrder.id, customerUser.id);
    const hybridPaid = hybridMsgs.find((m) => m.eventType === "COURIER_PAYMENT_CONFIRMED");
    expect(hybridPaid?.renderedBody).toContain("50.51");
    expect(hybridPaid?.renderedBody).toContain("50.50");
    expect(hybridPaid?.renderedBody).not.toMatch(/fully paid/i);
  });

  it("GAP-4 (Sec 4): persists Africa/Johannesburg end-of-day remittanceDueAt, alerts overdue drivers via registered processor, blocks new COD assignments while allowing DIGITAL_ONLY, and clears after independent verification", async () => {
    const t = randomUUID().slice(0, 6);
    const driverUser = await prisma.user.create({
      data: {
        email: `${prefix}-drv-${t}@example.test`,
        name: "Overdue Test Driver",
        role: UserRole.DRIVER,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });
    const driver = await prisma.driverProfile.create({
      data: {
        userId: driverUser.id,
        driverCode: `DRV-${t.toUpperCase()}`,
        displayName: "Overdue Driver",
        active: true,
        status: "ACTIVE",
        availability: "AVAILABLE",
        maxConcurrentAssignments: 3,
        cashLimitAmount: new Prisma.Decimal("5000.00"),
      },
    });
    await prisma.driverServiceRegion.create({
      data: { driverProfileId: driver.id, deliveryRegionId: gautengRegion.id, isPrimary: true },
    });
    await createApprovedDriverEvidence(driver.id, driverUser.id, `drv-${t}`);

    // Verify FULL_COD is discontinued while continuing GAP-4 under active 50/50 DEPOSIT_PLUS_COD
    const currentPolicies = await prisma.paymentMethodPolicy.findMany({
      where: { deliveryServiceId: deliveryServiceKey, orderType: "PARCEL_DOCUMENT" },
      select: { versionNumber: true },
    });
    const nextExpectedVersion = Math.max(0, ...currentPolicies.map((p) => p.versionNumber));
    await expect(
      savePaymentConfiguration(adminUser, {
        storeId: null,
        deliveryServiceId: deliveryServiceKey,
        provinces: ["Gauteng"],
        regionId: null,
        orderId: null,
        orderType: "PARCEL_DOCUMENT",
        mode: "FULL_COD" as never,
        depositPercent: null,
        maximumCodAmount: "500.00",
        active: true,
        expectedVersion: nextExpectedVersion,
        reason: "Retired FULL_COD must be rejected",
      }),
    ).rejects.toThrow();

    const firstCod = await bookCodOrder("DEPOSIT_PLUS_COD");
    await payOrderViaVerify(firstCod.id);
    const firstCodRow = await prisma.cashOnDelivery.findUniqueOrThrow({ where: { orderId: firstCod.id } });
    const firstCashDue = firstCodRow.cashObligation.toFixed(2);
    await prisma.order.update({ where: { id: firstCod.id }, data: { deliveryRegionId: gautengRegion.id } });
    const offer1 = await offerAssignment(adminUser.id, firstCod.id, { driverProfileId: driver.id });
    await acceptDispatchAssignment(driver.id, offer1.id, { expectedVersion: offer1.version });
    await prisma.order.update({ where: { id: firstCod.id }, data: { status: OrderStatus.IN_TRANSIT } });

    const beforeManual = await prisma.cashOnDelivery.findUniqueOrThrow({ where: { orderId: firstCod.id } });
    const beforeAssignment = await prisma.orderAssignment.findUniqueOrThrow({ where: { id: offer1.id } });
    const proofCount = await prisma.proofOfDelivery.count({ where: { orderId: firstCod.id } });
    const journals = await prisma.ledgerJournal.count();
    const statusBypass = await updateAdminOrderStatus(adminUser, firstCod.id, { status: OrderStatus.DELIVERED, internalNote: "Attempt generic status bypass" });
    expect(statusBypass).toMatchObject({ error: expect.stringContaining("delivery") });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: firstCod.id } })).status).toBe("IN_TRANSIT");
    expect(await prisma.proofOfDelivery.count({ where: { orderId: firstCod.id } })).toBe(proofCount);
    expect(await prisma.ledgerJournal.count()).toBe(journals);
    const manual = await adminManualDeliveryComplete(firstCod.id, adminUser.id, UserRole.ADMIN, { recipientName: "Recipient", reason: "Disposable manual delivery guard test" });
    expect(manual).toMatchObject({ ok: false, code: "COD_COLLECTION_REQUIRED" });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: firstCod.id } })).status).toBe("IN_TRANSIT");
    expect(await prisma.cashOnDelivery.findUniqueOrThrow({ where: { orderId: firstCod.id } })).toEqual(beforeManual);
    expect(await prisma.orderAssignment.findUniqueOrThrow({ where: { id: offer1.id } })).toEqual(beforeAssignment);
    expect(await prisma.proofOfDelivery.count({ where: { orderId: firstCod.id } })).toBe(proofCount);
    expect(await prisma.ledgerJournal.count()).toBe(journals);

    await expect(reportCodPhysicalDeliveryException(superAdminUser, firstCod.id, { operationId: `physical-no-evidence-${t}`, reason: "No evidence" })).rejects.toMatchObject({ code: "EVIDENCE_REQUIRED" });
    const evidenceRef = `POD-${randomUUID()}`;
    const mediaRef = `PMO-${randomUUID()}`;
    await prisma.privateMediaObject.create({ data: { publicReference: mediaRef, ownerType: "PROOF_OF_DELIVERY", ownerId: firstCod.id, purpose: "POD_EVIDENCE", status: "READY", storageProvider: "LOCAL", storageKey: `disposable/${mediaRef}`, originalFileName: "evidence.png", declaredMimeType: "image/png", detectedMimeType: "image/png", byteSize: 12, checksum: "a".repeat(64), createdByUserId: driverUser.id } });
    await prisma.deliveryProofEvidence.create({ data: { publicReference: evidenceRef, orderId: firstCod.id, assignmentId: offer1.id, driverProfileId: driver.id, createdByUserId: driverUser.id, storageProvider: "LOCAL", storageReference: mediaRef, contentType: "image/png", byteSize: 12, privateVisibility: true, status: "READY", validatedAt: new Date() } });
    const report = await reportCodPhysicalDeliveryException(superAdminUser, firstCod.id, { operationId: `physical-report-${t}`, reason: "Recipient delivery reported; collection remains unverified", evidenceReference: evidenceRef });
    expect(report).toMatchObject({ status: "REVIEW_PENDING", cashOutstanding: firstCashDue });
    expect(await reportCodPhysicalDeliveryException(superAdminUser, firstCod.id, { operationId: `physical-report-${t}`, reason: "Recipient delivery reported; collection remains unverified", evidenceReference: evidenceRef })).toEqual(report);
    await expect(reportCodPhysicalDeliveryException(superAdminUser, firstCod.id, { operationId: `physical-report-${t}`, reason: "Changed report", evidenceReference: evidenceRef })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(reviewCodPhysicalDeliveryException(superAdminUser, firstCod.id, { operationId: `physical-self-review-${t}`, decision: "VERIFY", reason: "Review" })).rejects.toMatchObject({ code: "INDEPENDENT_REVIEW_REQUIRED" });
    await prisma.privateMediaObject.update({ where: { publicReference: mediaRef }, data: { status: "QUARANTINED" } });
    await expect(reviewCodPhysicalDeliveryException(adminUser, firstCod.id, { operationId: `physical-review-${t}`, decision: "VERIFY", reason: "Independent review of delivery evidence" })).rejects.toMatchObject({ code: "EVIDENCE_REQUIRED" });
    await prisma.privateMediaObject.update({ where: { publicReference: mediaRef }, data: { status: "READY" } });
    expect(await prisma.ledgerJournal.count()).toBe(journals);
    expect((await prisma.cashOnDelivery.findUniqueOrThrow({ where: { orderId: firstCod.id } })).cashCollected.toFixed(2)).toBe("0.00");
    await recordCashCollection({ orderId: firstCod.id, collectorDriverId: driver.id, actorUserId: driverUser.id, amount: firstCashDue, operationId: `aud-collect-${t}` });
    expect(await reportCodPhysicalDeliveryException(superAdminUser, firstCod.id, { operationId: `physical-report-${t}`, reason: "Recipient delivery reported; collection remains unverified", evidenceReference: evidenceRef })).toEqual(report);
    await expect(reconcileCashCollection({ orderId: firstCod.id, actorUserId: adminUser.id, receivedAmount: firstCashDue, operationId: `pending-review-reconcile-${t}` })).rejects.toMatchObject({ code: "COD_REVIEW_REQUIRED" });
    expect(await adminManualDeliveryComplete(firstCod.id, adminUser.id, UserRole.ADMIN, { recipientName: "Recipient", reason: "Review still pending" })).toMatchObject({ ok: false, code: "COD_REVIEW_REQUIRED" });
    const review = await reviewCodPhysicalDeliveryException(adminUser, firstCod.id, { operationId: `physical-review-${t}`, decision: "VERIFY", reason: "Independent review of delivery evidence" });
    expect(review).toMatchObject({ status: "VERIFIED_CASH_COLLECTED", cashOutstanding: "0.00" });
    expect(await reviewCodPhysicalDeliveryException(adminUser, firstCod.id, { operationId: `physical-review-${t}`, decision: "VERIFY", reason: "Independent review of delivery evidence" })).toEqual(review);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: firstCod.id } })).status).toBe("IN_TRANSIT");
    expect(await prisma.proofOfDelivery.count({ where: { orderId: firstCod.id } })).toBe(proofCount);
    expect(await prisma.ledgerJournal.count()).toBe(journals + 1);

    const collected = await recordCashCollection({
      orderId: firstCod.id,
      collectorDriverId: driver.id,
      actorUserId: driverUser.id,
      amount: firstCashDue,
      operationId: `aud-collect-${t}`,
    });
    expect(collected.remittanceDueAt).not.toBeNull();
    expect(collected.remittanceDueAt!.toISOString()).toBe(
      computeDriverCashRemittanceDueAt(collected.collectedAt!).toISOString(),
    );
    await prisma.cashOnDelivery.update({ where: { id: collected.id }, data: { collectorDriverId: "foreign-driver" } });
    expect(await adminManualDeliveryComplete(firstCod.id, adminUser.id, UserRole.ADMIN, { recipientName: "Recipient", reason: "Disposable wrong collector check" })).toMatchObject({ ok: false, code: "COD_COLLECTION_REQUIRED" });
    expect(await prisma.proofOfDelivery.count({ where: { orderId: firstCod.id } })).toBe(proofCount);
    await prisma.cashOnDelivery.update({ where: { id: collected.id }, data: { collectorDriverId: driver.id } });
    await prisma.cashOnDelivery.update({ where: { id: collected.id }, data: { collectionJournalId: null } });
    expect(await adminManualDeliveryComplete(firstCod.id, adminUser.id, UserRole.ADMIN, { recipientName: "Recipient", reason: "Disposable missing cash evidence check" })).toMatchObject({ ok: false, code: "COD_COLLECTION_REQUIRED" });
    expect(await prisma.proofOfDelivery.count({ where: { orderId: firstCod.id } })).toBe(proofCount);
    await prisma.cashOnDelivery.update({ where: { id: collected.id }, data: { collectionJournalId: collected.collectionJournalId } });
    const completion = () => adminManualDeliveryComplete(firstCod.id, adminUser.id, UserRole.ADMIN, { recipientName: "Recipient", reason: "Verified collected cash and recipient delivery" });
    const completed = await Promise.all([completion(), completion()]);
    expect(completed.filter(result => result.ok), JSON.stringify(completed)).toHaveLength(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: firstCod.id } })).status).toBe("DELIVERED");
    expect(await prisma.proofOfDelivery.count({ where: { orderId: firstCod.id } })).toBe(proofCount + 1);
    expect(await prisma.adminActivityLog.count({ where: { entityType: "Order", entityId: firstCod.id, actorUserId: adminUser.id, action: "STATUS_CHANGE" } })).toBe(1);

    // Move collection + remittanceDueAt to yesterday SAST (overdue!)
    const pastCollected = new Date(Date.now() - 36 * 3600_000);
    await prisma.cashOnDelivery.update({
      where: { id: collected.id },
      data: {
        collectedAt: pastCollected,
        remittanceDueAt: computeDriverCashRemittanceDueAt(pastCollected),
      },
    });

    const summaryOverdue = await driverCashSummary(driverUser.id);
    expect(summaryOverdue.overdueRemittance.newCodAssignmentsBlocked).toBe(true);
    expect(summaryOverdue.overdueRemittance.overdueCount).toBe(1);
    expect(summaryOverdue.overdueRemittance.overdueAmountZar).toBe(firstCashDue);

    // Run registered SLA processor -> emits alert, does NOT reconcile COD or clear custody
    const slaRun = await executeRegisteredProcessor({
      name: "monitor-overdue-driver-cash",
      partition: `test-${randomUUID()}`,
      mode: "APPLY",
      operationId: `drv-sla-apply-${randomUUID()}`,
    });
    expect(slaRun.success).toBe(true);
    expect(slaRun.itemsCompleted).toBeGreaterThanOrEqual(1);
    const codStillCollected = await prisma.cashOnDelivery.findUniqueOrThrow({ where: { id: collected.id } });
    expect(codStillCollected.status).toBe("COLLECTED");

    // Driver submits deposit (PENDING) — must NOT unblock overdue COD assignments!
    const proof = await prisma.privateMediaObject.create({
      data: {
        publicReference: `PMO-${randomUUID()}`,
        storageProvider: "S3",
        storageKey: `audit/proof-${t}.png`,
        originalFileName: `proof-${t}.png`,
        declaredMimeType: "image/png",
        detectedMimeType: "image/png",
        byteSize: 128,
        checksum: "a".repeat(64),
        purpose: "DRIVER_CASH_DEPOSIT_RECEIPT",
        ownerType: "DRIVER",
        ownerId: driver.id,
        status: "READY",
        createdByUserId: driverUser.id,
        retentionUntil: new Date(Date.now() + 86_400_000),
      },
    });
    const deposit = await submitDriverDeposit(driverUser.id, {
      orderId: firstCod.id,
      amount: firstCashDue,
      bankReference: `FNB-${t.toUpperCase()}`,
      remittanceMethod: "BANK_DEPOSIT",
      privateMediaReference: proof.publicReference,
      operationId: `aud-dep-${t}`,
    });

    // Attempt new COD assignment -> BLOCKED by DriverCashRemittanceOverdueError
    const blockedCodOrder = await bookCodOrder("DEPOSIT_PLUS_COD");
    await payOrderViaVerify(blockedCodOrder.id);
    await prisma.order.update({ where: { id: blockedCodOrder.id }, data: { deliveryRegionId: gautengRegion.id } });
    await expect(
      offerAssignment(adminUser.id, blockedCodOrder.id, { driverProfileId: driver.id }),
    ).rejects.toThrow(DriverCashRemittanceOverdueError);

    // Attempt new paid DIGITAL_ONLY assignment to SAME driver -> ALLOWED!
    const digitalOrder = await bookCodOrder("DIGITAL_ONLY");
    await prisma.order.update({ where: { id: digitalOrder.id }, data: { deliveryRegionId: gautengRegion.id } });
    await payOrderViaVerify(digitalOrder.id);
    const digitalOffer = await offerAssignment(adminUser.id, digitalOrder.id, { driverProfileId: driver.id });
    expect(digitalOffer.status).toBe(OrderAssignmentStatus.ASSIGNED);
    expect((await prisma.orderAssignment.findUniqueOrThrow({ where: { id: digitalOffer.id } })).driverProfileId).toBe(driver.id);
    await acceptDispatchAssignment(driver.id, digitalOffer.id, { expectedVersion: digitalOffer.version });
    await prisma.order.update({ where: { id: digitalOrder.id }, data: { status: OrderStatus.IN_TRANSIT } });
    expect(await adminManualDeliveryComplete(digitalOrder.id, adminUser.id, UserRole.ADMIN, { recipientName: "Recipient", reason: "Verified digital delivery correction" })).toEqual({ ok: true });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: digitalOrder.id } })).status).toBe("DELIVERED");

    // Independent finance confirmation reconciles cash -> UNBLOCKS new COD assignment!
    await reviewDriverDeposit(superAdminUser, deposit.id, {
      decision: "CONFIRM",
      bankReceiptVerified: true,
      handoverReceived: false,
      note: "Verified on FNB statement",
    });

    const summaryCleared = await driverCashSummary(driverUser.id);
    expect(summaryCleared.overdueRemittance.newCodAssignmentsBlocked).toBe(false);
    expect(summaryCleared.overdueRemittance.overdueCount).toBe(0);

    const unblockedOffer = await offerAssignment(adminUser.id, blockedCodOrder.id, {
      driverProfileId: driver.id,
    });
    expect(unblockedOffer.status).toBe(OrderAssignmentStatus.ASSIGNED);
    expect((await prisma.orderAssignment.findUniqueOrThrow({ where: { id: unblockedOffer.id } })).driverProfileId).toBe(driver.id);
  });
});
