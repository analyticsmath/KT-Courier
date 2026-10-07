import { expect, test, type Page } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import sharp from "sharp";
import { login } from "./fixtures/auth";

async function post(page: Page, path: string, data: unknown) {
  return page.request.post(path, { headers: { Origin: process.env.PLAYWRIGHT_BASE_URL! }, data });
}
async function product(page: Page, id: string) {
  const response = await page.request.get(`/api/admin/catalog/products/${id}`);
  expect(response.status()).toBe(200); expect(response.headers()["cache-control"]).toContain("no-store");
  const canonical = (await response.json()).product;
  expect(JSON.stringify(canonical)).not.toContain('"storageKey"'); expect(JSON.stringify(canonical)).not.toContain('"storageProvider"');
  return canonical;
}
async function submittedProduct(page: Page) {
  await login(page, "e2e-store@ktcouriers.local"); await page.goto("/store/catalog/products/new");
  await page.getByRole("button", { name: /Type and category/ }).click();
  const definition = await page.getByLabel("Product type", { exact: true }).selectOption({ label: "Smartphone · v1" });
  const category = await page.getByLabel("Category", { exact: true }).selectOption({ label: "Electronics · /electronics" });
  const png = await sharp(randomBytes(400 * 400 * 3), { raw: { width: 400, height: 400, channels: 3 } }).png().toBuffer();
  const upload = await page.request.post("/api/store/catalog/media/normalized", { headers: { Origin: process.env.PLAYWRIGHT_BASE_URL!, "x-catalog-operation-id": randomUUID() }, multipart: { purpose: "PRODUCT_IMAGE", file: { name: "disposable-review.png", mimeType: "image/png", buffer: png } } });
  expect(upload.status()).toBe(201); const asset = (await upload.json()).asset;
  const title = "Disposable moderation product " + randomUUID();
  const created = await post(page, "/api/store/catalog/listing-drafts", { operationId: randomUUID(), product: { scope: "STORE_PRIVATE", productTypeDefinitionId: definition[0], primaryCategoryId: category[0], title, description: "Synthetic moderation facts; no real human approval represented.", condition: "NEW", attributeValues: {}, complianceValues: {} }, variants: [], storeSku: "REVIEW-" + randomUUID(), price: { amount: "19.25", currency: "ZAR", priceIncludesTax: true, effectiveFrom: new Date().toISOString() }, openingStock: 0, modifiers: [], media: [{ assetPublicReference: asset.publicReference, altText: "Disposable review image", primary: true, variantAssociation: "PRODUCT", displayOrder: 0 }] });
  expect(created.status()).toBe(201); const draft = (await created.json()).product;
  const submitted = await post(page, `/api/store/catalog/products/${draft.publicReference}/submit`, { version: draft.version, operationId: randomUUID() });
  expect(submitted.status()).toBe(200); return { source: (await submitted.json()).product, title };
}

for (const width of [1440, 390]) {
  test("catalog moderation preserves history and replays uncertain native actions at " + width + "px", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
    await page.setViewportSize({ width, height: 900 }); const { source, title } = await submittedProduct(page);
    await login(page, "superadmin@ktcouriers.local"); await page.goto(`/admin/catalog/products/${source.id}`);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await page.getByLabel("Reason code", { exact: true }).fill("DISPOSABLE_CHANGES");
    const action = page.getByRole("button", { name: "Request changes", exact: true });
    const path = `**/api/admin/catalog/products/${source.id}/request-changes`; let attempts = 0; let command: Record<string, unknown> = {};
    await page.route(path, async route => { attempts++; command = route.request().postDataJSON(); const response = await route.fetch(); expect(response.status()).toBe(200); await route.abort("failed"); });
    await action.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
    await expect(page.getByRole("alert").filter({ hasText: "The moderation result could not be confirmed." })).toBeVisible(); expect(attempts).toBe(1); await expect(action).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath("catalog-moderation-uncertain.png"), fullPage: true, animations: "disabled" });
    await page.unroute(path); const retryPromise = page.waitForResponse(response => response.url().endsWith(`/products/${source.id}/request-changes`) && response.request().method() === "POST");
    await action.focus(); await action.press("Enter"); const retry = await retryPromise; expect(retry.status()).toBe(200); expect(retry.request().postDataJSON()).toEqual(command);
    await expect(page.getByRole("button", { name: "Request changes", exact: true })).toHaveCount(0);
    let canonical = await product(page, source.id); expect(canonical.status).toBe("NEEDS_CHANGES"); expect(canonical.moderationCases[0].history).toHaveLength(1);
    expect(canonical.publicationStatus).toBe("DRAFT"); expect(canonical.offers[0].priceVersions[0].status).toBe("DRAFT");
    expect((await post(page, `/api/admin/catalog/products/${source.id}/request-changes`, { ...command, reasonCode: "DISPOSABLE_CHANGED" })).status()).toBe(409);
    await login(page, "e2e-store@ktcouriers.local"); const resubmitted = await post(page, `/api/store/catalog/products/${source.publicReference}/submit`, { version: canonical.version, operationId: randomUUID() }); expect(resubmitted.status()).toBe(200);
    await login(page, "superadmin@ktcouriers.local"); await page.goto(`/admin/catalog/products/${source.id}`);
    await page.getByLabel("Reason code", { exact: true }).fill("DISPOSABLE_SUSPENSION"); await page.getByRole("button", { name: "Suspend", exact: true }).click();
    await expect.poll(async () => (await product(page, source.id)).status).toBe("SUSPENDED"); await expect(page.getByRole("button", { name: "Suspend", exact: true })).toHaveCount(0);
    await expect(page.getByText("DISPOSABLE_SUSPENSION · version", { exact: false })).toBeVisible();
    canonical = await product(page, source.id); expect(canonical.publicationStatus).toBe("DRAFT");
    expect(canonical.moderationCases.flatMap((row: { history: unknown[] }) => row.history)).toHaveLength(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath("catalog-moderation-suspended.png"), fullPage: true, animations: "disabled" });
    await login(page, "e2e-ledger-denied@ktcouriers.local"); expect((await page.request.get(`/api/admin/catalog/products/${source.id}`)).status()).toBe(403);
    for (const name of ["approve", "request-changes", "reject", "suspend"]) expect((await post(page, `/api/admin/catalog/products/${source.id}/${name}`, { version: canonical.version, operationId: randomUUID(), reasonCode: "DISPOSABLE_DENIED" })).status()).toBe(403);
    for (const email of ["customer@ktcouriers.local", "e2e-store@ktcouriers.local", "e2e-withdrawal-driver-1440@ktcouriers.local"]) {
      await login(page, email); expect((await page.request.get(`/api/admin/catalog/products/${source.id}`)).status()).toBe(403);
      expect((await post(page, `/api/admin/catalog/products/${source.id}/approve`, { version: canonical.version, operationId: randomUUID(), reasonCode: "DISPOSABLE_DENIED" })).status()).toBe(403);
    }
    await page.context().clearCookies(); expect((await page.request.get(`/api/admin/catalog/products/${source.id}`)).status()).toBe(401);
  });
}
