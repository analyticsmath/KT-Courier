import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { randomBytes, randomUUID } from "node:crypto";
import { login } from "./fixtures/auth";

async function read(page: Page, path: string) {
  const response = await page.request.get(path); expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store"); return response.json();
}
async function step(page: Page, name: string) { await page.getByRole("button", { name: new RegExp(name) }).click(); }
for (const width of [1440, 390]) {
  test("store saves a complete listing atomically and replays a lost confirmation at " + width + "px", async ({ page }) => {
    test.setTimeout(60_000);
    if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
    await page.setViewportSize({ width, height: 900 }); await login(page, "e2e-store@ktcouriers.local");
    const tag = randomUUID(); const title = "Disposable catalog product " + tag; const sku = "DISPOSABLE-" + tag.toUpperCase();
    await page.goto("/store/catalog/products/new"); await expect(page.getByRole("heading", { name: "New product", exact: true })).toBeVisible();
    await step(page, "Submit"); await page.getByRole("button", { name: "Save product draft", exact: true }).click();
    await expect(page.locator("#catalog-error-summary").getByRole("alert")).toContainText("Select a product type.");
    await step(page, "Type and category"); await page.getByLabel("Product type", { exact: true }).selectOption({ label: "Smartphone · v1" });
    await page.getByLabel("Category", { exact: true }).selectOption({ label: "Electronics · /electronics" });
    await step(page, "Core information"); await page.getByLabel("Product title", { exact: true }).fill(title);
    await page.getByLabel("Description", { exact: true }).fill("Synthetic catalog listing for transaction validation only.");
    await step(page, "Variants"); await page.getByLabel("Variant matrix", { exact: true }).fill(JSON.stringify([{ title: "Blue", options: [{ code: "color", value: "blue" }], attributeValues: {} }]));
    await step(page, "Store offer"); await page.getByLabel("Store SKU", { exact: true }).fill(sku);
    await step(page, "Price"); await page.getByLabel("VAT-inclusive price (ZAR)", { exact: true }).fill("19.25");
    await step(page, "Inventory"); await page.getByLabel("Opening stock", { exact: true }).fill("7");
    await page.getByLabel("Inventory location", { exact: true }).selectOption({ label: "Primary E2E Warehouse" });
    await step(page, "Modifiers"); await page.getByLabel("Modifier groups", { exact: true }).fill(JSON.stringify([{ name: "Gift wrap", minimumSelections: 0, maximumSelections: 1, isRequired: false, options: [{ name: "Paper", priceDelta: "1.10", currency: "ZAR", displayOrder: 0 }] }]));
    await step(page, "Media"); const file = page.getByLabel("Upload product image", { exact: true });
    await file.setInputFiles({ name: "invalid.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
    await expect(page.getByRole("alert").filter({ hasText: "Choose a JPEG, PNG or WebP image." })).toBeVisible();
    const png = await sharp(randomBytes(400 * 400 * 3), { raw: { width: 400, height: 400, channels: 3 } }).png().toBuffer();
    const uploadPromise = page.waitForResponse(response => response.url().endsWith("/api/store/catalog/media/normalized") && response.request().method() === "POST");
    await file.setInputFiles({ name: "disposable-product.png", mimeType: "image/png", buffer: png });
    const uploaded = await uploadPromise; expect(uploaded.status()).toBe(201);
    const asset = (await uploaded.json()).asset; expect(asset).toMatchObject({ status: "READY", width: 400, height: 400 });
    expect(asset).not.toHaveProperty("storageKey");
    await page.getByLabel("Alt text", { exact: true }).fill("Disposable synthetic product image");
    await expect(page.getByRole("radio", { name: "Primary image", exact: true })).toBeChecked();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

    await step(page, "Preview"); await expect(page.getByRole("region", { name: "Exact draft preview" })).toContainText("19.25");
    await step(page, "Submit"); const save = page.getByRole("button", { name: "Save product draft", exact: true });
    const path = "**/api/store/catalog/listing-drafts"; let attempts = 0; let command: Record<string, unknown> = {}; let saved: { publicReference: string; offers: { publicReference: string }[] };
    await page.route(path, async route => { attempts++; command = route.request().postDataJSON(); const response = await route.fetch(); expect(response.status()).toBe(201); saved = (await response.json()).product; await route.abort("failed"); });
    await save.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
    await expect(page.locator("#catalog-error-summary").getByRole("alert")).toContainText("The save could not be confirmed."); await expect(save).toBeEnabled(); expect(attempts).toBe(1);

    await page.unroute(path); const retryPromise = page.waitForResponse(response => response.url().endsWith("/api/store/catalog/listing-drafts") && response.request().method() === "POST");
    await save.focus(); await save.press("Enter"); const retry = await retryPromise; expect(retry.status()).toBe(201); expect(retry.request().postDataJSON()).toEqual(command);
    const confirmed = (await retry.json()).product; expect(confirmed).toEqual(saved!);
    await expect(page.getByRole("heading", { name: "Listing draft saved", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

    const canonical = (await read(page, "/api/store/catalog/products/" + confirmed.publicReference)).product;
    expect(JSON.stringify(canonical)).not.toContain('"storageKey"'); expect(JSON.stringify(canonical)).not.toContain('"storageProvider"');
    expect(canonical).toMatchObject({ title, status: "DRAFT", publicationStatus: "DRAFT", media: [{ altText: "Disposable synthetic product image", role: "PRIMARY" }] });
    expect(canonical.variants.map((row: { title: string }) => row.title).sort()).toEqual(["Blue", "Default"]);
    const offer = (await read(page, "/api/store/catalog/offers/" + confirmed.offers[0].publicReference)).offer;
    expect(offer).toMatchObject({ storeSku: sku, status: "DRAFT", inventoryItem: { levels: [{ onHand: 7, reserved: 0, available: 7 }], movements: [{ quantityDelta: 7, type: "INITIAL_STOCK" }] }, modifierGroups: [{ group: { name: "Gift wrap", options: [{ priceDelta: "1.1" }] } }] });
    expect(Number(offer.priceVersions[0].amount).toFixed(2)).toBe("19.25"); expect(offer.priceVersions).toHaveLength(1);
    const products = (await read(page, "/api/store/catalog/products?search=" + encodeURIComponent(title))).products; expect(products).toHaveLength(1);
    const changed = await page.request.post("/api/store/catalog/listing-drafts", { headers: { Origin: process.env.PLAYWRIGHT_BASE_URL }, data: { ...command, openingStock: 9 } }); expect(changed.status()).toBe(409);
    await page.getByRole("link", { name: "View saved offer", exact: true }).click(); await expect(page.getByRole("heading", { name: sku, exact: true })).toBeVisible();
    await expect(page.getByText("ZAR 19.25", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

    await page.goto("/store/catalog/products/new"); await step(page, "Find existing product"); await page.getByLabel("Find an existing product", { exact: true }).fill(title);
    await page.getByRole("button", { name: "Search matching products", exact: true }).click();
    await expect(page.getByRole("region", { name: "Duplicate suggestions" })).toContainText(confirmed.publicReference);
    const otherStore = "e2e-other-store@ktcouriers.local"; await login(page, otherStore);
    expect((await page.request.get("/api/store/catalog/products/" + confirmed.publicReference)).status()).toBe(404);
    expect((await page.request.get("/api/store/catalog/offers/" + confirmed.offers[0].publicReference)).status()).toBe(404);
    const suggestions = await read(page, "/api/store/catalog/products/duplicate-search?" + new URLSearchParams({ title, productTypeCode: "smartphone" })); expect(suggestions.candidates).toEqual([]);
    const foreign = await page.request.post("/api/store/catalog/listing-drafts", { headers: { Origin: process.env.PLAYWRIGHT_BASE_URL }, data: { ...command, operationId: randomUUID(), openingStock: 0, inventoryLocationPublicReference: undefined } }); expect(foreign.status()).toBe(403);
    await login(page, "e2e-catalog-denied@ktcouriers.local");
    expect((await read(page, "/api/store/catalog/products")).products).toEqual([]);
    expect((await page.request.post("/api/store/catalog/listing-drafts", { headers: { Origin: process.env.PLAYWRIGHT_BASE_URL }, data: command })).status()).toBe(403);
    expect((await read(page, "/api/store/catalog/products")).products).toEqual([]);
    for (const email of ["customer@ktcouriers.local", "e2e-withdrawal-driver-1440@ktcouriers.local", "e2e-ledger-denied@ktcouriers.local"]) { await login(page, email); expect((await page.request.post("/api/store/catalog/listing-drafts", { data: command })).status()).toBe(403); }
    await page.context().clearCookies(); expect((await page.request.post("/api/store/catalog/listing-drafts", { data: command })).status()).toBe(401);
  });
}
