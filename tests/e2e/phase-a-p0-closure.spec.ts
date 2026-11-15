import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { expect, test } from "@playwright/test";
import { prisma } from "@/lib/db/prisma";
import { login, logout } from "./fixtures/auth";
import {
  DeliveryType,
  OrderSource,
  OrderStatus,
  PaymentAttemptStatus,
  PaymentProvider,
  PaymentStatus,
  UserRole,
} from "@/types/db";

const createdUserIds: string[] = [];
const createdStoreIds: string[] = [];
const createdRegionIds: string[] = [];
const createdServiceIds: string[] = [];
const createdParcelIds: string[] = [];
const createdPolicyIds: string[] = [];
const createdOrderIds: string[] = [];
const createdQuoteIds: string[] = [];

async function ensureJhbServiceCoverage(creatorUserId: string, suffix: string) {
  let region = await prisma.deliveryRegion.findFirst({
    where: { active: true, pricingEnabled: true, province: "Gauteng", coverageMode: "RADIUS" },
    orderBy: { displayOrder: "asc" },
  });
  if (!region) {
    region = await prisma.deliveryRegion.create({
      data: {
        name: `Phase A E2E JHB ${suffix}`,
        slug: `phase-a-e2e-jhb-${suffix}`,
        city: "Johannesburg",
        province: "Gauteng",
        coverageMode: "RADIUS",
        centerLat: "-26.2041000",
        centerLng: "28.0473000",
        coverageRadiusKm: "45.00",
        maxDistanceKm: "50.00",
        displayOrder: -50,
        active: true,
        pricingEnabled: true,
      },
    });
    createdRegionIds.push(region.id);
  }

  let service = await prisma.deliveryServiceDefinition.findFirst({
    where: { stableKey: "CLIENT_STANDARD", status: "ACTIVE" },
    orderBy: { versionNumber: "desc" },
  });
  if (!service) {
    const latest = await prisma.deliveryServiceDefinition.findFirst({
      where: { stableKey: "CLIENT_STANDARD" },
      orderBy: { versionNumber: "desc" },
    });
    service = await prisma.deliveryServiceDefinition.create({
      data: {
        stableKey: "CLIENT_STANDARD",
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        displayName: "Standard",
        status: "ACTIVE",
        effectiveFrom: new Date(Date.now() - 60_000),
        createdByUserId: creatorUserId,
        pricingPolicy: {
          stableKey: "CLIENT_STANDARD",
          displayName: "Standard",
          active: true,
          turnaround: "1-2 business days",
          provinces: ["Gauteng"],
          regionIds: [],
          tariffs: {
            SMALL: { baseFee: "129.00", perKmRate: "0.00", maximumWeightKg: 5, minimumCharge: null },
            MEDIUM: { baseFee: "179.00", perKmRate: "0.00", maximumWeightKg: 15, minimumCharge: null },
            LARGE: { baseFee: "249.00", perKmRate: "0.00", maximumWeightKg: 30, minimumCharge: null },
          },
          expectedVersion: latest?.versionNumber ?? 0,
          reason: "Phase A E2E fixture standard service",
        },
        coveragePolicy: { provinces: ["Gauteng"], regionIds: [] },
        slaMetadata: { turnaround: "1-2 business days" },
      },
    });
    createdServiceIds.push(service.id);
  }

  let parcel = await prisma.parcelProfileVersion.findFirst({ where: { stableKey: "SMALL", status: "ACTIVE" } });
  if (!parcel) {
    const latestParcel = await prisma.parcelProfileVersion.findFirst({
      where: { stableKey: "SMALL" },
      orderBy: { versionNumber: "desc" },
    });
    parcel = await prisma.parcelProfileVersion.create({
      data: {
        stableKey: "SMALL",
        displayName: "Small",
        versionNumber: (latestParcel?.versionNumber ?? 0) + 1,
        status: "ACTIVE",
        lengthCm: 30,
        widthCm: 20,
        heightCm: 10,
        maximumWeightKg: 5,
        effectiveFrom: new Date(Date.now() - 60_000),
        createdByUserId: creatorUserId,
      },
    });
    createdParcelIds.push(parcel.id);
  }

  let opPolicy = await prisma.storeOrderOperationalPolicy.findFirst({ where: { status: "ACTIVE" } });
  if (!opPolicy) {
    opPolicy = await prisma.storeOrderOperationalPolicy.create({
      data: {
        publicReference: `SOP-E2E-PA-${suffix}`,
        name: `phase-a-e2e-policy-${suffix}`,
        versionNumber: 1,
        status: "ACTIVE",
        acceptanceWindowSeconds: 900,
        customerDecisionWindowSeconds: 900,
        maximumPrepMinutes: 60,
        maximumPrepExtensionMinutes: 30,
        maximumIssueCount: 3,
        maximumSubstitutionProposalsPerLine: 2,
        effectiveFrom: new Date(Date.now() - 60_000),
        approvedByUserId: creatorUserId,
        activatedAt: new Date(),
      },
    });
    createdPolicyIds.push(opPolicy.id);
  }

  return { region, service, parcel, opPolicy };
}

test.afterAll(async () => {
  for (const id of createdOrderIds) await prisma.order.delete({ where: { id } }).catch(() => {});
  for (const id of createdQuoteIds) await prisma.pricingQuote.delete({ where: { id } }).catch(() => {});
  for (const id of createdStoreIds) await prisma.store.delete({ where: { id } }).catch(() => {});
  for (const id of createdServiceIds) await prisma.deliveryServiceDefinition.delete({ where: { id } }).catch(() => {});
  for (const id of createdParcelIds) await prisma.parcelProfileVersion.delete({ where: { id } }).catch(() => {});
  for (const id of createdPolicyIds) await prisma.storeOrderOperationalPolicy.delete({ where: { id } }).catch(() => {});
  for (const id of createdRegionIds) await prisma.deliveryRegion.delete({ where: { id } }).catch(() => {});
  for (const id of createdUserIds) await prisma.user.delete({ where: { id } }).catch(() => {});
});

test.describe("Phase A P0 browser closure workflows (F01..F04)", () => {
  for (const width of [1440, 390]) {
    test(`F01/F04: store staff cancels pre-gateway parcel cleanly and sees conflict (409) resolution banner while payment is pending at ${width}px`, async ({ page }) => {
      test.setTimeout(90_000);
      const suffix = `${width}-${randomUUID().slice(0, 8)}`;
      const passwordHash = await bcrypt.hash("ChangeMe123!", 10);

      const owner = await prisma.user.create({
        data: {
          email: `e2e-pa-owner-${suffix}@ktcouriers.local`,
          name: "Phase A Owner",
          role: UserRole.STORE,
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
          passwordHash,
        },
      });
      createdUserIds.push(owner.id);

      const staff = await prisma.user.create({
        data: {
          email: `e2e-pa-staff-${suffix}@ktcouriers.local`,
          name: "Phase A Multi-Store Staff",
          role: UserRole.CUSTOMER,
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
          passwordHash,
        },
      });
      createdUserIds.push(staff.id);

      const storeA = await prisma.store.create({
        data: {
          ownerUserId: owner.id,
          name: `Phase A Store A ${suffix}`,
          slug: `pa-store-a-${suffix}`,
          status: "ACTIVE",
          contactEmail: owner.email,
        },
      });
      createdStoreIds.push(storeA.id);

      const storeB = await prisma.store.create({
        data: {
          ownerUserId: staff.id,
          name: `Phase A Store B ${suffix}`,
          slug: `pa-store-b-${suffix}`,
          status: "ACTIVE",
          contactEmail: staff.email,
        },
      });
      createdStoreIds.push(storeB.id);

      await prisma.storeEmployeeMembership.create({
        data: {
          storeId: storeA.id,
          userId: staff.id,
          invitedByUserId: owner.id,
          email: staff.email,
          roleLabel: "Operations",
          permissions: ["orders", "deliveries", "finance"],
          status: "ACTIVE",
          acceptedAt: new Date(),
        },
      });

      const mkOrder = async (kind: string) => {
        const quote = await prisma.pricingQuote.create({
          data: {
            status: "USED",
            ownerType: "STORE",
            ownerId: storeA.id,
            deliveryType: DeliveryType.SAME_DAY,
            currency: "ZAR",
            calculationVersion: "phase-a-e2e-v1",
            inputHash: createHash("sha256").update(`q-${kind}-${suffix}`).digest("hex"),
            distanceMeters: 5000,
            rawDistanceKm: "5.0000",
            billableDistanceKm: "5.0000",
            subtotal: "120.00",
            taxRate: "0.0000",
            taxAmount: "0.00",
            total: "120.00",
            inputSnapshot: {},
            ruleSnapshot: {},
            regionSnapshot: {},
            taxSnapshot: { enabled: false },
            expiresAt: new Date("2035-01-01"),
            usedAt: new Date(),
          },
        });
        createdQuoteIds.push(quote.id);

        const order = await prisma.order.create({
          data: {
            orderNumber: `KT-PAE2E-${kind}-${suffix.slice(-6).toUpperCase()}`,
            source: OrderSource.STORE,
            status: OrderStatus.PENDING,
            deliveryType: DeliveryType.SAME_DAY,
            currency: "ZAR",
            storeId: storeA.id,
            priceEstimate: "120.00",
            pricingQuoteId: quote.id,
            pricingSubtotal: "120.00",
            pricingTaxAmount: "0.00",
            pricingTaxRate: "0.0000",
            pricingSnapshot: { quoteId: quote.id },
          },
        });
        createdOrderIds.push(order.id);
        return order;
      };

      const orderPreGateway = await mkOrder("PRE");
      const orderInFlight = await mkOrder("INF");

      const paymentPre = await prisma.payment.create({
        data: {
          publicReference: `pay_e2e_pre_${suffix}`,
          userId: staff.id,
          orderId: orderPreGateway.id,
          purpose: "ORDER",
          status: PaymentStatus.CREATED,
          amount: "120.00",
          currency: "ZAR",
          creationIdempotencyKey: `pa-e2e-pre:${suffix}`,
          creationRequestHash: createHash("sha256").update(`pre-${suffix}`).digest("hex"),
        },
      });

      const paymentInFlight = await prisma.payment.create({
        data: {
          publicReference: `pay_e2e_inf_${suffix}`,
          userId: staff.id,
          orderId: orderInFlight.id,
          provider: PaymentProvider.PAYSTACK,
          purpose: "ORDER",
          status: PaymentStatus.PROVIDER_PENDING,
          amount: "120.00",
          currency: "ZAR",
          creationIdempotencyKey: `pa-e2e-inf:${suffix}`,
          creationRequestHash: createHash("sha256").update(`inf-${suffix}`).digest("hex"),
          latestAttemptNumber: 1,
        },
      });
      await prisma.paymentAttempt.create({
        data: {
          paymentId: paymentInFlight.id,
          publicReference: `pat_e2e_inf_${suffix}`,
          attemptNumber: 1,
          provider: PaymentProvider.PAYSTACK,
          idempotencyKey: `pa-e2e-att:${suffix}`,
          requestHash: createHash("sha256").update(`att-${suffix}`).digest("hex"),
          merchantReference: `kt:payment:${paymentInFlight.publicReference}:attempt:1`,
          status: PaymentAttemptStatus.REQUIRES_ACTION,
          amount: "120.00",
          currency: "ZAR",
          redirectUrl: "https://checkout.paystack.com/test-e2e",
          providerEnvironment: "SANDBOX",
          providerProtocolVersion: "paystack-v1",
          configurationFingerprint: "cfg_e2e_phase_a",
          providerCredentialVersion: "test-v1",
          requestSnapshot: { phaseA: true },
          startedAt: new Date(),
        },
      });

      await page.setViewportSize({ width, height: 900 });
      await login(page, staff.email);

      // 1) In-flight gateway payment -> 409 conflict & pending banner with storeContextId forwarded
      await page.goto(`/store/orders/${orderInFlight.id}?storeId=${encodeURIComponent(storeA.id)}`);
      await expect(page.getByRole("heading", { name: orderInFlight.orderNumber })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

      await page.getByRole("button", { name: "Cancel this order", exact: true }).click();
      const pendingResPromise = page.waitForResponse(
        (res) => res.url().endsWith(`/api/orders/${orderInFlight.id}/cancel`) && res.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Yes, cancel order", exact: true }).click();
      const pendingRes = await pendingResPromise;
      expect(pendingRes.status()).toBe(409);
      const pendingBody = await pendingRes.json();
      expect(pendingBody).toMatchObject({ code: "CANCELLATION_PENDING_PAYMENT_RESOLUTION" });
      await expect(page.getByTestId("cancellation-pending-payment-banner")).toBeVisible();
      await expect(page.getByText(/Cancellation awaiting payment confirmation/)).toBeVisible();
      expect(await prisma.parcelCancellationResolution.count({ where: { orderId: orderInFlight.id } })).toBe(1);

      // 2) Pre-gateway prepared parcel -> clean terminal cancellation
      await page.goto(`/store/orders/${orderPreGateway.id}?storeId=${encodeURIComponent(storeA.id)}`);
      await page.getByRole("button", { name: "Cancel this order", exact: true }).click();
      const cleanCancelPromise = page.waitForResponse(
        (res) => res.url().endsWith(`/api/orders/${orderPreGateway.id}/cancel`) && res.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Yes, cancel order", exact: true }).click();
      const cleanCancelRes = await cleanCancelPromise;
      expect(cleanCancelRes.status()).toBe(200);
      expect((await prisma.order.findUniqueOrThrow({ where: { id: orderPreGateway.id } })).status).toBe("CANCELLED");
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: paymentPre.id } })).status).toBe("CANCELLED");
    });
  }

  test("F02: quote booking UI disables Paystack card selection cleanly when gateway is configured but inactive", async ({ page }) => {
    test.setTimeout(60_000);
    const suffix = randomUUID().slice(0, 8);
    const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
    const customer = await prisma.user.create({
      data: {
        email: `e2e-pa-cust-${suffix}@ktcouriers.local`,
        name: "Phase A Customer",
        role: UserRole.CUSTOMER,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        passwordHash,
      },
    });
    createdUserIds.push(customer.id);

    const quote = await prisma.pricingQuote.create({
      data: {
        status: "ACTIVE",
        ownerType: "CUSTOMER",
        ownerId: customer.id,
        deliveryType: DeliveryType.SAME_DAY,
        currency: "ZAR",
        calculationVersion: "client-delivery-v1",
        inputHash: createHash("sha256").update(`f02-q-${suffix}`).digest("hex"),
        distanceMeters: 4200,
        rawDistanceKm: "4.2000",
        billableDistanceKm: "4.2000",
        subtotal: "129.00",
        taxRate: "0.0000",
        taxAmount: "0.00",
        total: "129.00",
        inputSnapshot: {
          serviceKey: "CLIENT_STANDARD",
          parcelSize: "SMALL",
          weightKg: "1.0",
          pickupAddress: { line1: "10 E2E Pickup Road", city: "Johannesburg", province: "Gauteng", postalCode: "2001" },
          dropoffAddress: { line1: "45 Commission St", city: "Johannesburg", province: "Gauteng", postalCode: "2001" },
        },
        ruleSnapshot: {
          serviceKey: "CLIENT_STANDARD",
          serviceName: "Standard",
          turnaround: "1-2 business days",
          parcelSize: "SMALL",
          lineItems: [{ code: "BASE", label: "Standard · Small parcel", amount: "129.00" }],
        },
        regionSnapshot: { regionName: "Johannesburg", pickupSummary: "10 E2E Pickup Road, Johannesburg", dropoffSummary: "45 Commission St, Johannesburg" },
        taxSnapshot: { enabled: false },
        metadata: {
          serviceName: "Standard",
          turnaround: "1-2 business days",
          bookingInput: {
            pickupAddress: { line1: "10 E2E Pickup Road", city: "Johannesburg", province: "Gauteng", postalCode: "2001" },
            dropoffAddress: { line1: "45 Commission St", city: "Johannesburg", province: "Gauteng", postalCode: "2001" },
          },
        },
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    createdQuoteIds.push(quote.id);

    await page.route(`**/api/public/delivery-quotes/${quote.id}/payment-methods`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          quoteId: quote.id,
          methods: [],
          cod: { eligible: false, amountDueAtDelivery: "129.00", message: "Cash on delivery is not currently enabled." },
          card: {
            eligible: false,
            message: "Paystack card checkout is configured but inactive until activation is enabled.",
          },
        }),
      });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, customer.email);
    await page.goto(`/quote/book?reference=${quote.id}`);
    await expect(page.getByRole("heading", { name: "Complete your delivery" })).toBeVisible();
    await expect(page.getByText(/Paystack card checkout is configured but inactive/)).toBeVisible();
    await expect(page.getByRole("radio", { name: /^Card \/ online payment/i })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Book and continue to card payment", exact: true })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });

  test("F03: Admin readiness and dossier reject fabricated receipt, execute SAVEPOINT engine proof, block self-approval, and accept independent approval", async ({ page }) => {
    test.setTimeout(120_000);
    const suffix = randomUUID().slice(0, 8);
    const passwordHash = await bcrypt.hash("ChangeMe123!", 10);

    const admin1 = await prisma.user.create({
      data: {
        email: `e2e-pa-adm1-${suffix}@ktcouriers.local`,
        name: "Phase A Admin Reviewer One",
        role: UserRole.SUPER_ADMIN,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        passwordHash,
      },
    });
    createdUserIds.push(admin1.id);

    const admin2 = await prisma.user.create({
      data: {
        email: `e2e-pa-adm2-${suffix}@ktcouriers.local`,
        name: "Phase A Admin Reviewer Two",
        role: UserRole.SUPER_ADMIN,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        passwordHash,
      },
    });
    createdUserIds.push(admin2.id);

    const storeOwner = await prisma.user.create({
      data: {
        email: `e2e-pa-st-own-${suffix}@ktcouriers.local`,
        name: "Phase A Store Owner",
        role: UserRole.STORE,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        passwordHash,
      },
    });
    createdUserIds.push(storeOwner.id);

    await ensureJhbServiceCoverage(admin1.id, suffix);

    const store = await prisma.store.create({
      data: {
        ownerUserId: storeOwner.id,
        name: `Phase A Cert Store ${suffix}`,
        slug: `pa-cert-store-${suffix}`,
        status: "PENDING",
        contactEmail: storeOwner.email,
      },
    });
    createdStoreIds.push(store.id);

    const pickup = await prisma.address.create({
      data: {
        storeId: store.id,
        type: "PICKUP",
        isDefault: true,
        line1: "10 E2E Pickup Road",
        line2: "Central",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "2001",
        country: "South Africa",
        latitude: "-26.2041000",
        longitude: "28.0473000",
      },
    });
    await prisma.store.update({ where: { id: store.id }, data: { defaultPickupAddressId: pickup.id } });

    await prisma.storeSellerLegalIdentity.create({
      data: {
        storeId: store.id,
        publicReference: `SID-E2E-PA-${suffix}`,
        identityVersion: "PAMMY_BAKES_V1",
        legalName: "Pammy Sole Trader",
        tradingName: "Pammy Bakes",
        vatRegistrationStatus: "NOT_REGISTERED",
        invoiceClassification: "RECEIPT",
        status: "APPROVED",
        effectiveFrom: new Date(Date.now() - 60_000),
      },
    });

    await prisma.commissionPlan.create({
      data: {
        publicReference: `CPL-E2E-PA-${suffix}`,
        subjectType: "MARKETPLACE_STORE_ORDER",
        scopeKey: `STORE:${store.id}`,
        currency: "ZAR",
        versionNumber: 1,
        status: "ACTIVE",
        basisType: "ORDER_SUBTOTAL",
        effectiveFrom: new Date(Date.now() - 60_000),
        createdByUserId: admin1.id,
        submittedByUserId: admin1.id,
        submittedAt: new Date(),
        approvedByUserId: admin2.id,
        approvedAt: new Date(),
        activatedAt: new Date(),
        calculationVersion: "phase-a-e2e-v1",
        rules: {
          create: {
            publicReference: `CRU-E2E-PA-${suffix}`,
            ruleCode: "PLATFORM_COMMISSION",
            allocationType: "PLATFORM_COMMISSION_REVENUE",
            beneficiaryType: "PLATFORM",
            calculationMethod: "FIXED_AMOUNT",
            fixedAmount: "1.00",
            priority: 1,
          },
        },
      },
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, admin1.email);

    // Readiness preflight view
    await page.goto(`/admin/stores/${store.id}/readiness`);
    await expect(page.getByRole("heading", { name: "Store collection preflight" })).toBeVisible();
    await expect(page.getByText("Checkout capability preflight: Ready for independent certification review")).toBeVisible();

    // Store dossier certification workflow
    await page.goto(`/admin/stores/${store.id}`);
    await page.locator("#cert-route-ref").fill("pay_fabricated_ref_123");
    await page.locator("#cert-route-digest").fill("a".repeat(64));
    await page.locator("#cert-paid-ref").fill("trx_fabricated_ref_123");
    await page.locator("#cert-paid-digest").fill("b".repeat(64));
    await page.locator("#cert-review-note").fill("Browser E2E negative check rejecting fabricated external receipts.");
    await page.getByRole("button", { name: "Submit staging certification for independent review", exact: true }).click();
    await expect(page.locator('p[role="alert"]')).toContainText(/Fabricated external transaction references/i);

    const prepResPromise = page.waitForResponse(
      (res) => res.url().endsWith(`/api/admin/stores/${store.id}/checkout-certification`) && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Generate deterministic capability preflight for review", exact: true }).click();
    const prepRes = await prepResPromise;
    expect(prepRes.status(), await prepRes.text()).toBe(200);
    await expect(page.getByTestId("engine-proof-stages")).toBeVisible();
    await expect(page.getByTestId("engine-proof-stages").getByText("PASS")).toHaveCount(6);
    await expect(page.getByText(/DISPOSABLE END TO END CHECKOUT PROOF|DISPOSABLE_END_TO_END_CHECKOUT_PROOF/i)).toBeVisible();

    // Self-approval blocked for admin1
    await page.getByRole("button", { name: "Approve independently reviewed staging evidence", exact: true }).click();
    await expect(page.locator('p[role="alert"]')).toBeVisible();

    // Independent approval by admin2 persists across reload
    await logout(page);
    await login(page, admin2.email);
    await page.goto(`/admin/stores/${store.id}`);
    const approveResPromise = page.waitForResponse(
      (res) => res.url().endsWith(`/api/admin/stores/${store.id}/checkout-certification`) && res.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Approve independently reviewed staging evidence", exact: true }).click();
    expect((await approveResPromise).status()).toBe(200);

    await page.reload();
    await expect(page.getByText("APPROVED", { exact: true })).toBeVisible();
    await expect(page.getByTestId("engine-proof-stages")).toBeVisible();
  });
});
