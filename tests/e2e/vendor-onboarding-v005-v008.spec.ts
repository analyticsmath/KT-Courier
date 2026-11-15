import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { expect, test } from "@playwright/test";
import { prisma } from "@/lib/db/prisma";
import { catalogPublicReference } from "@/lib/catalog/catalog-normalization";
import { openSecurityPayload } from "@/lib/notifications/security-payload-vault";
import { getStoreOnboardingByStoreId } from "@/lib/services/store-onboarding.service";
import { moderateCatalogOffer, moderateCatalogProduct } from "@/lib/services/catalog-moderation.service";
import { publishApprovedCatalogListing } from "@/lib/services/catalog-listing-publication.service";
import { PACKAGING_PREFIX } from "@/lib/services/catalog-packaging.service";
import {
  approveStoreCheckoutCertification,
  prepareStoreCheckoutCertificationFromPreflight,
} from "@/lib/admin/store-checkout-certification.service";
import {
  actOnTrustedPackageVersion,
  listTrustedPackageVersions,
  saveTrustedPackageVersion,
} from "@/lib/marketplace-checkout/parcel-configuration.service";
import { createDisposableNewVendorCommission } from "@/scripts/e2e-checkout-authorities";
import { filterValidTrustedPackages } from "@/scripts/phase3-parcel-control";
import { login, logout } from "./fixtures/auth";

const createdSettingKeys: string[] = [];
const createdUserIds: string[] = [];
const createdStoreIds: string[] = [];
const createdProductIds: string[] = [];
const createdMediaIds: string[] = [];
const createdLocationIds: string[] = [];
const createdProductTypeIds: string[] = [];
const createdCategoryIds: string[] = [];

test.afterAll(async () => {
  if (createdSettingKeys.length) {
    await prisma.systemSetting.deleteMany({ where: { key: { in: createdSettingKeys } } }).catch(() => {});
  }
  for (const storeId of createdStoreIds) {
    await prisma.storefrontProductDocument.deleteMany({ where: { storeId } }).catch(() => {});
    await prisma.storefrontStoreDocument.deleteMany({ where: { storeId } }).catch(() => {});
  }
  for (const productId of createdProductIds) {
    await prisma.storefrontProductDocument.deleteMany({ where: { productId } }).catch(() => {});
    await prisma.catalogModerationHistory.deleteMany({ where: { moderationCase: { productId } } }).catch(() => {});
    await prisma.catalogModerationCase.deleteMany({ where: { productId } }).catch(() => {});
    const offers = await prisma.storeCatalogOffer.findMany({ where: { productId }, select: { id: true } }).catch(() => []);
    const offerIds = offers.map((o) => o.id);
    if (offerIds.length) {
      await prisma.catalogModerationHistory.deleteMany({ where: { moderationCase: { offerId: { in: offerIds } } } }).catch(() => {});
      await prisma.catalogModerationCase.deleteMany({ where: { offerId: { in: offerIds } } }).catch(() => {});
      await prisma.catalogInventoryMovement.deleteMany({ where: { inventoryItem: { offerId: { in: offerIds } } } }).catch(() => {});
      await prisma.catalogInventoryLevel.deleteMany({ where: { inventoryItem: { offerId: { in: offerIds } } } }).catch(() => {});
      await prisma.catalogInventoryItem.deleteMany({ where: { offerId: { in: offerIds } } }).catch(() => {});
      await prisma.storeCatalogOffer.updateMany({ where: { id: { in: offerIds } }, data: { currentPriceVersionId: null, primaryInventoryLocationId: null } }).catch(() => {});
      await prisma.catalogPublicationSnapshot.deleteMany({ where: { offerId: { in: offerIds } } }).catch(() => {});
      await prisma.storeOfferPriceVersion.deleteMany({ where: { offerId: { in: offerIds } } }).catch(() => {});
      await prisma.storeCatalogOffer.deleteMany({ where: { id: { in: offerIds } } }).catch(() => {});
    }
    await prisma.catalogPublicationSnapshot.deleteMany({ where: { productId } }).catch(() => {});
    await prisma.catalogProductMedia.deleteMany({ where: { productId } }).catch(() => {});
    await prisma.catalogVariantOptionValue.deleteMany({ where: { variant: { productId } } }).catch(() => {});
    await prisma.catalogProductVariant.deleteMany({ where: { productId } }).catch(() => {});
    await prisma.catalogProduct.delete({ where: { id: productId } }).catch(() => {});
  }
  for (const mediaId of createdMediaIds) {
    await prisma.catalogMediaUploadIntent.deleteMany({ where: { assetId: mediaId } }).catch(() => {});
    await prisma.catalogMediaAsset.delete({ where: { id: mediaId } }).catch(() => {});
  }
  for (const locId of createdLocationIds) {
    await prisma.inventoryLocation.delete({ where: { id: locId } }).catch(() => {});
  }
  for (const typeId of createdProductTypeIds) {
    await prisma.productTypeDefinition.delete({ where: { id: typeId } }).catch(() => {});
  }
  for (const catId of createdCategoryIds) {
    await prisma.storefrontCategoryDocument.deleteMany({ where: { categoryId: catId } }).catch(() => {});
    await prisma.catalogCategoryProductType.deleteMany({ where: { categoryId: catId } }).catch(() => {});
    await prisma.catalogCategory.delete({ where: { id: catId } }).catch(() => {});
  }
  for (const storeId of createdStoreIds) {
    const plans = await prisma.commissionPlan.findMany({ where: { scopeKey: `STORE:${storeId}` }, select: { id: true } });
    for (const plan of plans) {
      await prisma.commissionPlanStatusHistory.deleteMany({ where: { planId: plan.id } }).catch(() => {});
      await prisma.commissionRule.deleteMany({ where: { planId: plan.id } }).catch(() => {});
      await prisma.commissionPlan.delete({ where: { id: plan.id } }).catch(() => {});
    }
    await prisma.storeSellerLegalIdentity.deleteMany({ where: { storeId } }).catch(() => {});
    await prisma.storeCheckoutCertification.deleteMany({ where: { storeId } }).catch(() => {});
    await prisma.store.delete({ where: { id: storeId } }).catch(() => {});
  }
  for (const userId of createdUserIds) {
    await prisma.catalogOperationReceipt.deleteMany({ where: { actorUserId: userId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  }
});

test.describe("Vendor onboarding cockpit, VAT display, validation UX & incremental live catalog (V-005..V-008)", () => {
  test("V-005 & V-008: decoupled onboarding cockpit, pending prep, real-source certification, and adding a 2nd live product without delisting", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    const tag = randomUUID().slice(0, 8);
    const origin = process.env.E2E_BASE_URL!;
    const headers = { origin };
    const email = `e2e-vendor-five-${tag}@ktcouriers.local`;
    const emptyEmail = `e2e-v005-approved-${tag}@ktcouriers.local`;
    const storeName = `V005 Studio ${tag}`;
    const field = (name: string) => page.getByLabel(new RegExp(`^${name}(?:\\s*\\*)?$`));

    const admin1 = await prisma.user.findUniqueOrThrow({ where: { email: "superadmin@ktcouriers.local" } });
    const admin2 = await prisma.user.findUniqueOrThrow({ where: { email: "disposable-checkout-reviewer@example.test" } });

    // Create a clean category & structured product type for UI wizard tests
    const cat = await prisma.catalogCategory.create({
      data: {
        publicReference: catalogPublicReference("CC"),
        name: `V005 Goods ${tag}`,
        slug: `v005-goods-${tag}`,
        path: `/v005-goods-${tag}`,
        depth: 0,
        status: "ACTIVE",
        createdByUserId: admin1.id,
        updatedByUserId: admin1.id,
      },
    });
    createdCategoryIds.push(cat.id);
    const pType = await prisma.productTypeDefinition.create({
      data: {
        publicReference: catalogPublicReference("PT"),
        code: `V005_ARTISAN_${tag.toUpperCase()}`,
        name: `V005 Artisan ${tag}`,
        versionNumber: 1,
        status: "ACTIVE",
        attributeSchema: {
          attributes: [{ code: "maker_city", label: "Maker city", type: "TEXT", required: true }],
        },
        variantSchema: {},
        complianceSchema: {
          requirements: [{ code: "origin_note", label: "Origin note", required: true }],
        },
        searchFacetSchema: {},
        createdByUserId: admin1.id,
      },
    });
    createdProductTypeIds.push(pType.id);
    await prisma.catalogCategoryProductType.create({
      data: { categoryId: cat.id, productTypeDefinitionId: pType.id, isPrimary: true },
    });

    // Sign up fresh vendor via UI & verify OTP
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/signup?role=store");
    await field("Business or store name").fill(storeName);
    await field("Contact person").fill("V005 Sole Trader");
    await field("Email address").fill(email);
    await field("Phone number").fill("0825551100");
    await field("Password").fill("ChangeMe123!");
    await field("Confirm password").fill("ChangeMe123!");
    const signupWait = page.waitForResponse((r) => r.url().endsWith("/api/auth/signup"));
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    expect([201, 202]).toContain((await signupWait).status());

    const owner = await prisma.user.findUniqueOrThrow({ where: { email } });
    createdUserIds.push(owner.id);
    const store = await prisma.store.findFirstOrThrow({ where: { ownerUserId: owner.id } });
    createdStoreIds.push(store.id);

    const otp = await prisma.otpCode.findFirstOrThrow({
      where: { userId: owner.id, consumedAt: null, purpose: "EMAIL_VERIFICATION" },
      orderBy: { createdAt: "desc" },
    });
    const intent = await prisma.notificationEventIntent.findUniqueOrThrow({
      where: { operationId: `email-verification:${otp.id}` },
    });
    const envelope = await prisma.notificationSecurePayload.findUniqueOrThrow({
      where: { eventIntentId: intent.id },
    });
    const otpCode = String(openSecurityPayload(envelope.encryptedPayload, intent.operationId).otp);
    await field("Verification code").fill(otpCode);
    const verifyWait = page.waitForResponse((r) => r.url().endsWith("/api/auth/verify-otp"));
    await page.getByRole("button", { name: "Verify code", exact: true }).click();
    expect((await verifyWait).status()).toBe(200);

    // Log in as PENDING vendor & inspect /store banner + /store/get-started cockpit at 1440px and 390px
    await login(page, email);
    await page.goto("/store");
    const banner = page.getByTestId("store-onboarding-banner");
    await expect(banner).toHaveAttribute("data-shop-state", "ACCOUNT_APPLICATION");
    await expect(banner).toContainText("Account application");

    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/store/get-started");
      await expect(page.getByText("Current shop lifecycle state", { exact: true })).toBeVisible();
      await expect(page.getByRole("list", { name: "Shop lifecycle stages", exact: true }).getByRole("listitem")).toHaveCount(5);
      await expect(page.getByText("Four-stage launch checklist", { exact: true })).toBeVisible();
      await expect(page.getByText("Your remaining owner actions", { exact: true })).toBeVisible();
      await expect(page.getByText("KT Couriers independent approvals", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }

    // Verify ACCOUNT_APPROVED projection explicitly when an approved store has not started owner setup
    const emptyUser = await prisma.user.create({
      data: {
        email: emptyEmail,
        name: "V005 Approved Owner",
        role: "STORE",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        passwordHash: await bcrypt.hash("ChangeMe123!", 10),
      },
    });
    createdUserIds.push(emptyUser.id);
    const emptyStore = await prisma.store.create({
      data: {
        ownerUserId: emptyUser.id,
        name: `V005 Approved Empty ${tag}`,
        slug: `v005-approved-empty-${tag}`,
        status: "ACTIVE",
        contactEmail: emptyEmail,
      },
    });
    createdStoreIds.push(emptyStore.id);
    const emptyOnboarding = await getStoreOnboardingByStoreId(emptyStore.id);
    expect(emptyOnboarding?.shopState).toBe("ACCOUNT_APPROVED");
    await login(page, emptyEmail);
    await page.goto("/store");
    await expect(page.getByTestId("store-onboarding-banner")).toHaveAttribute("data-shop-state", "ACCOUNT_APPROVED");
    await expect(page.getByTestId("store-onboarding-banner")).toContainText("Account approved");

    // Back to PENDING primary store: prepare stockroom, legal seller identity, pickup address, and Product #1
    await login(page, email);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/store/catalog/inventory");
    await page.getByLabel("Stock location name", { exact: true }).fill("Workshop stockroom");
    const locResWait = page.waitForResponse((r) => r.url().endsWith("/api/store/catalog/inventory/locations") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Save stock location", exact: true }).click();
    expect((await locResWait).status()).toBe(201);
    const createdLocation = await prisma.inventoryLocation.findFirstOrThrow({ where: { storeId: store.id } });
    createdLocationIds.push(createdLocation.id);

    // Unregistered sole trader identity upload & submit while PENDING
    await page.goto("/store/profile");
    const sellerForm = page.getByRole("form", { name: "Seller legal identity submission", exact: true });
    const docPng = await sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 20, g: 80, b: 140 } } }).png().toBuffer();
    await sellerForm.getByLabel("Verification file", { exact: true }).setInputFiles({
      name: `v005-id-${tag}.png`,
      mimeType: "image/png",
      buffer: docPng,
    });
    const docUploadWait = page.waitForResponse((r) => r.url().endsWith("/api/store/seller-identity/documents") && r.request().method() === "POST");
    await sellerForm.getByRole("button", { name: "Upload supporting document", exact: true }).click();
    const docUploadRes = await docUploadWait;
    expect(docUploadRes.status()).toBe(201);
    const uploadedDocRef = String((await docUploadRes.json()).document?.publicReference ?? "");
    expect(uploadedDocRef).toMatch(/^PMO-/i);

    await sellerForm.locator('input[name="identityVersion"]').fill(`v005-sole-${tag}`);
    await sellerForm.getByLabel("Legal seller name", { exact: true }).fill(`V005 Owner ${tag}`);
    await sellerForm.getByRole("combobox", { name: "VAT registration status", exact: true }).selectOption("NOT_REGISTERED");
    await sellerForm.getByRole("combobox", { name: "Receipt classification", exact: true }).selectOption("RECEIPT");
    await sellerForm.getByLabel("Effective from (UTC)", { exact: true }).fill(new Date().toISOString().slice(0, 16));
    await sellerForm.getByLabel("I confirm these are the supplied seller details and evidence for review.", { exact: true }).check();
    const idSubmitWait = page.waitForResponse((r) => r.url().endsWith("/api/store/seller-identity") && r.request().method() === "POST");
    await sellerForm.getByRole("button", { name: "Submit seller identity", exact: true }).click();
    expect((await idSubmitWait).status()).toBe(201);

    const pickupRes = await page.request.patch("/api/store/pickup-address", {
      headers,
      data: {
        label: "V005 Pickup",
        contactName: "V005 Owner",
        contactPhone: "0825551100",
        line1: "10 E2E Pickup Road",
        line2: "Central",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "2001",
        country: "South Africa",
        latitude: -26.2041,
        longitude: 28.0473,
      },
    });
    expect(pickupRes.status()).toBe(200);

    // Pending vendor creates Product #1 via UI wizard using structured attributes, compliance, modifier builder & Selling price (ZAR)
    async function createProductThroughWizard(title: string, sku: string, price: string) {
      await page.goto("/store/catalog/products/new");
      const steps = page.getByRole("list", { name: "Product listing steps", exact: true });
      const goStep = async (name: string) => steps.getByRole("button", { name: new RegExp(name) }).click();
      await page.getByLabel("Category", { exact: true }).selectOption({ label: cat.name });
      await page.getByLabel("Product title", { exact: true }).fill(title);
      await page.getByLabel("Description", { exact: true }).fill("Synthetic artisanal product created through the onboarding wizard for verification.");
      await page.getByLabel("Maker city (required)", { exact: true }).fill("Johannesburg");

      await goStep("Photos & options");
      const img = await sharp({ create: { width: 400, height: 400, channels: 3, background: { r: 90, g: 130, b: 170 } } }).png().toBuffer();
      const upWait = page.waitForResponse((r) => r.url().endsWith("/api/store/catalog/media/normalized") && r.request().method() === "POST");
      await page.getByLabel("Upload product image", { exact: true }).setInputFiles({ name: `${sku}.png`, mimeType: "image/png", buffer: img });
      expect((await upWait).status()).toBe(201);
      await page.getByLabel("Alt text", { exact: true }).fill(`${title} main photo`);
      await page.getByLabel("Origin note (required)", { exact: true }).fill("Handcrafted in Gauteng");
      await page.getByRole("button", { name: "Add modifier group", exact: true }).click();
      await page.locator("#mod-group-0-name").fill("Gift wrap");
      await page.locator("#mod-0-opt-0-name").fill("Kraft paper");
      await page.locator("#mod-0-opt-0-price").fill("12.00");

      await goStep("Offer & stock");
      await page.getByLabel("Packaged length (cm)", { exact: true }).fill("20");
      await page.getByLabel("Packaged width (cm)", { exact: true }).fill("15");
      await page.getByLabel("Packaged height (cm)", { exact: true }).fill("5");
      await page.getByLabel("Packaged weight (kg)", { exact: true }).fill("0.4");
      await page.getByLabel("How is this product packed?", { exact: true }).fill("Protected boxed parcel");
      await page.getByLabel("Store SKU", { exact: true }).fill(sku);
      await page.getByLabel("Selling price (ZAR)", { exact: true }).fill(price);
      await page.getByLabel("Opening stock", { exact: true }).fill("5");
      await page.getByLabel("Inventory location", { exact: true }).selectOption({ label: "Workshop stockroom" });

      await goStep("Review & save");
      const saveWait = page.waitForResponse((r) => r.url().endsWith("/api/store/catalog/listing-drafts") && r.request().method() === "POST");
      await page.getByRole("button", { name: "Save product draft", exact: true }).click();
      const saveRes = await saveWait;
      expect(saveRes.status(), await saveRes.text()).toBe(201);
      const savedDraft = (await saveRes.json()).product as { publicReference: string };
      const prod = await prisma.catalogProduct.findUniqueOrThrow({
        where: { publicReference: savedDraft.publicReference },
        include: { offers: { include: { variant: true, priceVersions: true } }, media: true },
      });
      createdProductIds.push(prod.id);
      for (const m of prod.media) createdMediaIds.push(m.assetId);
      createdSettingKeys.push(`${PACKAGING_PREFIX}${prod.offers[0]!.publicReference}`);

      await page.getByRole("link", { name: "View saved product", exact: true }).click();
      const subProdWait = page.waitForResponse((r) => r.url().endsWith(`/api/store/catalog/products/${prod.publicReference}/submit`));
      await page.getByRole("button", { name: "Submit product for review", exact: true }).click();
      expect((await subProdWait).status()).toBe(200);

      await page.goto(`/store/catalog/offers/${prod.offers[0]!.publicReference}`);
      const subOffWait = page.waitForResponse((r) => r.url().endsWith(`/api/store/catalog/offers/${prod.offers[0]!.publicReference}/submit`));
      await page.getByRole("button", { name: "Submit offer for review", exact: true }).click();
      expect((await subOffWait).status()).toBe(200);
      return prod;
    }

    const product1 = await createProductThroughWizard(`V005 Ceramic Mug ${tag}`, `V005-MUG-${tag}`, "89.00");
    expect((await getStoreOnboardingByStoreId(store.id))?.shopState).toBe("ACCOUNT_APPLICATION");
    expect((await getStoreOnboardingByStoreId(store.id))?.metrics.draftOrActiveProducts).toBe(1);

    // Admin approves business account -> state advances to GETTING_SHOP_READY (because owner prep already started)
    await login(page, "superadmin@ktcouriers.local");
    const activateRes = await page.request.patch(`/api/admin/stores/${store.id}/status`, {
      headers,
      data: { status: "ACTIVE" },
    });
    expect(activateRes.status(), await activateRes.text()).toBe(200);
    await login(page, email);
    await page.goto("/store");
    await expect(page.getByTestId("store-onboarding-banner")).toHaveAttribute("data-shop-state", "GETTING_SHOP_READY");
    await expect(page.getByTestId("store-onboarding-banner")).toContainText("Getting shop ready");

    // Admin approves seller identity, seeds commission plan, approves & publishes Product #1
    await login(page, "superadmin@ktcouriers.local");
    await page.goto(`/admin/stores/${store.id}/seller-identity`);
    const reviewRegion = page.getByRole("region", { name: "Independent seller identity review", exact: true });
    await reviewRegion.getByLabel("Seller review reason", { exact: true }).fill("V005 unregistered sole trader review");
    await reviewRegion.getByLabel("Reviewed evidence reference", { exact: true }).fill(`REVIEWED_${uploadedDocRef}`);
    await reviewRegion.getByLabel("I have independently reviewed the supplied seller details and evidence.", { exact: true }).check();
    const idApproveWait = page.waitForResponse((r) => r.url().endsWith(`/api/admin/stores/${store.id}/seller-identity`));
    await reviewRegion.getByRole("button", { name: "Approve seller identity", exact: true }).click();
    expect((await idApproveWait).status()).toBe(200);

    await createDisposableNewVendorCommission(store.id);

    const p1Cur = await prisma.catalogProduct.findUniqueOrThrow({ where: { id: product1.id } });
    const p1App = await moderateCatalogProduct(p1Cur.id, admin1.id, "APPROVE", {
      version: p1Cur.version,
      operationId: randomUUID(),
      reasonCode: "V005_PROD_APPROVAL",
    });
    const o1Cur = await prisma.storeCatalogOffer.findUniqueOrThrow({
      where: { id: product1.offers[0]!.id },
      include: { priceVersions: true, variant: true },
    });
    const o1App = await moderateCatalogOffer(o1Cur.id, admin1.id, "APPROVE", {
      version: o1Cur.version,
      operationId: randomUUID(),
      reasonCode: "V005_OFFER_APPROVAL",
    });
    const o1Pub = await publishApprovedCatalogListing(o1App.id, admin2.id, {
      version: o1App.version,
      productVersion: p1App.version,
      priceVersionReference: o1Cur.priceVersions[0]!.publicReference,
      operationId: randomUUID(),
      reasonCode: "V005_PUBLICATION",
    });

    // Store still NOT publicly live until trusted packaging + real-source checkout capability certification
    expect((await prisma.storefrontStoreDocument.findUnique({ where: { storeId: store.id } }))?.publicStatus ?? "ABSENT").not.toBe("ACTIVE");
    await page.goto(`/shop/stores/${store.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("That marketplace item is not available.");
    expect(await page.content()).not.toContain(store.name);

    async function activatePackagingForOffers(offers: Array<{ publicReference: string; variantReference: string; version: number }>) {
      const entries = await Promise.all(
        offers.map(async (off) => {
          const pkg = await prisma.systemSetting.findUniqueOrThrow({ where: { key: `${PACKAGING_PREFIX}${off.publicReference}` } });
          const rev = (pkg.value as { revision: string }).revision;
          return {
            storeId: store.id,
            offerReference: off.publicReference,
            variantReference: off.variantReference,
            publicationVersion: String(off.version),
            modifiers: [] as Array<{ optionReference: string; quantity: number }>,
            packingRule: "SINGLE_PREPACKAGED_UNIT" as const,
            lengthCm: 20,
            widthCm: 15,
            heightCm: 5,
            weightKg: 0.4,
            authorityReference: `${PACKAGING_PREFIX}${off.publicReference}:${rev}`,
          };
        }),
      );
      const allPkgVersions = await listTrustedPackageVersions();
      const activeVer = allPkgVersions.filter((v) => v.status === "ACTIVE").sort((a, b) => b.version - a.version)[0];
      const latestNum = Math.max(0, ...allPkgVersions.map((v) => v.version));
      const offerSet = new Set(offers.map((o) => o.publicReference));
      const preservedPackages = await filterValidTrustedPackages(
        (activeVer?.packages ?? []).filter((p) => !offerSet.has(p.offerReference)),
      );
      const saved = await saveTrustedPackageVersion(admin1.id, {
        packages: [...preservedPackages, ...entries],
        bundles: activeVer?.bundles ?? [],
        effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
        effectiveTo: null,
        expectedVersion: latestNum,
        reason: `V005/V008 synthetic packaging for ${offers.length} offer(s)`,
      });
      const key = `production_marketplace_trusted_packages_v${saved.version}`;
      createdSettingKeys.push(key);
      const r1 = await prisma.systemSetting.findUniqueOrThrow({ where: { key } });
      await actOnTrustedPackageVersion(admin2.id, {
        version: saved.version,
        expectedUpdatedAt: r1.updatedAt.toISOString(),
        action: "APPROVE",
        reason: "V005/V008 packaging review approval",
      });
      const r2 = await prisma.systemSetting.findUniqueOrThrow({ where: { key } });
      await actOnTrustedPackageVersion(admin2.id, {
        version: saved.version,
        expectedUpdatedAt: r2.updatedAt.toISOString(),
        action: "ACTIVATE",
        reason: "V005/V008 packaging activation",
      });
    }

    await activatePackagingForOffers([
      {
        publicReference: o1Cur.publicReference,
        variantReference: o1Cur.variant.publicReference,
        version: o1Pub.offer.version,
      },
    ]);
    const certPrep = await prepareStoreCheckoutCertificationFromPreflight(
      store.id,
      admin1.id,
      "V005 real-source checkout capability proof",
    );
    expect(certPrep.status).toBe("PENDING_REVIEW");
    const certApproved = await approveStoreCheckoutCertification(store.id, admin2.id, certPrep.revision);
    expect(certApproved.status).toBe("APPROVED");

    // Storefront is now LIVE and onboarding cockpit reflects SHOP_LIVE
    await login(page, email);
    await page.goto("/store");
    await expect(page.getByTestId("store-onboarding-banner")).toHaveAttribute("data-shop-state", "SHOP_LIVE");
    await expect(page.getByTestId("store-onboarding-banner")).toContainText("Shop LIVE");
    await page.goto("/store/get-started");
    await expect(page.getByText("Live for customer checkout", { exact: true })).toBeVisible();

    await logout(page);
    const liveShopResp = await page.goto(`/shop/stores/${store.slug}`);
    expect(liveShopResp?.status()).toBe(200);
    await expect(page.getByText(`V005 Ceramic Mug ${tag}`).first()).toBeVisible();

    // V-008: While store is SHOP_LIVE, vendor adds Product #2, admin publishes Product #2,
    // and admin activates packaging v+1 without delisting the SHOP_LIVE store!
    await login(page, email);
    const product2 = await createProductThroughWizard(`V008 Linen Tote ${tag}`, `V008-TOTE-${tag}`, "125.00");
    const p2Cur = await prisma.catalogProduct.findUniqueOrThrow({ where: { id: product2.id } });
    const p2App = await moderateCatalogProduct(p2Cur.id, admin1.id, "APPROVE", {
      version: p2Cur.version,
      operationId: randomUUID(),
      reasonCode: "V008_PROD2_APPROVAL",
    });
    const o2Cur = await prisma.storeCatalogOffer.findUniqueOrThrow({
      where: { id: product2.offers[0]!.id },
      include: { priceVersions: true, variant: true },
    });
    const o2App = await moderateCatalogOffer(o2Cur.id, admin1.id, "APPROVE", {
      version: o2Cur.version,
      operationId: randomUUID(),
      reasonCode: "V008_OFFER2_APPROVAL",
    });
    const o2Pub = await publishApprovedCatalogListing(o2App.id, admin2.id, {
      version: o2App.version,
      productVersion: p2App.version,
      priceVersionReference: o2Cur.priceVersions[0]!.publicReference,
      operationId: randomUUID(),
      reasonCode: "V008_PUBLICATION",
    });

    // Store MUST stay ACTIVE & LIVE immediately after publishing Product #2 (even before packaging v+1)!
    expect((await prisma.storefrontStoreDocument.findUniqueOrThrow({ where: { storeId: store.id } })).publicStatus).toBe("ACTIVE");
    await activatePackagingForOffers([
      {
        publicReference: o1Cur.publicReference,
        variantReference: o1Cur.variant.publicReference,
        version: o1Pub.offer.version,
      },
      {
        publicReference: o2Cur.publicReference,
        variantReference: o2Cur.variant.publicReference,
        version: o2Pub.offer.version,
      },
    ]);
    expect((await prisma.storefrontStoreDocument.findUniqueOrThrow({ where: { storeId: store.id } })).publicStatus).toBe("ACTIVE");
    const liveOnboarding = await getStoreOnboardingByStoreId(store.id);
    expect(liveOnboarding?.shopState).toBe("SHOP_LIVE");
    expect(liveOnboarding?.metrics.liveStorefrontProducts).toBe(2);

    await logout(page);
    const liveShopAfter2 = await page.goto(`/shop/stores/${store.slug}`);
    expect(liveShopAfter2?.status()).toBe(200);
    await expect(page.getByText(`V005 Ceramic Mug ${tag}`).first()).toBeVisible();
    await expect(page.getByText(`V008 Linen Tote ${tag}`).first()).toBeVisible();
  });

  test("V-006 & V-007: VAT OFF vs VAT ON wizard guidance, earliest-step validation focus, keyboard navigation & 390px layout", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const tag = randomUUID().slice(0, 8);
    const email = `e2e-v006-owner-${tag}@ktcouriers.local`;

    const owner = await prisma.user.create({
      data: {
        email,
        name: "V006 Store Owner",
        role: "STORE",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        passwordHash: await bcrypt.hash("ChangeMe123!", 10),
      },
    });
    createdUserIds.push(owner.id);

    const store = await prisma.store.create({
      data: {
        ownerUserId: owner.id,
        name: `V006 Store ${tag}`,
        slug: `v006-store-${tag}`,
        status: "ACTIVE",
        contactEmail: email,
      },
    });
    createdStoreIds.push(store.id);

    const vatSettingKey = "pricing.marketplace_vat.enabled";
    const priorVatSetting = await prisma.systemSetting.findUnique({ where: { key: vatSettingKey } });

    try {
      await prisma.systemSetting.upsert({
        where: { key: vatSettingKey },
        create: { key: vatSettingKey, label: "Marketplace VAT enabled", type: "JSON", value: false },
        update: { value: false },
      });

      await login(page, email);
      await page.setViewportSize({ width: 390, height: 900 });
      await page.goto("/store/catalog/products/new");

      // V-007: Jump directly to Step 4 Review & save with missing fields on Steps 1..3
      const stepsNav = page.getByRole("list", { name: "Product listing steps", exact: true });
      await stepsNav.getByRole("button", { name: /Review & save/ }).click();
      await page.getByRole("button", { name: "Save product draft", exact: true }).click();

      // Must jump back to earliest invalid step (Step 1 of 4: Product details) & focus error summary
      await expect(page.getByText("Step 1 of 4", { exact: true })).toBeVisible();
      await expect(page.locator("#catalog-error-summary")).toBeFocused();
      await expect(page.locator("#catalog-error-summary [role='alert']")).toContainText("Enter a product title.");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

      // Keyboard navigation across step buttons
      const step3Btn = stepsNav.getByRole("button", { name: /Offer & stock/ });
      await step3Btn.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByText("Step 3 of 4", { exact: true })).toBeVisible();

      // V-006: With marketplace VAT OFF, wizard renders Selling price (ZAR) with explicit non-VAT guidance
      await expect(page.locator('label[for="selling-price-zar"]')).toHaveText("Selling price (ZAR)");
      await expect(page.locator("#selling-price-zar-help")).toContainText("no VAT added");
      await expect(page.locator("#selling-price-zar-help")).not.toContainText("inclusive of VAT");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

      // Enable Marketplace VAT AND give this store a VAT-registered approved seller identity -> verify dynamic VAT-inclusive note
      await prisma.systemSetting.upsert({
        where: { key: vatSettingKey },
        create: { key: vatSettingKey, label: "Marketplace VAT enabled", type: "JSON", value: true },
        update: { value: true },
      });
      await prisma.storeSellerLegalIdentity.create({
        data: {
          storeId: store.id,
          publicReference: `SID-V006-${tag}`,
          identityVersion: "V006_VAT_REG_V1",
          legalName: `V006 VatCo (Pty) Ltd ${tag}`,
          tradingName: `V006 Store ${tag}`,
          vatRegistrationStatus: "REGISTERED",
          vatNumber: "4123456789",
          invoiceClassification: "TAX_INVOICE",
          status: "APPROVED",
          effectiveFrom: new Date(Date.now() - 60_000),
        },
      });

      await page.reload();
      await page.getByRole("list", { name: "Product listing steps", exact: true }).getByRole("button", { name: /Offer & stock/ }).click();
      await expect(page.locator("#selling-price-zar-help")).toContainText("inclusive of VAT");
      await expect(page.locator("#selling-price-zar-help")).not.toContainText("no VAT added");
    } finally {
      if (priorVatSetting) {
        await prisma.systemSetting.update({
          where: { key: vatSettingKey },
          data: { value: priorVatSetting.value ?? false },
        }).catch(() => {});
      } else {
        await prisma.systemSetting.deleteMany({ where: { key: vatSettingKey } }).catch(() => {});
      }
    }
  });
});
