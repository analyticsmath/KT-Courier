import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { expect, test } from "@playwright/test";
import { prisma } from "@/lib/db/prisma";
import { createOrResolveCart, addCartLine } from "@/lib/marketplace-checkout/cart-mutation.service";
import { createPrismaMarketplaceCartRepository } from "@/lib/marketplace-checkout/prisma-cart-repository";
import { DeliveryType, OrderSource, OrderStatus, UserRole } from "@/types/db";
import { login, logout } from "./fixtures/auth";

const E2E_PASSWORD = "ChangeMe123!";
const createdUserIds: string[] = [];
const createdStoreIds: string[] = [];
const createdOrderIds: string[] = [];
const createdQuoteIds: string[] = [];

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("Phase B Browser Closure — F05 EFT honesty, CR-062 guest cart auto-merge, CR-063 navbar auth role", () => {
  test("F05: /orders/[ref]/payment shows Card enabled, Instant EFT disabled honestly, and blocks forged EFT checkout session", async ({ page }) => {
    const suffix = randomUUID().slice(0, 8);
    const passwordHash = await bcrypt.hash(E2E_PASSWORD, 4);
    const customer = await prisma.user.create({
      data: {
        email: `pb-e2e-cust-${suffix}@example.test`,
        name: `Phase B Customer ${suffix}`,
        role: UserRole.CUSTOMER,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        passwordHash,
      },
    });
    createdUserIds.push(customer.id);
    await prisma.customerProfile.create({ data: { userId: customer.id, displayName: customer.name } });

    const quote = await prisma.pricingQuote.create({
      data: {
        status: "USED",
        ownerType: "CUSTOMER",
        ownerId: customer.id,
        deliveryType: DeliveryType.SAME_DAY,
        currency: "ZAR",
        calculationVersion: "phase-b-e2e",
        inputHash: randomUUID().replaceAll("-", "") + "0".repeat(32),
        distanceMeters: 4500,
        rawDistanceKm: "4.5000",
        billableDistanceKm: "4.5000",
        subtotal: "129.00",
        taxRate: "0.0000",
        taxAmount: "0.00",
        total: "129.00",
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
        orderNumber: `KT-PB-E2E-${suffix.toUpperCase()}`,
        source: OrderSource.CUSTOMER,
        status: OrderStatus.PENDING,
        deliveryType: DeliveryType.SAME_DAY,
        currency: "ZAR",
        customerId: customer.id,
        priceEstimate: "129.00",
        pricingQuoteId: quote.id,
        pricingSubtotal: "129.00",
        pricingTaxAmount: "0.00",
        pricingTaxRate: "0.0000",
        pricingSnapshot: { quoteId: quote.id, calculationVersion: "phase-b-e2e" },
      },
    });
    createdOrderIds.push(order.id);

    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, customer.email);
    await page.goto(`/orders/${encodeURIComponent(order.orderNumber)}/payment`);

    await expect(page.getByRole("heading", { name: `Pay for ${order.orderNumber}` })).toBeVisible();
    const cardRadio = page.locator('input[name="paystack-channel"][value="CARD"]');
    const eftRadio = page.locator('input[name="paystack-channel"][value="EFT"]');
    await expect(cardRadio).toBeVisible();
    await expect(cardRadio).toBeEnabled();
    await expect(cardRadio).toBeChecked();

    await expect(eftRadio).toBeVisible();
    await expect(eftRadio).toBeDisabled();
    await expect(page.getByText(/Instant EFT via Paystack \(Unavailable until Paystack EFT channel is approved\)/)).toBeVisible();

    // Prepare payment and prove server rejects forced EFT channel request with HTTP 503 EFT_UNAVAILABLE
    const prepResult = await page.evaluate(async (ordId) => {
      const prepRes = await fetch(`/api/orders/${encodeURIComponent(ordId)}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationId: crypto.randomUUID() }),
      });
      const prepData = await prepRes.json();
      if (!prepRes.ok) return { prepStatus: prepRes.status, prepData };
      const sessRes = await fetch(`/api/payments/${encodeURIComponent(prepData.payment.publicReference)}/checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationId: crypto.randomUUID(), channel: "EFT" }),
      });
      const sessData = await sessRes.json();
      return { prepStatus: prepRes.status, sessStatus: sessRes.status, sessData };
    }, order.id);

    expect(prepResult.prepStatus).toBe(200);
    expect(prepResult.sessStatus).toBe(503);
    expect(prepResult.sessData).toMatchObject({ code: "EFT_UNAVAILABLE" });

    // Mobile 390px sanity check
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(eftRadio).toBeDisabled();
    await expect(cardRadio).toBeChecked();
  });

  test("CR-062 + CR-063: Signing in merges guest cart into existing customer cart without data loss and updates PublicHeaderV3 across 1440px & 390px", async ({ page }) => {
    const suffix = randomUUID().slice(0, 8);
    const passwordHash = await bcrypt.hash(E2E_PASSWORD, 4);

    const [approver, storeOwner, customer] = await Promise.all([
      prisma.user.create({
        data: {
          email: `pb-e2e-adm-${suffix}@example.test`,
          name: `Admin ${suffix}`,
          role: UserRole.ADMIN,
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
          passwordHash,
        },
      }),
      prisma.user.create({
        data: {
          email: `pb-e2e-store-${suffix}@example.test`,
          name: `Store Owner ${suffix}`,
          role: UserRole.STORE,
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
          passwordHash,
        },
      }),
      prisma.user.create({
        data: {
          email: `pb-e2e-buyer-${suffix}@example.test`,
          name: `Buyer ${suffix}`,
          role: UserRole.CUSTOMER,
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
          passwordHash,
        },
      }),
    ]);
    createdUserIds.push(approver.id, storeOwner.id, customer.id);
    await prisma.customerProfile.create({ data: { userId: customer.id, displayName: customer.name } });

    const store = await prisma.store.create({
      data: {
        name: `Phase B Shop ${suffix}`,
        slug: `pb-shop-${suffix}`,
        status: "ACTIVE",
        ownerUserId: storeOwner.id,
      },
    });
    createdStoreIds.push(store.id);
    const location = await prisma.inventoryLocation.create({
      data: { publicReference: `loc-pb-${suffix}`, storeId: store.id, name: "Main", status: "ACTIVE", isPrimary: true },
    });
    const productType = await prisma.productTypeDefinition.create({
      data: {
        publicReference: `pt-pb-${suffix}`,
        code: `PT_PB_${suffix.toUpperCase()}`,
        name: "Goods",
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
        publicReference: `cat-pb-${suffix}`,
        name: "Artisan",
        slug: `cat-pb-${suffix}`,
        path: `/cat-pb-${suffix}`,
        status: "ACTIVE",
        createdByUserId: approver.id,
        updatedByUserId: approver.id,
      },
    });

    async function seedOffer(label: string, priceAmount: string) {
      const prod = await prisma.catalogProduct.create({
        data: {
          publicReference: `prod-pb-${label}-${suffix}`,
          scope: "STORE_PRIVATE",
          sourceStoreId: store.id,
          productTypeDefinitionId: productType.id,
          productTypeVersionNumber: 1,
          primaryCategoryId: category.id,
          title: `PhaseB ${label} Item ${suffix}`,
          normalizedTitle: `phaseb ${label} item ${suffix}`,
          attributeValues: {},
          complianceValues: {},
          status: "DRAFT",
          moderationStatus: "NOT_SUBMITTED",
          publicationStatus: "DRAFT",
          slug: `pb-${label}-${suffix}`,
          qualityIssues: [],
          createdByUserId: approver.id,
        },
      });
      const variant = await prisma.catalogProductVariant.create({
        data: {
          publicReference: `var-pb-${label}-${suffix}`,
          productId: prod.id,
          title: "Standard",
          normalizedTitle: "standard",
          optionFingerprint: `std-${label}-${suffix}`,
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
          publicReference: `off-pb-${label}-${suffix}`,
          storeId: store.id,
          productId: prod.id,
          variantId: variant.id,
          storeSku: `SKU-PB-${label}-${suffix}`,
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
          publicReference: `prc-pb-${label}-${suffix}`,
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
      const updatedOffer = await prisma.storeCatalogOffer.update({
        where: { id: offer.id },
        data: {
          currentPriceVersionId: price.id,
          status: "ACTIVE",
          publicationStatus: "PUBLISHED",
          approvedByUserId: approver.id,
        },
        include: { product: true, variant: true },
      });
      return { ...updatedOffer, pricePublicReference: price.publicReference };
    }

    const [custOffer, guestOffer] = await Promise.all([
      seedOffer("cust", "50.00"),
      seedOffer("guest", "75.00"),
    ]);

    // Pre-populate CUSTOMER existing cart item via canonical mutation service
    const repo = createPrismaMarketplaceCartRepository();
    const customerOwner = { type: "CUSTOMER" as const, userId: customer.id };
    const existingCart = await createOrResolveCart(repo, customerOwner, () => repo.create(customerOwner));
    await addCartLine(repo, {
      cartId: existingCart.id,
      owner: customerOwner,
      mutation: { operationId: `e2e-cust-${suffix}`, requestHash: `e2e-cust-h-${suffix}`, expectedVersion: existingCart.version },
      selection: {
        offerReference: custOffer.publicReference,
        variantReference: custOffer.variant.publicReference,
        productReference: custOffer.product.publicReference,
        storeId: store.id,
        fulfilmentMode: "COURIER_DELIVERY",
        sellingUnit: "EACH",
        publicationVersion: String(custOffer.version),
        priceVersion: custOffer.pricePublicReference,
        unitPrice: "50.00",
        quantity: 2,
        modifiers: [],
      },
    });

    // Anonymous guest visits / -> sees Join & Sign in (desktop 1440px)
    await logout(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/shop");
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "Join" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Sign in" })).toBeVisible();

    // Add guest item via real /api/cart/lines in browser context (sets kt_marketplace_cart HttpOnly cookie)
    const guestAdd = await page.evaluate(async ({ offerRef, variantRef }) => {
      const cartRes = await fetch("/api/cart");
      const cartJson = await cartRes.json();
      const cartVersion = cartJson.cart?.version ?? 0;
      const opId = `e2e-guest-${Date.now()}`;
      const res = await fetch("/api/cart/lines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerReference: offerRef,
          variantReference: variantRef,
          quantity: 1,
          modifiers: [],
          operationId: opId,
          requestHash: `${opId}-hash`,
          cartVersion,
        }),
      });
      return { status: res.status };
    }, { offerRef: guestOffer.publicReference, variantRef: guestOffer.variant.publicReference });
    expect(guestAdd.status).toBe(201);

    await page.goto("/cart");
    await expect(page.getByText(guestOffer.product.title)).toBeVisible();
    await expect(page.getByText(custOffer.product.title)).toBeHidden();

    // Customer signs in via UI form at /login?returnUrl=/cart -> redirects to /cart with BOTH items merged!
    await page.goto("/login?returnUrl=/cart");
    await page.getByRole("textbox", { name: /Email address/i }).fill(customer.email);
    await page.getByRole("textbox", { name: /^Password/i }).fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await page.waitForURL("**/cart");
    await expect(page.getByText(custOffer.product.title)).toBeVisible();
    await expect(page.getByText(guestOffer.product.title)).toBeVisible();

    // Header shows role-appropriate "My account" (NOT Join / Sign in) at 1440px desktop
    await expect(header.getByRole("link", { name: "My account" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Join" })).toBeHidden();
    await expect(header.getByRole("link", { name: "Sign in" })).toBeHidden();

    // Check 390px mobile drawer shows "My account" inside Explore KT Couriers dialog
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: /^Menu/ }).click();
    await expect(
      page.getByRole("dialog", { name: "Explore KT Couriers" }).getByRole("link", { name: /My account/ }),
    ).toBeVisible();

    // Store owner session updates public navbar CTA to "Store workspace"
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, storeOwner.email);
    await page.goto("/shop");
    await expect(page.locator("header").getByRole("link", { name: "Store workspace" })).toBeVisible();
  });
});
