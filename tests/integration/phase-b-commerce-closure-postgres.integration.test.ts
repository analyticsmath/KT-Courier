import { createHash, randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { PaymentProviderRegistry } from "@/lib/payments/providers/payment-provider-registry";
import { PaystackAdapter } from "@/lib/payments/providers/paystack/paystack-adapter";
import {
  evaluatePaystackEftReadiness,
  type PaystackRuntimeConfiguration,
} from "@/lib/payments/providers/paystack/paystack-config";
import { createProviderCheckoutSession } from "@/lib/services/payment-provider-session.service";
import { prepareOrderPayment } from "@/lib/services/payment-preparation.service";
import { prepareMarketplacePayment } from "@/lib/marketplace-checkout/checkout.service";
import {
  addCartLine,
  createOrResolveCart,
} from "@/lib/marketplace-checkout/cart-mutation.service";
import { resolveMarketplaceCartLine } from "@/lib/marketplace-checkout/cart.service";
import { claimGuestCartIfPresentOnCustomerAuth } from "@/lib/marketplace-checkout/claim-guest-cart-on-login";
import { createPrismaMarketplaceCartRepository } from "@/lib/marketplace-checkout/prisma-cart-repository";
import { hashMarketplaceGuestSecret, MARKETPLACE_CART_COOKIE } from "@/lib/marketplace-checkout/tokens";
import { resolveMarketplacePaymentPlan } from "@/lib/marketplace-checkout/payment-plan";
import { submitStoreSellerIdentity, reviewStoreSellerIdentity } from "@/lib/services/store-seller-identity.service";
import { setDriverEngagement, DriverEngagementConflict } from "@/lib/services/driver-engagement.service";
import { assertDriverCashCapacityForAssignment, DriverCashLimitError, updateDriverCashLimit } from "@/lib/services/driver-cash-capacity.service";
import { offerAssignment } from "@/lib/services/dispatch-assignment.service";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import { createDriver, createRegion, createUser, uniqueTag } from "./phase7-5-fixtures";
import { DeliveryType, OrderSource, OrderStatus, UserRole } from "@/types/db";

const savedEnv: Record<string, string | undefined> = {};
function setTempEnv(patch: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in savedEnv)) savedEnv[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function capturePaystackRegistry(opts: { eftChannelEnabled: boolean; recordedChannels: Array<string[] | undefined> }) {
  const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const parsed = JSON.parse(String(init?.body ?? "{}"));
    opts.recordedChannels.push(Array.isArray(parsed.channels) ? [...parsed.channels] : undefined);
    return new Response(
      JSON.stringify({
        status: true,
        message: "Authorization URL created",
        data: {
          authorization_url: `https://checkout.paystack.com/${encodeURIComponent(String(parsed.reference ?? ""))}`,
          access_code: `ac_${String(parsed.reference ?? "")}`,
          reference: parsed.reference,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });
  vi.stubGlobal("fetch", fetchMock);

  const configuration: PaystackRuntimeConfiguration = {
    mode: "test",
    environment: "sandbox",
    secretKey: "sk_test_phase_b_pg",
    appOrigin: "https://ktcouriers.example",
    apiBaseUrl: "https://api.paystack.co",
    credentialVersion: "test-v1",
    checkoutAuditVersion: "paystack-redirect-v1",
    configurationFingerprint: "paystack-v1:sandbox",
    eftChannelEnabled: opts.eftChannelEnabled,
  };

  const adapter = new PaystackAdapter(configuration);
  return new PaymentProviderRegistry({ adapters: [adapter] });
}

async function createCustomerParcelOrder(customerId: string, total = "129.00") {
  const quote = await prisma.pricingQuote.create({
    data: {
      status: "USED",
      ownerType: "CUSTOMER",
      ownerId: customerId,
      deliveryType: DeliveryType.SAME_DAY,
      currency: "ZAR",
      calculationVersion: "phase-b-pg",
      inputHash: randomUUID().replaceAll("-", "") + "0".repeat(32),
      distanceMeters: 4000,
      rawDistanceKm: "4.0000",
      billableDistanceKm: "4.0000",
      subtotal: total,
      taxRate: "0.0000",
      taxAmount: "0.00",
      total,
      inputSnapshot: {},
      ruleSnapshot: {},
      regionSnapshot: {},
      taxSnapshot: { enabled: false },
      expiresAt: new Date("2035-01-01"),
      usedAt: new Date(),
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: `KT-PB-${randomUUID().slice(0, 12).toUpperCase()}`,
      source: OrderSource.CUSTOMER,
      status: OrderStatus.PENDING,
      deliveryType: DeliveryType.SAME_DAY,
      currency: "ZAR",
      customerId,
      priceEstimate: total,
      pricingQuoteId: quote.id,
      pricingSubtotal: total,
      pricingTaxAmount: "0.00",
      pricingTaxRate: "0.0000",
      pricingSnapshot: { quoteId: quote.id, calculationVersion: "phase-b-pg" },
    },
  });
  return { quote, order };
}

describe("Phase B PG Commerce Closure — F05, CR-062, CR-096..128", () => {
  beforeAll(() => {
    requireDisposableStoreSettlementDatabase();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
      delete savedEnv[key];
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("F05: Paystack EFT fail-closed gating, channel routing, and attemptHash separation", () => {
    it("blocks unapproved EFT before consuming any attempt, routes CARD vs EFT when approved, and differentiates attemptHash on replay", async () => {
      const tag = uniqueTag("pb-f05");
      const customer = await createUser(`${tag}-cust`, UserRole.CUSTOMER);
      const { order } = await createCustomerParcelOrder(customer.id, "129.00");
      const payment = await prepareOrderPayment(
        { id: customer.id, email: customer.email },
        { orderId: order.id, idempotencyKey: `prep:${tag}` },
      );

      setTempEnv({
        PAYSTACK_MODE: "test",
        PAYSTACK_ACTIVE: "true",
        PAYSTACK_SECRET_KEY: "sk_test_f05_pg_key_0123456789abcdef",
        PAYSTACK_PUBLIC_KEY: "pk_test_f05_pg_key_0123456789abcdef",
        PAYSTACK_CREDENTIAL_VERSION: "test-v1",
        PAYMENT_APP_ORIGIN: "https://ktcouriers.example",
        PAYSTACK_EFT_CHANNEL_ENABLED: undefined,
      });

      const readinessDisabled = evaluatePaystackEftReadiness();
      expect(readinessDisabled.ready).toBe(false);
      expect(readinessDisabled.reasonCode).toBe("PROVIDER_CHANNEL_NOT_ENABLED");

      // Without custom registry: fails closed BEFORE reserving any PaymentAttempt
      await expect(
        createProviderCheckoutSession(
          { id: customer.id },
          { paymentId: payment.id, provider: "PAYSTACK", idempotencyKey: `eft-blocked:${tag}`, channel: "EFT" },
        ),
      ).rejects.toMatchObject({ name: "PaymentError", code: "EFT_UNAVAILABLE" });
      expect(await prisma.paymentAttempt.count({ where: { paymentId: payment.id } })).toBe(0);

      // Marketplace checkout EFT preparation also fails closed upfront before DB mutation
      await expect(
        prepareMarketplacePayment({
          reference: `CHK-${tag}`,
          owner: { type: "CUSTOMER", userId: customer.id },
          expectedVersion: 1,
          operationId: `mkt-eft-blocked:${tag}`,
          requestHash: "b".repeat(64),
          channel: "EFT",
        }),
      ).rejects.toMatchObject({ name: "PaymentError", code: "EFT_UNAVAILABLE" });

      // CARD works when EFT is disabled and sends channels: ["card"]
      const cardChannels: Array<string[] | undefined> = [];
      const cardRegistry = capturePaystackRegistry({ eftChannelEnabled: false, recordedChannels: cardChannels });
      const cardKey = `card-sess:${tag}`;
      const cardSession = await createProviderCheckoutSession(
        { id: customer.id },
        { paymentId: payment.id, provider: "PAYSTACK", idempotencyKey: cardKey, channel: "CARD" },
        { registry: cardRegistry },
      );
      expect(cardSession.attempt.status).toBe("REQUIRES_ACTION");
      expect(cardChannels).toEqual([["card"]]);

      // Switching channel across the SAME idempotencyKey rejects due to attemptHash mismatch
      const eftChannels: Array<string[] | undefined> = [];
      const eftRegistry = capturePaystackRegistry({ eftChannelEnabled: true, recordedChannels: eftChannels });
      await expect(
        createProviderCheckoutSession(
          { id: customer.id },
          { paymentId: payment.id, provider: "PAYSTACK", idempotencyKey: cardKey, channel: "EFT" },
          { registry: eftRegistry },
        ),
      ).rejects.toMatchObject({ code: "PAYMENT_ATTEMPT_IDEMPOTENCY_CONFLICT" });
      expect(eftChannels).toHaveLength(0);

      // Fresh order/payment with approved EFT sends channels: ["eft"] and persists paymentChannel: "EFT"
      setTempEnv({ PAYSTACK_EFT_CHANNEL_ENABLED: "true" });
      expect(evaluatePaystackEftReadiness()).toMatchObject({
        ready: true,
        reasonCode: "READY",
        channelRequested: "eft",
      });

      const { order: order2 } = await createCustomerParcelOrder(customer.id, "179.00");
      const payment2 = await prepareOrderPayment(
        { id: customer.id, email: customer.email },
        { orderId: order2.id, idempotencyKey: `prep2:${tag}` },
      );
      const eftSession = await createProviderCheckoutSession(
        { id: customer.id },
        { paymentId: payment2.id, provider: "PAYSTACK", idempotencyKey: `eft-ok:${tag}`, channel: "EFT" },
        { registry: eftRegistry },
      );
      expect(eftSession.attempt.status).toBe("REQUIRES_ACTION");
      expect(eftChannels).toEqual([["eft"]]);

      const attemptRow = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: eftSession.attempt.id } });
      expect((attemptRow.requestSnapshot as Record<string, unknown>)?.paymentChannel).toBe("EFT");
    });
  });

  describe("CR-062: Guest cart automatic non-destructive merge on CUSTOMER authentication", () => {
    it("merges anonymous kt_marketplace_cart into existing customer cart without losing customer items and clears cookie", async () => {
      const tag = uniqueTag("pb-cr062");
      const owner = await createUser(`${tag}-store-owner`, UserRole.STORE);
      const approver = await createUser(`${tag}-approver`, UserRole.ADMIN);
      const customer = await createUser(`${tag}-cust`, UserRole.CUSTOMER);

      const store = await prisma.store.create({
        data: { name: `Store ${tag}`, slug: `st-${tag}`, status: "ACTIVE", ownerUserId: owner.id },
      });
      const location = await prisma.inventoryLocation.create({
        data: { publicReference: `loc-${tag}`, storeId: store.id, name: "Main", status: "ACTIVE", isPrimary: true },
      });
      const productType = await prisma.productTypeDefinition.create({
        data: {
          publicReference: `pt-${tag}`,
          code: `PT_${tag.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}`,
          name: "Bakery",
          versionNumber: 1,
          status: "ACTIVE",
          attributeSchema: {},
          variantSchema: {},
          complianceSchema: {},
          searchFacetSchema: {},
          createdByUserId: approver.id,
          approvedByUserId: approver.id,
          activatedAt: new Date(),
        },
      });
      const category = await prisma.catalogCategory.create({
        data: {
          publicReference: `cat-${tag}`,
          name: "Bread",
          slug: `cat-${tag}`,
          path: `/cat-${tag}`,
          status: "ACTIVE",
          createdByUserId: approver.id,
          updatedByUserId: approver.id,
        },
      });

      async function createOffer(suffix: string, priceAmount: string) {
        const prod = await prisma.catalogProduct.create({
          data: {
            publicReference: `prod-${tag}-${suffix}`,
            scope: "STORE_PRIVATE",
            sourceStoreId: store.id,
            productTypeDefinitionId: productType.id,
            productTypeVersionNumber: 1,
            primaryCategoryId: category.id,
            title: `Loaf ${suffix}`,
            normalizedTitle: `loaf ${suffix}`,
            attributeValues: {},
            complianceValues: {},
            status: "DRAFT",
            moderationStatus: "NOT_SUBMITTED",
            publicationStatus: "DRAFT",
            slug: `loaf-${tag}-${suffix}`,
            qualityIssues: [],
            createdByUserId: approver.id,
          },
        });
        const variant = await prisma.catalogProductVariant.create({
          data: {
            publicReference: `var-${tag}-${suffix}`,
            productId: prod.id,
            title: "Standard",
            normalizedTitle: "standard",
            optionFingerprint: `def-${tag}-${suffix}`,
            attributeValues: {},
            status: "ACTIVE",
          },
        });
        await prisma.catalogProduct.update({
          where: { id: prod.id },
          data: {
            status: "ACTIVE",
            moderationStatus: "APPROVED",
            publicationStatus: "PUBLISHED",
            approvedByUserId: approver.id,
          },
        });
        const offer = await prisma.storeCatalogOffer.create({
          data: {
            publicReference: `off-${tag}-${suffix}`,
            storeId: store.id,
            productId: prod.id,
            variantId: variant.id,
            storeSku: `SKU-${tag}-${suffix}`,
            status: "DRAFT",
            publicationStatus: "DRAFT",
            inventoryTrackingMode: "UNTRACKED",
            fulfilmentMode: "COURIER_DELIVERY",
            sellingUnit: "EACH",
            primaryInventoryLocationId: location.id,
            createdByUserId: approver.id,
          },
        });
        const price = await prisma.storeOfferPriceVersion.create({
          data: {
            publicReference: `prc-${tag}-${suffix}`,
            offerId: offer.id,
            versionNumber: 1,
            amount: priceAmount,
            currency: "ZAR",
            effectiveFrom: new Date(Date.now() - 60_000),
            status: "ACTIVE",
            createdByUserId: approver.id,
            activatedByUserId: approver.id,
            activatedAt: new Date(),
          },
        });
        return prisma.storeCatalogOffer.update({
          where: { id: offer.id },
          data: {
            currentPriceVersionId: price.id,
            status: "ACTIVE",
            publicationStatus: "PUBLISHED",
            approvedByUserId: approver.id,
          },
          include: { variant: true },
        });
      }

      const [offerA, offerB] = await Promise.all([createOffer("A", "45.00"), createOffer("B", "80.00")]);

      // Seed existing CUSTOMER cart with offerA qty 2
      const repo = createPrismaMarketplaceCartRepository();
      const customerOwner = { type: "CUSTOMER" as const, userId: customer.id };
      const customerCart = await createOrResolveCart(repo, customerOwner, () => repo.create(customerOwner));
      const selCustA = await resolveMarketplaceCartLine({
        offerReference: offerA.publicReference,
        variantReference: offerA.variant.publicReference,
        modifiers: [],
        quantity: 2,
      });
      await addCartLine(repo, {
        cartId: customerCart.id,
        owner: customerOwner,
        mutation: { operationId: `cust-a:${tag}`, requestHash: `cust-a-h:${tag}`, expectedVersion: customerCart.version },
        selection: selCustA,
      });

      // Seed GUEST cart with offerA qty 1 + offerB qty 3
      const guestSecret = `guest-secret-${tag}-${randomUUID()}`;
      const guestOwner = { type: "GUEST" as const, guestTokenHash: hashMarketplaceGuestSecret(guestSecret) };
      let guestCart = await createOrResolveCart(repo, guestOwner, () => repo.create(guestOwner));
      const selGuestA = await resolveMarketplaceCartLine({
        offerReference: offerA.publicReference,
        variantReference: offerA.variant.publicReference,
        modifiers: [],
        quantity: 1,
      });
      guestCart = (await addCartLine(repo, {
        cartId: guestCart.id,
        owner: guestOwner,
        mutation: { operationId: `guest-a:${tag}`, requestHash: `guest-a-h:${tag}`, expectedVersion: guestCart.version },
        selection: selGuestA,
      })).cart;
      const selGuestB = await resolveMarketplaceCartLine({
        offerReference: offerB.publicReference,
        variantReference: offerB.variant.publicReference,
        modifiers: [],
        quantity: 3,
      });
      await addCartLine(repo, {
        cartId: guestCart.id,
        owner: guestOwner,
        mutation: { operationId: `guest-b:${tag}`, requestHash: `guest-b-h:${tag}`, expectedVersion: guestCart.version },
        selection: selGuestB,
      });

      // Non-customer role ignores merge and keeps cookie untouched
      const nonCustomerDeleted: string[] = [];
      await claimGuestCartIfPresentOnCustomerAuth(
        {
          get: (name) => (name === MARKETPLACE_CART_COOKIE ? { value: guestSecret } : undefined),
          delete: (name) => nonCustomerDeleted.push(name),
        },
        { id: owner.id, role: "STORE" },
      );
      expect(nonCustomerDeleted).toHaveLength(0);

      // Customer login / email verification merges guest items cleanly and clears cookie
      const deletedCookies: string[] = [];
      await claimGuestCartIfPresentOnCustomerAuth(
        {
          get: (name) => (name === MARKETPLACE_CART_COOKIE ? { value: guestSecret } : undefined),
          delete: (name) => deletedCookies.push(name),
        },
        { id: customer.id, role: "CUSTOMER" },
      );

      expect(deletedCookies).toEqual([MARKETPLACE_CART_COOKIE]);
      const mergedCustomerCart = await repo.findCartByOwner(customerOwner);
      expect(mergedCustomerCart).not.toBeNull();
      const byOffer = new Map(mergedCustomerCart!.lines.map((l) => [l.selection.offerReference, l.quantity]));
      expect(byOffer.get(offerA.publicReference)).toBe(3); // 2 existing + 1 guest
      expect(byOffer.get(offerB.publicReference)).toBe(3); // added from guest

      const guestCartAfter = await prisma.marketplaceCart.findUniqueOrThrow({ where: { id: guestCart.id } });
      expect(guestCartAfter.status).not.toBe("ACTIVE");
    });
  });

  describe("CR-096..128: Store COD/promo exclusion, sole trader identity, and driver cash cap + engagement", () => {
    it("enforces single-store courier 50/50 COD excluding promos, unregistered sole-trader Pammy Bakes workflow, and driver cash limits", async () => {
      const tag = uniqueTag("pb-rules");
      const owner = await createUser(`${tag}-owner`, UserRole.STORE);
      await prisma.user.update({ where: { id: owner.id }, data: { emailVerifiedAt: new Date() } });
      const reviewer = await createUser(`${tag}-rev`, UserRole.ADMIN);
      const admin2 = await createUser(`${tag}-adm2`, UserRole.ADMIN);
      const region = await createRegion(tag);
      const store = await prisma.store.create({
        data: { name: `Pammy Bakes ${tag}`, slug: `pammy-${tag}`, status: "ACTIVE", ownerUserId: owner.id },
      });

      const extRef = `EXT-SOLE-${tag.replace(/[^A-Za-z0-9]/g, "")}`.slice(0, 48);
      await prisma.systemSetting.create({
        data: {
          key: `store_seller_external_evidence:${store.id}:${extRef}`,
          label: "Sole trader verified evidence",
          type: "JSON",
          value: {
            schemaVersion: 1,
            reference: extRef,
            storeId: store.id,
            status: "REVIEWED",
            authorizedByUserId: reviewer.id,
            documentDigest: createHash("sha256").update(tag).digest("hex"),
          },
        },
      });

      const proposal = await submitStoreSellerIdentity(store.id, owner.id, {
        operationId: `prop-${tag.slice(-16)}`,
        expectedIdentityReference: null,
        identityVersion: "PAMMY_BAKES_V1",
        legalName: "Pamela Abrahams trading as Pammy Bakes",
        tradingName: "Pammy Bakes",
        registrationReference: null,
        vatRegistrationStatus: "NOT_REGISTERED",
        vatNumber: null,
        countryCode: "ZA",
        termsReference: "ZA-SOLE-TRADER-2026",
        invoiceClassification: "RECEIPT",
        effectiveFrom: new Date(Date.now() + 60_000).toISOString(),
        effectiveUntil: null,
        sourceEvidenceReference: extRef,
        confirmSuppliedDetails: true,
      });
      expect(proposal.status).toBe("PENDING_REVIEW");

      // Self-review by owner must be rejected; independent reviewer approves
      await expect(
        reviewStoreSellerIdentity(store.id, owner.id, {
          proposalReference: proposal.reference,
          expectedUpdatedAt: proposal.updatedAt,
          operationId: `self-rev-${tag.slice(-16)}`,
          action: "APPROVE",
          reason: "Attempted self approval",
          evidenceReference: extRef,
          confirmIndependentReview: true,
        }),
      ).rejects.toThrow();

      const approvedSeller = await reviewStoreSellerIdentity(store.id, reviewer.id, {
        proposalReference: proposal.reference,
        expectedUpdatedAt: proposal.updatedAt,
        operationId: `ind-rev-${tag.slice(-16)}`,
        action: "APPROVE",
        reason: "Unregistered sole trader receipt classification verified",
        evidenceReference: extRef,
        confirmIndependentReview: true,
      });
      expect(approvedSeller.status).toBe("APPROVED");

      // Approved store DEPOSIT_PLUS_COD policy works for 1 store + courier + 0 promo, blocked otherwise
      await prisma.paymentMethodPolicy.create({
        data: {
          versionNumber: 1,
          storeId: store.id,
          orderType: "STORE_MARKETPLACE",
          mode: "DEPOSIT_PLUS_COD",
          depositPercent: "0.5000",
          maximumCodAmount: "2000.00",
          status: "ACTIVE",
          effectiveFrom: new Date(Date.now() - 60_000),
          createdByUserId: reviewer.id,
          policyEvidence: {
            approvedByUserId: admin2.id,
            approvedAt: new Date().toISOString(),
            remittanceApproved: true,
            settlementTiming: "DAILY_BANK_DEPOSIT",
          },
        },
      });

      const safeLocalities = {
        originLocality: { suburb: "Sandton", city: "Johannesburg", province: "Gauteng" },
        destinationLocality: { suburb: "Menlyn", city: "Pretoria", province: "Gauteng" },
      };
      const validCodPlan = await resolveMarketplacePaymentPlan(
        {
          storeId: store.id,
          orderType: "STORE_MARKETPLACE",
          ...safeLocalities,
          total: "200.00",
          fulfilmentMode: "COURIER_DELIVERY",
          groupCount: 1,
          promotionDiscount: "0.00",
        },
        prisma,
      );
      expect(validCodPlan.mode).toBe("DEPOSIT_PLUS_COD");
      expect(validCodPlan.digitalRequired).toBe("100.00");
      expect(validCodPlan.cashRequired).toBe("100.00");

      await expect(
        resolveMarketplacePaymentPlan(
          {
            storeId: store.id,
            orderType: "STORE_MARKETPLACE",
            originLocality: safeLocalities.originLocality,
            destinationLocality: { suburb: "Hillbrow", city: "Johannesburg", province: "Gauteng" },
            total: "200.00",
            fulfilmentMode: "COURIER_DELIVERY",
            groupCount: 1,
            promotionDiscount: "0.00",
          },
          prisma,
        ),
      ).rejects.toMatchObject({ code: "HIGH_RISK_CASH_RESTRICTED" });

      await expect(
        resolveMarketplacePaymentPlan(
          {
            storeId: store.id,
            orderType: "STORE_MARKETPLACE",
            ...safeLocalities,
            total: "200.00",
            fulfilmentMode: "COURIER_DELIVERY",
            groupCount: 1,
            promotionDiscount: "10.00",
          },
          prisma,
        ),
      ).rejects.toMatchObject({ code: "CHECKOUT_REVIEW_REQUIRED" });

      await expect(
        resolveMarketplacePaymentPlan(
          {
            storeId: store.id,
            orderType: "STORE_MARKETPLACE",
            ...safeLocalities,
            total: "200.00",
            fulfilmentMode: "COURIER_DELIVERY",
            groupCount: 2,
            promotionDiscount: "0.00",
          },
          prisma,
        ),
      ).rejects.toMatchObject({ code: "CHECKOUT_REVIEW_REQUIRED" });

      // Driver engagement + optimistic revision lock + cash limit enforcement
      const driver = await createDriver(`${tag}-drv`, region.id, 3);
      const initialProfile = await prisma.driverProfile.findUniqueOrThrow({ where: { id: driver.profile.id } });
      expect(initialProfile.cashLimitAmount.toFixed(2)).toBe("1000.00");

      const eng1 = await setDriverEngagement(driver.profile.id, reviewer.id, {
        engagementType: "SALARIED",
        contractReference: `EMP-CONTRACT-${tag.slice(-12)}`,
        effectiveFrom: "2026-11-15",
        expectedRevision: initialProfile.engagementRevision,
        reason: "Salaried courier driver employment agreement uploaded and reviewed",
      });
      expect(eng1?.type).toBe("SALARIED");
      expect(eng1?.revision).toBe(initialProfile.engagementRevision + 1);

      await expect(
        setDriverEngagement(driver.profile.id, reviewer.id, {
          engagementType: "FREELANCE",
          contractReference: `STALE-REF-${tag.slice(-12)}`,
          effectiveFrom: "2026-11-15",
          expectedRevision: initialProfile.engagementRevision,
          reason: "Stale form submission that must fail optimistic lock check",
        }),
      ).rejects.toBeInstanceOf(DriverEngagementConflict);

      const updatedLimit = await updateDriverCashLimit(driver.profile.id, reviewer.id, "500.00", initialProfile.cashLimitRevision);
      expect(updatedLimit?.amount).toBe("500.00");

      const customer = await createUser(`${tag}-cust`, UserRole.CUSTOMER);
      const { order: order1 } = await createCustomerParcelOrder(customer.id, "350.00");
      const { order: order2 } = await createCustomerParcelOrder(customer.id, "200.00");
      await prisma.order.updateMany({
        where: { id: { in: [order1.id, order2.id] } },
        data: { status: OrderStatus.CONFIRMED, deliveryRegionId: region.id },
      });

      await prisma.cashOnDelivery.createMany({
        data: [
          {
            publicReference: `COD-${tag}-1`,
            orderId: order1.id,
            policyMode: "FULL_COD",
            authoritativePayable: "350.00",
            cashObligation: "350.00",
            cashCollected: "0.00",
            status: "PENDING",
          },
          {
            publicReference: `COD-${tag}-2`,
            orderId: order2.id,
            policyMode: "FULL_COD",
            authoritativePayable: "200.00",
            cashObligation: "200.00",
            cashCollected: "0.00",
            status: "PENDING",
          },
        ],
      });
      await offerAssignment(reviewer.id, order1.id, { driverProfileId: driver.profile.id, reasonCode: "INITIAL" });

      // 350.00 reserved + 200.00 requested > 500.00 driver limit -> DriverCashLimitError
      await expect(
        offerAssignment(reviewer.id, order2.id, { driverProfileId: driver.profile.id, reasonCode: "INITIAL" }),
      ).rejects.toThrow(/cash-in-hand limit|DRIVER_CASH_LIMIT/i);
      await expect(
        prisma.$transaction(async (tx) => {
          await assertDriverCashCapacityForAssignment(tx, driver.profile.id, order2.id);
        }),
      ).rejects.toBeInstanceOf(DriverCashLimitError);
    });
  });
});
