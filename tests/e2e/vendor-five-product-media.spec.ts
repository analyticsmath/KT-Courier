import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { expect, test } from "@playwright/test";
import { prisma } from "@/lib/db/prisma";
import { openSecurityPayload } from "@/lib/notifications/security-payload-vault";
import { assertDisposablePaystackAcceptance } from "@/lib/testing/disposable-paystack-policy";
import { login } from "./fixtures/auth";
import { canonicalDriverDeliveryJourney } from "./fixtures/driver-delivery";
import { createDisposableNewVendorCommission } from "@/scripts/e2e-checkout-authorities";

test("new vendor verifies, creates five products with ten images, publishes, sells and delivers through persisted chat", async ({ page }, info) => {
  test.setTimeout(900_000);
  assertDisposablePaystackAcceptance();
  expect(await prisma.$queryRaw`SELECT current_database() AS database, current_user AS role`).toEqual([{ database: "kt_phase75_e2e", role: "kt_phase75_e2e" }]);
  const tag = randomUUID().slice(0, 8); const email = `e2e-vendor-five-${tag}@ktcouriers.local`;
  const storeName = `Synthetic five-product vendor ${tag}`;
  const field = (name: string) => page.getByLabel(new RegExp(`^${name}(?:\\s*\\*)?$`));
  const origin = process.env.E2E_BASE_URL!;
  const headers = { origin };
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/signup?role=store");
  await field("Business or store name").fill(storeName); await field("Contact person").fill("Synthetic vendor owner");
  await field("Email address").fill(email); await field("Phone number").fill("0821112233");
  await field("Password").fill("ChangeMe123!"); await field("Confirm password").fill("ChangeMe123!");
  const signup = page.waitForResponse(response => response.url().endsWith("/api/auth/signup"));
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  const created = await signup; expect([201, 202], await created.text()).toContain(created.status());
  const registrationReply = await created.json();
  const repeatedSignup = await page.request.post("/api/auth/signup", { headers, data: created.request().postDataJSON() });
  expect(repeatedSignup.status()).toBe(created.status()); expect(await repeatedSignup.json()).toEqual(registrationReply);
  const owner = await prisma.user.findUniqueOrThrow({ where: { email } });
  const store = await prisma.store.findFirstOrThrow({ where: { ownerUserId: owner.id } });
  expect(store.status).toBe("PENDING");
  expect(await prisma.otpCode.count({ where: { userId: owner.id, purpose: "EMAIL_VERIFICATION" } })).toBe(1);
  const absentEmail = `e2e-no-account-${tag}@ktcouriers.local`;
  const absentResend = await page.request.post("/api/auth/resend-otp", { headers, data: { email: absentEmail } });
  const pendingResend = await page.request.post("/api/auth/resend-otp", { headers, data: { email } });
  expect(absentResend.status()).toBe(202); expect(pendingResend.status()).toBe(202);
  expect(pendingResend.status()).toBe(absentResend.status()); expect(await pendingResend.json()).toEqual(await absentResend.json());
  const otp = await prisma.otpCode.findFirstOrThrow({ where: { userId: owner.id, consumedAt: null, purpose: "EMAIL_VERIFICATION" }, orderBy: { createdAt: "desc" } });
  const intent = await prisma.notificationEventIntent.findUniqueOrThrow({ where: { operationId: `email-verification:${otp.id}` } });
  const envelope = await prisma.notificationSecurePayload.findUniqueOrThrow({ where: { eventIntentId: intent.id } });
  const code = String(openSecurityPayload(envelope.encryptedPayload, intent.operationId).otp);
  await field("Verification code").fill(code);
  const verified = page.waitForResponse(response => response.url().endsWith("/api/auth/verify-otp"));
  await page.getByRole("button", { name: "Verify code", exact: true }).click(); expect((await verified).status()).toBe(200);
  expect((await page.request.post("/api/auth/verify-otp", { headers, data: { email, code } })).status()).toBe(400);
  // Pending business owners can prepare their private catalog while business approval is pending.
  // This permission never authorizes self-approval or public product publication.
  const pendingInventory = await page.request.get("/api/store/catalog/inventory/locations");
  expect(pendingInventory.status(), await pendingInventory.text()).toBe(200);
  expect(await pendingInventory.json()).toEqual({ locations: [] });
  expect((await page.request.patch(`/api/admin/stores/${store.id}/status`, { headers, data: { status: "ACTIVE" } })).status()).toBe(403);
  expect((await prisma.store.findUniqueOrThrow({ where: { id: store.id } })).status).toBe("PENDING");
  await login(page, "superadmin@ktcouriers.local");
  const approval = await page.request.patch(`/api/admin/stores/${store.id}/status`, { headers, data: { status: "ACTIVE" } }); expect(approval.status(), await approval.text()).toBe(200);
  const categoryName = `Synthetic accessories ${tag}`;
  const category = await page.request.post("/api/admin/catalog/categories", { headers, data: { name: categoryName, slug: `synthetic-accessories-${tag}`, status: "ACTIVE", displayOrder: 0, operationId: randomUUID() } }); expect(category.status(), await category.text()).toBe(201);
  const createdCategory = (await category.json()).category;
  const mappedType = await prisma.productTypeDefinition.findFirstOrThrow({ where: { name: "Smartphone", status: "ACTIVE" } });
  await prisma.catalogCategoryProductType.create({ data: { categoryId: createdCategory.id, productTypeDefinitionId: mappedType.id, isPrimary: true } });
  await login(page, email);
  await page.goto("/store/profile");
  const seller = page.getByRole("form", { name: "Seller legal identity submission", exact: true });
  await seller.getByLabel("Identity version", { exact: true }).fill(`synthetic-${tag}-v1`);
  await seller.getByLabel("Legal seller name", { exact: true }).fill(`Synthetic seller ${tag}; not a production legal entity`);
  await seller.getByRole("combobox", { name: "VAT registration status", exact: true }).selectOption("NOT_REGISTERED");
  await seller.getByRole("combobox", { name: "Receipt classification", exact: true }).selectOption("RECEIPT");
  const utcDate = new Date().toISOString().slice(0, 16);
  await seller.getByLabel("Effective from (UTC)", { exact: true }).fill(utcDate);
  await seller.getByLabel("Supplied evidence reference", { exact: true }).fill("SYNTHETIC_OWNER_DETAILS_NOT_REAL_APPROVAL");
  await seller.getByLabel("I confirm these are the supplied seller details and evidence for review.", { exact: true }).check();
  const sellerSubmitted = page.waitForResponse(response => response.url().endsWith("/api/store/seller-identity") && response.request().method() === "POST");
  await seller.getByRole("button", { name: "Submit seller identity", exact: true }).click(); const pendingSeller = await sellerSubmitted; expect(pendingSeller.status(), await pendingSeller.text()).toBe(201);
  expect(await prisma.storeSellerLegalIdentity.count({ where: { storeId: store.id } })).toBe(0);
  expect((await page.request.post(`/api/admin/stores/${store.id}/seller-identity`, { headers, data: {} })).status()).toBe(403);
  await login(page, "superadmin@ktcouriers.local"); await page.goto(`/admin/stores/${store.id}/seller-identity`);
  const sellerReview = page.getByRole("region", { name: "Independent seller identity review", exact: true });
  await sellerReview.getByLabel("Seller review reason", { exact: true }).fill("Synthetic independent seller review only");
  await sellerReview.getByLabel("Reviewed evidence reference", { exact: true }).fill("SYNTHETIC_REVIEW_NOT_PRODUCTION_ACCEPTANCE");
  await sellerReview.getByLabel("I have independently reviewed the supplied seller details and evidence.", { exact: true }).check();
  const reviewedSeller = page.waitForResponse(response => response.url().endsWith(`/api/admin/stores/${store.id}/seller-identity`));
  await sellerReview.getByRole("button", { name: "Approve seller identity", exact: true }).click(); const sellerApproved = await reviewedSeller; expect(sellerApproved.status(), await sellerApproved.text()).toBe(200);
  const sellerReplay = await page.request.post(`/api/admin/stores/${store.id}/seller-identity`, { headers, data: sellerApproved.request().postDataJSON() }); expect(sellerReplay.status()).toBe(200); expect((await sellerReplay.json()).proposal.replayed).toBe(true);
  expect(await prisma.storeSellerLegalIdentity.count({ where: { storeId: store.id } })).toBe(1);
  await createDisposableNewVendorCommission(store.id);
  await login(page, email);
  // Known synthetic coordinates are structural deterministic-map input, not
  // real Google Maps, physical GPS or provider/device acceptance evidence.
  const pickup = await page.request.patch("/api/store/pickup-address", { headers, data: { label: "Synthetic pickup", contactName: "Synthetic vendor owner", contactPhone: "0821112233", line1: "10 E2E Pickup Road", city: "Johannesburg", province: "Gauteng", postalCode: "2001", country: "South Africa", latitude: -26.2041, longitude: 28.0473 } }); expect(pickup.status(), await pickup.text()).toBe(200);
  await page.goto("/store/catalog/inventory"); await page.getByLabel("Stock location name", { exact: true }).fill("Synthetic stockroom");
  const locationPath = "**/api/store/catalog/inventory/locations";
  let stockCommand: Record<string, unknown> = {};
  await page.route(locationPath, async route => {
    if (route.request().method() !== "POST") return route.continue();
    stockCommand = route.request().postDataJSON(); const response = await route.fetch(); expect(response.status()).toBe(201); await route.abort("failed");
  });
  await page.getByRole("button", { name: "Save stock location", exact: true }).click();
  await expect(page.locator("#stock-location-error")).not.toHaveText("");
  await page.unroute(locationPath);
  const retried = page.waitForResponse(response => response.url().endsWith("/api/store/catalog/inventory/locations") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Save stock location", exact: true }).click();
  const savedLocation = await retried; expect(savedLocation.status()).toBe(201); expect(savedLocation.request().postDataJSON()).toEqual(stockCommand);
  expect(await prisma.inventoryLocation.count({ where: { storeId: store.id } })).toBe(1);
  const products: Array<{ id: string; reference: string; title: string; slug: string; offerReference: string; offerId: string; primaryImageReference: string }> = [];
  for (const index of [0, 1, 2, 3, 4]) {
    const progress = page.getByRole("list", { name: "Product listing steps", exact: true });
    const step = async (name: string) => progress.getByRole("button", { name: new RegExp(name) }).click();
    const title = `Synthetic product ${index + 1} ${tag}`;
    await page.goto("/store/catalog/products/new");
    await expect(page.getByLabel("Product title", { exact: true })).toHaveValue("");
    await expect(page.getByLabel("Product type", { exact: true })).toHaveCount(0);
    const categoryLabel = index % 2 ? categoryName : "Electronics";
    await page.getByLabel("Category", { exact: true }).selectOption({ label: categoryLabel });
    await page.getByLabel("Product title", { exact: true }).fill(title);
    await page.getByLabel("Description", { exact: true }).fill("Synthetic product for disposable browser acceptance only.");
    await step("Photos & options");
    await page.getByText("Variants, compliance and modifiers (optional)", { exact: true }).click();
    if (index === 1) {
      await page.getByLabel("Sell sizes, colours or other product options", { exact: true }).check();
      await page.getByLabel("Variant name", { exact: true }).fill("Blue");
      await page.getByLabel("Option name", { exact: true }).fill("color");
      await page.getByLabel("Option value", { exact: true }).fill("blue");
    }
    if (index === 2) await page.getByLabel("Modifier groups", { exact: true }).fill(JSON.stringify([{ name: `Synthetic gift wrap ${tag}`, minimumSelections: 0, maximumSelections: 1, isRequired: false, options: [{ name: "Paper", priceDelta: "1.10", currency: "ZAR", displayOrder: 0 }] }]));
    for (const image of [0, 1]) {
      const bytes = await sharp({ create: { width: 400, height: 400, channels: 3, background: { r: 40 + index * 25, g: 70 + image * 70, b: 120 } } }).png().toBuffer();
      const upload = page.waitForResponse(response => response.url().endsWith("/api/store/catalog/media/normalized") && response.request().method() === "POST");
      await page.getByLabel("Upload product image", { exact: true }).setInputFiles({ name: `synthetic-${index}-${image}.png`, mimeType: "image/png", buffer: bytes });
      const uploaded = await upload; expect(uploaded.status(), await uploaded.text()).toBe(201);
      await page.getByLabel("Alt text", { exact: true }).nth(image).fill(`${title} image ${image + 1}`);
    }
    await step("Offer & stock"); await page.getByLabel("Packaged length (cm)", { exact: true }).fill("20"); await page.getByLabel("Packaged width (cm)", { exact: true }).fill("15"); await page.getByLabel("Packaged height (cm)", { exact: true }).fill("5"); await page.getByLabel("Packaged weight (kg)", { exact: true }).fill("0.4"); await page.getByLabel("How is this product packed?", { exact: true }).fill("Disposable test unit in a protective box.");
    if (index === 1) {
      await page.getByLabel("Variant SKU", { exact: true }).fill(`SYNTHETIC-${tag}-${index}`);
      await page.getByLabel("Variant price including VAT (ZAR)", { exact: true }).fill(`${20 + index}.25`);
      await page.getByLabel("Variant opening stock", { exact: true }).fill("7");
    } else {
      await page.getByLabel("Store SKU", { exact: true }).fill(`SYNTHETIC-${tag}-${index}`);
      await page.getByLabel("VAT-inclusive price (ZAR)", { exact: true }).fill(`${20 + index}.25`);
      await page.getByLabel("Opening stock", { exact: true }).fill("7");
    }
    await page.getByLabel("Inventory location", { exact: true }).selectOption({ label: "Synthetic stockroom" });
    await step("Review & save"); const saved = page.waitForResponse(response => response.url().endsWith("/api/store/catalog/listing-drafts") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Save product draft", exact: true }).click(); const response = await saved; expect(response.status(), await response.text()).toBe(201);
    const draft = (await response.json()).product;
    const row = await prisma.catalogProduct.findUniqueOrThrow({ where: { publicReference: draft.publicReference }, include: { offers: true, media: { include: { asset: true } } } });
    expect(row).toMatchObject({ status: "DRAFT", publicationStatus: "DRAFT" }); expect(row.media).toHaveLength(2); expect(row.media.every(media => media.asset.status === "READY" && media.asset.privacyInspectionPassed)).toBe(true);
    products.push({ id: row.id, reference: row.publicReference, title, slug: row.slug, offerReference: row.offers[0].publicReference, offerId: row.offers[0].id, primaryImageReference: row.media.find(media => media.role === "PRIMARY")!.asset.publicReference });
    await page.getByRole("link", { name: "View saved product", exact: true }).click();
    const submission = page.waitForResponse(response => response.url().endsWith(`/api/store/catalog/products/${row.publicReference}/submit`));
    await page.getByRole("button", { name: "Submit product for review", exact: true }).click(); expect((await submission).status()).toBe(200);
    await page.goto(`/store/catalog/offers/${row.offers[0].publicReference}`);
    const offerSubmission = page.waitForResponse(response => response.url().endsWith(`/api/store/catalog/offers/${row.offers[0].publicReference}/submit`));
    await page.getByRole("button", { name: "Submit offer for review", exact: true }).click(); expect((await offerSubmission).status()).toBe(200);
  }
  expect(await prisma.catalogProduct.count({ where: { sourceStoreId: store.id } })).toBe(5);
  expect(await prisma.catalogMediaAsset.count({ where: { ownerStoreId: store.id, purpose: "PRODUCT_IMAGE", status: "READY" } })).toBe(10);
  expect(await prisma.storefrontProductDocument.count({ where: { storeId: store.id } })).toBe(0);
  expect((await page.request.post(`/api/admin/catalog/offers/${products[0].offerId}/publish`, { headers, data: {} })).status()).toBe(403);
  await login(page, "e2e-other-store@ktcouriers.local");
  expect([403, 404]).toContain((await page.request.get(`/api/store/catalog/products/${products[0].reference}`)).status());
  expect((await page.request.get("/api/store/catalog/inventory/locations")).status()).toBe(200);
  expect((await (await page.request.get("/api/store/catalog/inventory/locations")).json()).locations.some((location: { name: string }) => location.name === "Synthetic stockroom")).toBe(false);
  await login(page, "superadmin@ktcouriers.local");
  for (const product of products) {
    await page.goto(`/admin/catalog/products/${product.id}`); await page.getByLabel("Reason code", { exact: true }).fill("SYNTHETIC_PRODUCT_REVIEW");
    const approved = page.waitForResponse(response => response.url().endsWith(`/api/admin/catalog/products/${product.id}/approve`)); await page.getByRole("button", { name: "Approve", exact: true }).click(); expect((await approved).status()).toBe(200);
    await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
    await page.getByLabel("Offer publication reason", { exact: true }).fill("SYNTHETIC_OFFER_REVIEW");
    const offerReview = page.waitForResponse(response => response.url().endsWith(`/api/admin/catalog/offers/${product.offerId}/approve`)); await page.getByRole("button", { name: "Approve offer", exact: true }).click(); expect((await offerReview).status()).toBe(200);
    await expect(page.getByRole("button", { name: "Publish reviewed listing", exact: true })).toBeVisible();
    // Refresh creates a fresh version-bound publication form after offer review.
    await page.getByLabel("Offer publication reason", { exact: true }).fill("SYNTHETIC_PUBLICATION");
    const publication = page.waitForResponse(response => response.url().endsWith(`/api/admin/catalog/offers/${product.offerId}/publish`)); await page.getByRole("button", { name: "Publish reviewed listing", exact: true }).click(); const published = await publication; expect(published.status(), await published.text()).toBe(200);
    const command = published.request().postDataJSON(); const replay = await page.request.post(`/api/admin/catalog/offers/${product.offerId}/publish`, { headers, data: command }); expect(replay.status()).toBe(200); expect((await replay.json()).replayed).toBe(true);
    expect((await page.request.post(`/api/admin/catalog/offers/${product.offerId}/publish`, { headers, data: { ...command, reasonCode: "CHANGED_OPERATION" } })).status()).toBe(409);
  }
  expect(await prisma.storefrontProductDocument.count({ where: { storeId: store.id, status: "ACTIVE", searchable: true } })).toBe(5);
  await login(page, "e2e-paystack-vendor-five-products@ktcouriers.local");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto(`/shop/stores/${store.slug}`);
    const storeCategories = page.getByRole("navigation", { name: "Store categories", exact: true });
    await expect(storeCategories.getByRole("link")).toHaveCount(2);
    expect(await storeCategories.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    const categoryBounds = await Promise.all((await storeCategories.getByRole("link").all()).map(link => link.boundingBox()));
    const navBounds = await storeCategories.boundingBox();
    expect(navBounds).not.toBeNull();
    for (const bounds of categoryBounds) {
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(navBounds!.x);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(navBounds!.x + navBounds!.width + 1);
    }
    for (const product of products) await expect(page.getByRole("link", { name: new RegExp(product.title) }).first()).toBeVisible();
    for (const product of products) { const image = page.locator(`img[src*="${product.primaryImageReference}"]`).first(); await image.scrollIntoViewIfNeeded(); await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0); }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await info.attach(`five-products-store-${width}`, { body: await page.screenshot({ fullPage: true, path: info.outputPath(`five-products-store-${width}.png`) }), contentType: "image/png" });
  }
  await page.setViewportSize({ width: 390, height: 900 });
  for (const product of products) {
    await page.goto(`/shop/products/${product.slug}-${product.reference}`);
    const purchase = page.getByRole("region", { name: "Purchase product", exact: true });
    await page.getByRole("region", { name: "Quick purchase dock", exact: true }).getByRole("button", { name: "Add to cart", exact: true }).click();
    await expect(purchase.getByRole("status")).toContainText(/added|cart/i);
  }
  const cart = await page.request.get("/api/cart"); expect((await cart.json()).cart.storeGroups[0].lines).toHaveLength(5);
  await page.goto("/cart"); await expect(page.getByRole("heading", { name: "Shopping bag", exact: true })).toBeVisible();
  for (const product of products) {
    await expect(page.getByRole("link", { name: product.title, exact: true })).toBeVisible();
    await expect.poll(() => page.locator(`img[src*="${product.primaryImageReference}"]`).first().evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await info.attach("five-products-cart", { body: await page.screenshot({ fullPage: true, path: info.outputPath("five-products-cart.png") }), contentType: "image/png" });
  const delivery = await canonicalDriverDeliveryJourney(page, "vendor-five-products", 390, async actor => { await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" })); await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0); await info.attach(`five-products-chat-${actor}`, { body: await page.screenshot({ fullPage: true, path: info.outputPath(`five-products-chat-${actor}.png`) }), contentType: "image/png" }); }, { storeEmail: email, checkout: { existingCart: true } });
  expect(delivery.final.order.status).toBe("DELIVERED"); expect(delivery.chat.persistedMessages).toBe(2);
  await info.attach("five-products-persisted-acceptance", { body: JSON.stringify({ evidenceClass: "DISPOSABLE_POSTGRES_OFFLINE_PROVIDER_AUTOMATED_EMULATION", vendorRegisteredThroughUi: true, products: products.map(product => ({ reference: product.reference, offerReference: product.offerReference })), productCount: 5, uploadedImages: 10, categoryCount: 2, viewports: [320, 390, 768, 1440], approvalSeparated: true, publicationReplay: true, delivery, protectedProductionAccessed: false, livePaymentPerformed: false, physicalDeviceAccepted: false }), contentType: "application/json" });
});
