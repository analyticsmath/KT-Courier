import { randomUUID } from "node:crypto";
import {
  AddressType,
  CompanyProfileVersionStatus,
  DeliveryType,
  DriverAvailability,
  DriverOnboardingStatus,
  DriverStatus,
  OrderAssignmentStatus,
  OrderSource,
  OrderStatus,
  Prisma,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  CompanyProfileRequiredError,
  activateCompanyProfile,
  captureIssuerSnapshotInTx,
} from "@/lib/services/company-profile.service";
import { createPublicQuote } from "@/lib/client-platform/delivery.service";
import { DeliveryConfigurationSchema } from "@/lib/client-platform/contracts";
import { createOrder } from "@/lib/services/orders.service";
import { transitionOrderStatusInTx } from "@/lib/services/order-status.service";
import { adminManualDeliveryComplete } from "@/lib/services/delivery-execution.service";
import {
  downloadAuthorizedShipmentDocumentPdf,
  getOrderDocumentAvailability,
  issueShipmentDocumentBestEffortInTx,
  recoverOrIssueShipmentDocument,
} from "@/lib/shipment-documents/service";
import { authorizeShipmentDocumentAccess } from "@/lib/shipment-documents/authorization";
import { ShipmentDocumentError } from "@/lib/shipment-documents/contracts";
import {
  issueTrackingShareGrant,
  listTrackingShareGrants,
  revokeTrackingShareGrant,
  verifyAndResolveTrackingToken,
} from "@/lib/tracking/recipient-access.server";
import { isOrderNumberUniqueConstraintError } from "@/lib/utils/order-number";
import { prepareOrderPayment } from "@/lib/services/payment-preparation.service";
import { createProviderCheckoutSession } from "@/lib/services/payment-provider-session.service";
import { recoverPaystackAttemptViaVerify } from "@/lib/services/paystack-verify-recovery.service";
import { ensureLedgerAccount, ensureWalletForOwner } from "@/lib/services/wallet-account.service";
import { PaystackAdapter } from "@/lib/payments/providers/paystack/paystack-adapter";
import type { PaystackClient } from "@/lib/payments/providers/paystack/paystack-client";
import type { PaymentProviderRegistry } from "@/lib/payments/providers/payment-provider-registry";
import type { AuthenticatedUser } from "@/types/domain";

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: vi.fn(),
  }),
}));

vi.mock("@/lib/maps/geocode.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/maps/geocode.service")>();
  return {
    ...actual,
    geocodeSouthAfricanAddress: vi.fn(async (addr: { city?: string | null }) => {
      if ((addr.city ?? "").toLowerCase().includes("sandton")) {
        return { latitude: -26.1071234, longitude: 28.0562345 };
      }
      return { latitude: -26.2051234, longitude: 28.0412345 };
    }),
    reverseGeocodeSouthAfricanProvince: vi.fn(async () => "Gauteng" as const),
  };
});

vi.mock("@/lib/maps/routes.service", () => ({
  calculateRoute: vi.fn(async () => ({
    ok: true as const,
    route: {
      distanceMeters: 15000,
      durationSeconds: 1100,
      provider: "TEST_ROUTE",
      routeSummary: "Marshalltown -> Sandhurst",
    },
  })),
}));

function toAuthUser(row: {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
}): AuthenticatedUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? "Test User",
    role: row.role,
    status: row.status,
  };
}

function createStubPaystackRegistry(merchantReferenceCapture: { value?: string }): PaymentProviderRegistry {
  const mockClient = {
    initializeTransaction: async (input: { reference: string }) => {
      merchantReferenceCapture.value = input.reference;
      return {
        authorization_url: "https://checkout.paystack.com/disposable-p0-session",
        access_code: "access_p0_disposable",
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

describe("P0 Shipment Documents, CompanyProfile SAVEPOINT, POD & Scoped Tracking Grants (PostgreSQL)", () => {
  const prefix = `p0doc${randomUUID().replace(/-/g, "").slice(0, 8)}`;
  const deliveryServiceKey = `CLIENT_${prefix.toUpperCase()}`;
  const createdProfileIds: string[] = [];

  let custOwner!: AuthenticatedUser;
  let custStranger!: AuthenticatedUser;
  let storeOwner!: AuthenticatedUser;
  let driverUser!: AuthenticatedUser;
  let adminUser!: AuthenticatedUser;
  let storeId!: string;
  let driverProfileId!: string;
  let regionId!: string;
  let createdRuleId: string | null = null;
  let createdServiceId: string | null = null;
  let createdPolicyId: string | null = null;
  let previousActiveCompanyProfileIds: string[] = [];

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.ktcouriers.com");
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
      throw new Error("Disposable kt_launch_test PostgreSQL database is required.");
    }

    const existingActive = await prisma.companyProfileVersion.findMany({
      where: { status: CompanyProfileVersionStatus.ACTIVE },
      select: { id: true },
    });
    previousActiveCompanyProfileIds = existingActive.map((p) => p.id);

    const [cOwner, cStranger, sOwner, dUser, adm, reg] = await Promise.all([
      prisma.user.create({
        data: {
          email: `${prefix}-cust@example.test`,
          name: "Thabo Mokoena",
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.user.create({
        data: {
          email: `${prefix}-stranger@example.test`,
          name: "Other Customer",
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.user.create({
        data: {
          email: `${prefix}-store@example.test`,
          name: "Store Merchant",
          role: UserRole.STORE,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.user.create({
        data: {
          email: `${prefix}-driver@example.test`,
          name: "Sipho Khumalo",
          role: UserRole.DRIVER,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.user.create({
        data: {
          email: `${prefix}-admin@example.test`,
          name: "Ops Super Admin",
          role: UserRole.SUPER_ADMIN,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.deliveryRegion.create({
        data: {
          name: `${prefix}-jhb`,
          slug: `${prefix}-jhb`,
          active: true,
          pricingEnabled: true,
          city: "Johannesburg",
          province: "Gauteng",
          coverageMode: "RADIUS",
          centerLat: "-26.2041000",
          centerLng: "28.0473000",
          coverageRadiusKm: "100.00",
          maxDistanceKm: "100.00",
        },
      }),
    ]);

    custOwner = toAuthUser(cOwner);
    custStranger = toAuthUser(cStranger);
    storeOwner = toAuthUser(sOwner);
    driverUser = toAuthUser(dUser);
    adminUser = toAuthUser(adm);
    regionId = reg.id;

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
          amount: new Prisma.Decimal("180.00"),
          baseFee: new Prisma.Decimal("180.00"),
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
          displayName: `P0 Parcel ${prefix}`,
          status: "ACTIVE",
          effectiveFrom: new Date(Date.now() - 3600_000),
          createdByUserId: adm.id,
          pricingPolicy: {
            stableKey: deliveryServiceKey,
            displayName: `P0 Parcel ${prefix}`,
            active: true,
            turnaround: "Same day",
            provinces: ["Gauteng"],
            regionIds: [reg.id],
            tariffs: {
              SMALL: { baseFee: "180.00", perKmRate: "0.00", maximumWeightKg: null, minimumCharge: null },
              MEDIUM: { baseFee: "220.00", perKmRate: "0.00", maximumWeightKg: null, minimumCharge: null },
              LARGE: { baseFee: "290.00", perKmRate: "0.00", maximumWeightKg: null, minimumCharge: null },
            },
            expectedVersion: 0,
            reason: "P0 PostgreSQL verification service",
          },
          coveragePolicy: { provinces: ["Gauteng"], regionIds: [reg.id] },
          slaMetadata: { turnaround: "Same day" },
        },
      });
      createdServiceId = svc.id;

      const existingInvalidServices = await tx.deliveryServiceDefinition.findMany({
        where: { stableKey: { startsWith: "CLIENT_" }, status: "ACTIVE", id: { not: svc.id } },
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
      }

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

      const pol = await tx.paymentMethodPolicy.create({
        data: {
          deliveryServiceId: deliveryServiceKey,
          orderType: "PARCEL_DOCUMENT",
          provinceScope: ["Gauteng"],
          versionNumber: 1,
          status: "ACTIVE",
          mode: "DIGITAL",
          effectiveFrom: new Date(Date.now() - 3600_000),
          createdByUserId: adm.id,
        },
      });
      createdPolicyId = pol.id;
    });

    const store = await prisma.store.create({
      data: {
        ownerUserId: storeOwner.id,
        name: `Store ${prefix}`,
        slug: `store-${prefix}`,
        status: "ACTIVE",
        contactEmail: `${prefix}-store@example.test`,
        province: "Gauteng",
      },
    });
    storeId = store.id;

    const drv = await prisma.driverProfile.create({
      data: {
        userId: driverUser.id,
        driverCode: `DRV-${prefix.toUpperCase()}`,
        displayName: "Sipho Khumalo",
        active: true,
        status: DriverStatus.ACTIVE,
        onboardingStatus: DriverOnboardingStatus.APPROVED,
        availability: DriverAvailability.AVAILABLE,
      },
    });
    driverProfileId = drv.id;
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    if (createdPolicyId) {
      await prisma.paymentMethodPolicy.updateMany({
        where: { id: createdPolicyId },
        data: { status: "RETIRED" },
      });
    }
    if (createdServiceId) {
      await prisma.deliveryServiceDefinition.updateMany({
        where: { id: createdServiceId },
        data: { status: "RETIRED" },
      });
    }
    if (createdRuleId) {
      await prisma.pricingRule.updateMany({
        where: { id: createdRuleId },
        data: { active: false },
      });
    }
    if (createdProfileIds.length) {
      await prisma.companyProfileVersion.updateMany({
        where: { id: { in: createdProfileIds } },
        data: { status: CompanyProfileVersionStatus.RETIRED },
      });
    }
    if (previousActiveCompanyProfileIds.length) {
      await prisma.companyProfileVersion.updateMany({
        where: { id: { in: previousActiveCompanyProfileIds } },
        data: { status: CompanyProfileVersionStatus.ACTIVE },
      });
    }
    if (regionId) {
      await prisma.deliveryRegion.updateMany({
        where: { id: regionId },
        data: { active: false, pricingEnabled: false },
      });
    }
  });

  async function createSettledOrderViaPaystackVerify(opts?: { settlePayment?: boolean }) {
    const publicQuote = await createPublicQuote({
      serviceKey: deliveryServiceKey,
      parcelSize: "SMALL",
      weightKg: "2.0",
      pickupAddress: {
        line1: "14 Commissioner Street",
        line2: "Suite 4B",
        suburb: "Marshalltown",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "2001",
      },
      dropoffAddress: {
        line1: "72 Rivonia Road",
        line2: "Block C",
        suburb: "Sandhurst",
        city: "Sandton",
        province: "Gauteng",
        postalCode: "2196",
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
        data: { ownerId: custOwner.id, ownerType: "CUSTOMER", storeId: null },
      });
      return createOrder(
        custOwner,
        {
          deliveryType: bookingMeta.deliveryType,
          pickupAddress: bookingMeta.pickupAddress as Parameters<typeof createOrder>[1]["pickupAddress"],
          dropoffAddress: bookingMeta.dropoffAddress as Parameters<typeof createOrder>[1]["dropoffAddress"],
          actualWeightKg: bookingMeta.actualWeightKg,
          pricingQuoteId: publicQuote.id,
          recipientName: "Lerato Dlamini",
          recipientPhone: "+27825550202",
          recipientEmail: "lerato@example.test",
          parcelDescription: "Confidential Tender Box",
          parcelCount: 1,
          paymentMethod: "DIGITAL_ONLY",
        },
        false,
        tx,
      );
    });

    if (opts?.settlePayment !== false) {
      const prepared = await prepareOrderPayment(custOwner, {
        orderId: order.id,
        idempotencyKey: `prep-${order.id}-${randomUUID()}`,
      });
      const paymentRow = await prisma.payment.findUniqueOrThrow({
        where: { publicReference: prepared.publicReference },
      });
      const refCap: { value?: string } = {};
      const session = await createProviderCheckoutSession(
        { id: custOwner.id },
        {
          paymentId: paymentRow.id,
          provider: "PAYSTACK",
          idempotencyKey: `sess-${order.id}-${randomUUID()}`,
        },
        { registry: createStubPaystackRegistry(refCap) },
      );

      const verifyClient = {
        verifyTransaction: vi.fn().mockResolvedValue({
          id: Math.floor(Math.random() * 900_000) + 100_000,
          status: "success",
          reference: session.attempt.merchantReference,
          amount: Math.round(Number(prepared.amount) * 100),
          currency: "ZAR",
        }),
      };

      const recovery = await recoverPaystackAttemptViaVerify({
        attemptId: session.attempt.id,
        trigger: "p0_postgres_test_verify",
        clientOverride: verifyClient as never,
      });
      expect(recovery.recovered).toBe(true);
    }

    const refreshed = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    return { order: refreshed };
  }

  it("F01: SAVEPOINT prevents aborted transaction when CompanyProfile is missing; activates and captures canonical issuer snapshot", async () => {
    await prisma.companyProfileVersion.updateMany({
      where: { status: CompanyProfileVersionStatus.ACTIVE },
      data: { status: CompanyProfileVersionStatus.RETIRED },
    });

    const { order } = await createSettledOrderViaPaystackVerify();
    expect(order.status).toBe(OrderStatus.CONFIRMED);

    await expect(
      prisma.$transaction((tx) =>
        captureIssuerSnapshotInTx(tx, {
          documentType: "waybill",
          documentReference: `waybill:${order.orderNumber}:r1`,
        }),
      ),
    ).rejects.toBeInstanceOf(CompanyProfileRequiredError);

    const txResult = await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { customerNote: "Outer tx still commits cleanly" },
      });
      return issueShipmentDocumentBestEffortInTx(tx, {
        orderId: order.id,
        type: "WAYBILL",
        actorUserId: adminUser.id,
        actorRole: "ADMIN",
        sourceEventRef: `tx-test:${order.id}`,
      });
    });
    expect(txResult.ok).toBe(false);
    if (!txResult.ok) {
      expect(txResult.code).toBe("COMPANY_PROFILE_REQUIRED");
    }

    await expect(
      downloadAuthorizedShipmentDocumentPdf({
        user: custOwner,
        orderId: order.id,
        type: "WAYBILL",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "COMPANY_PROFILE_REQUIRED",
      actionHref: "/admin/company-profile",
    });

    const v1 = await activateCompanyProfile(adminUser.id, {
      legalName: "KT Couriers (Pty) Ltd",
      tradingName: "KT Couriers",
      registrationNumber: "2026/009876/07",
      vatNumber: "4990123456",
      physicalAddress: {
        line1: "14 Commissioner Street",
        suburb: "Marshalltown",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "2001",
        country: "South Africa",
      },
      supportEmail: "support@ktcouriers.com",
      businessEmail: "ops@ktcouriers.com",
      telephoneNumbers: ["+27 11 555 0100"],
      website: "https://www.ktcouriers.com",
      documentIdentityMetadata: { walkInOffice: true },
    });
    createdProfileIds.push(v1.id);

    const snapA = await prisma.$transaction((tx) =>
      captureIssuerSnapshotInTx(tx, {
        documentType: " waybill ",
        documentReference: `waybill:${order.orderNumber.toLowerCase()}:canon`,
      }),
    );
    const snapB = await prisma.$transaction((tx) =>
      captureIssuerSnapshotInTx(tx, {
        documentType: "WAYBILL",
        documentReference: `WAYBILL:${order.orderNumber}:CANON`,
      }),
    );
    expect(snapB.id).toBe(snapA.id);

    const backfilledPdf = await downloadAuthorizedShipmentDocumentPdf({
      user: custOwner,
      orderId: order.id,
      type: "WAYBILL",
    });
    expect(Buffer.from(backfilledPdf.bytes.subarray(0, 5)).toString("ascii")).toBe("%PDF-");
  });

  it("F04: PostgreSQL SAVEPOINT catches P2002 orderNumber collision without aborting transaction (no 25P02)", async () => {
    const existing = await createSettledOrderViaPaystackVerify({ settlePayment: false });
    const freshOrderNumber = `KT-2026-${randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;

    const [pickup, dropoff] = await Promise.all([
      prisma.address.create({
        data: {
          type: AddressType.PICKUP,
          line1: "14 Commissioner Street",
          city: "Johannesburg",
          country: "South Africa",
        },
      }),
      prisma.address.create({
        data: {
          type: AddressType.DROPOFF,
          line1: "72 Rivonia Road",
          city: "Sandton",
          country: "South Africa",
        },
      }),
    ]);

    const createdId = await prisma.$transaction(async (tx) => {
      let createdOrderId: string | null = null;
      const candidates = [existing.order.orderNumber, freshOrderNumber];

      for (const candidate of candidates) {
        await tx.$executeRawUnsafe("SAVEPOINT kt_test_order_create");
        try {
          const row = await tx.order.create({
            data: {
              orderNumber: candidate,
              source: OrderSource.CUSTOMER,
              status: OrderStatus.PENDING,
              deliveryType: DeliveryType.PARCEL_DOCUMENT,
              currency: "ZAR",
              customerId: custOwner.id,
              pickupAddressId: pickup.id,
              dropoffAddressId: dropoff.id,
              recipientName: "Collision Test",
              recipientPhone: "+27825550999",
              parcelCount: 1,
              priceEstimate: new Prisma.Decimal("180.00"),
            },
          });
          await tx.$executeRawUnsafe("RELEASE SAVEPOINT kt_test_order_create");
          createdOrderId = row.id;
          break;
        } catch (err) {
          await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT kt_test_order_create");
          await tx.$executeRawUnsafe("RELEASE SAVEPOINT kt_test_order_create");
          if (isOrderNumberUniqueConstraintError(err)) {
            continue;
          }
          throw err;
        }
      }
      return createdOrderId;
    });

    expect(createdId).toBeTruthy();
  });

  it("P0-A & P0-C: Paystack settlement auto-issues Waybill PDF, enforces BOLA/Driver gating, blocks fake POD, completes Admin Manual POD -> PDF", async () => {
    const { order } = await createSettledOrderViaPaystackVerify();
    expect(order.status).toBe(OrderStatus.CONFIRMED);
    expect(order.dropoffAddressId).toBeTruthy();

    const autoWaybill = await prisma.shipmentDocument.findFirstOrThrow({
      where: { orderId: order.id, type: "WAYBILL", status: "ISSUED" },
    });
    expect(autoWaybill.revision).toBe(1);

    const custPdf = await downloadAuthorizedShipmentDocumentPdf({
      user: custOwner,
      orderId: order.id,
      type: "WAYBILL",
    });
    expect(Buffer.from(custPdf.bytes.subarray(0, 5)).toString("ascii")).toBe("%PDF-");
    const parsedWaybillPdf = await PDFDocument.load(custPdf.bytes);
    expect(parsedWaybillPdf.getPageCount()).toBeGreaterThanOrEqual(1);

    await expect(
      downloadAuthorizedShipmentDocumentPdf({
        user: custStranger,
        orderId: order.id,
        type: "WAYBILL",
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });

    expect(storeId).toBeTruthy();
    await expect(
      downloadAuthorizedShipmentDocumentPdf({
        user: storeOwner,
        orderId: order.id,
        type: "WAYBILL",
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });

    const assignment = await prisma.orderAssignment.create({
      data: {
        orderId: order.id,
        driverProfileId,
        assignedByAdminId: adminUser.id,
        status: OrderAssignmentStatus.ASSIGNED,
        activeOrderGuard: order.id,
        assignedAt: new Date(),
      },
    });
    await expect(
      downloadAuthorizedShipmentDocumentPdf({
        user: driverUser,
        orderId: order.id,
        type: "WAYBILL",
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });

    await prisma.$transaction([
      prisma.orderAssignment.update({
        where: { id: assignment.id },
        data: { status: OrderAssignmentStatus.ACCEPTED, acceptedAt: new Date() },
      }),
      prisma.order.update({
        where: { id: order.id },
        data: { currentDriverProfileId: driverProfileId },
      }),
    ]);

    const driverAuth = await authorizeShipmentDocumentAccess({
      user: driverUser,
      orderId: order.id,
      action: "WAYBILL",
    });
    expect(driverAuth.viewerRole).toBe("DRIVER");

    const drvPdf = await downloadAuthorizedShipmentDocumentPdf({
      user: driverUser,
      orderId: order.id,
      type: "WAYBILL",
    });
    expect(Buffer.from(drvPdf.bytes.subarray(0, 5)).toString("ascii")).toBe("%PDF-");

    await expect(
      downloadAuthorizedShipmentDocumentPdf({
        user: custOwner,
        orderId: order.id,
        type: "POD",
      }),
    ).rejects.toBeInstanceOf(ShipmentDocumentError);

    await prisma.address.update({
      where: { id: order.dropoffAddressId! },
      data: { line1: "999 Mutated Street Should Not Leak Into R1" },
    });
    const v2 = await activateCompanyProfile(adminUser.id, {
      legalName: "KT Couriers Updated V2 (Pty) Ltd",
      tradingName: "KT Couriers",
      supportEmail: "support@ktcouriers.com",
      website: "https://www.ktcouriers.com",
    });
    createdProfileIds.push(v2.id);

    const r1Snapshot = autoWaybill.payloadSnapshot as Record<string, unknown>;
    expect((r1Snapshot.issuer as Record<string, unknown>).legalName).toBe("KT Couriers (Pty) Ltd");
    expect((r1Snapshot.dropoff as Record<string, unknown>).line1).toBe("72 Rivonia Road");
    expect(JSON.stringify(r1Snapshot)).not.toContain("-26.2051234");
    expect(JSON.stringify(r1Snapshot)).not.toContain("28.0412345");

    const r2Issue = await recoverOrIssueShipmentDocument({
      user: adminUser,
      orderId: order.id,
      type: "WAYBILL",
      allowSupersede: true,
      revisionReason: "Legal company profile updated to v2",
    });
    expect(r2Issue.result.revision).toBe(2);
    expect(r2Issue.result.supersededPrevious).toBe(true);

    // Advance custody state cleanly through CONFIRMED -> PICKUP_SCHEDULED -> PICKED_UP -> IN_TRANSIT
    await prisma.$transaction(async (tx) => {
      await transitionOrderStatusInTx(tx, {
        orderId: order.id,
        fromStatus: OrderStatus.CONFIRMED,
        toStatus: OrderStatus.PICKUP_SCHEDULED,
        actorUserId: driverUser.id,
        actorRole: "SYSTEM",
        source: "p0_test_custody",
      });
      await transitionOrderStatusInTx(tx, {
        orderId: order.id,
        fromStatus: OrderStatus.PICKUP_SCHEDULED,
        toStatus: OrderStatus.PICKED_UP,
        actorUserId: driverUser.id,
        actorRole: "SYSTEM",
        source: "p0_test_custody",
      });
      await transitionOrderStatusInTx(tx, {
        orderId: order.id,
        fromStatus: OrderStatus.PICKED_UP,
        toStatus: OrderStatus.IN_TRANSIT,
        actorUserId: driverUser.id,
        actorRole: "SYSTEM",
        source: "p0_test_custody",
      });
    });

    const manualRes = await adminManualDeliveryComplete(
      order.id,
      adminUser.id,
      adminUser.role,
      {
        recipientName: "Lerato Dlamini",
        reason: "Recipient mobile battery flat; signed paper manifest verified on phone.",
      },
    );
    expect(manualRes).toEqual({ ok: true });

    const availability = await getOrderDocumentAvailability(order.id);
    expect(availability.waybill.issued).toBe(true);
    expect(availability.pod.issued).toBe(true);
    expect(availability.pod.proofMethod).toBe("ADMIN_MANUAL");

    const podPdf = await downloadAuthorizedShipmentDocumentPdf({
      user: custOwner,
      orderId: order.id,
      type: "POD",
    });
    expect(Buffer.from(podPdf.bytes.subarray(0, 5)).toString("ascii")).toBe("%PDF-");
    const parsedPod = await PDFDocument.load(podPdf.bytes);
    expect(parsedPod.getPageCount()).toBeGreaterThanOrEqual(1);

    // Completing driver (whose assignment moved to COMPLETED and currentDriverProfileId cleared)
    // retains download access to their own delivery's POD PDF.
    const driverPodPdf = await downloadAuthorizedShipmentDocumentPdf({
      user: driverUser,
      orderId: order.id,
      type: "POD",
    });
    expect(Buffer.from(driverPodPdf.bytes.subarray(0, 5)).toString("ascii")).toBe("%PDF-");

    const podDocRow = await prisma.shipmentDocument.findFirstOrThrow({
      where: { orderId: order.id, type: "POD", status: "ISSUED" },
    });
    expect(podDocRow.proofOfDeliveryId).toBeTruthy();
    const podSnap = podDocRow.payloadSnapshot as Record<string, unknown>;
    expect(podSnap.proofMethod).toBe("ADMIN_MANUAL");
    expect(podSnap.otpVerifiedAtIso).toBeNull();
  });

  it("P0-B: Scoped tracking grants store SHA-256 only, hide PII/GPS/money/OTP, and revoke immediately", async () => {
    const { order } = await createSettledOrderViaPaystackVerify();

    const issued = await issueTrackingShareGrant({
      user: custOwner,
      orderId: order.id,
      ttlDays: 7,
    });
    expect(issued.shareUrl).toContain("/track/share#token=");

    await expect(
      issueTrackingShareGrant({ user: custStranger, orderId: order.id }),
    ).rejects.toMatchObject({ statusCode: 403 });

    const rawToken = decodeURIComponent(issued.shareUrl.split("#token=")[1] ?? "");
    expect(rawToken.length).toBeGreaterThan(20);

    const dbGrant = await prisma.shipmentTrackingGrant.findUniqueOrThrow({
      where: { id: issued.grant.id },
    });
    expect(dbGrant.tokenSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(dbGrant.tokenSha256).not.toBe(rawToken);

    const listed = await listTrackingShareGrants({ user: custOwner, orderId: order.id });
    expect(listed.grants.some((g) => g.grantRef === issued.grant.grantRef && g.active)).toBe(true);

    const resolved = await verifyAndResolveTrackingToken(rawToken, issued.grant.grantRef);
    expect(resolved).not.toBeNull();
    expect(resolved!.projection.orderNumber).toBe(order.orderNumber);
    expect(resolved!.projection.pickupArea).toBe("Johannesburg, Gauteng");
    expect(resolved!.projection.dropoffArea).toBe("Sandton, Gauteng");

    const serialized = JSON.stringify(resolved!.projection);
    expect(serialized).not.toContain("14 Commissioner Street");
    expect(serialized).not.toContain("72 Rivonia Road");
    expect(serialized).not.toContain("+27825550202");
    expect(serialized).not.toContain("Lerato Dlamini");
    expect(serialized).not.toContain("180.00");
    expect(serialized).not.toContain("-26.205");

    const rev = await revokeTrackingShareGrant({
      user: custOwner,
      orderId: order.id,
      grantRef: issued.grant.grantRef,
    });
    expect(rev.revoked).toBe(true);
    expect(await verifyAndResolveTrackingToken(rawToken, issued.grant.grantRef)).toBeNull();
  });
});
