import { expect, test, type Page, type APIRequestContext } from "@playwright/test";
import { login } from "./fixtures/auth";
const mutation = () => ({ operationId: crypto.randomUUID(), requestHash: crypto.randomUUID() });
const headers = () => ({ Origin: process.env.PLAYWRIGHT_BASE_URL! });
async function cart(request: APIRequestContext) {
  const response = await request.get("/api/cart");
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).cart;
}
async function add(page: Page, quantity = 1, custom?: ReturnType<typeof mutation>) {
  const current = await cart(page.request);
  const data = { offerReference: "CO-E2E64GB", variantReference: "CV-E2E64GB", quantity, modifiers: [], ...custom ?? mutation(), cartVersion: current.version };
  const response = await page.request.post("/api/cart/lines", { data, headers: headers() });
  expect(response.status(), await response.text()).toBe(201);
  return { data, body: await response.json() };
}
test.describe("Marketplace canonical cart journey", () => {
  test.beforeEach(() => {
    if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
  });
  test("anonymous cart persists ownership, exact server prices and its selection across reload", async ({ page }) => {
    const { body } = await add(page);
    expect(body.cart.storeGroups[0].lines[0]).toMatchObject({ variantReference: "CV-E2E64GB", quantity: 1, lineTotal: "1500.00" });
    expect((await page.context().cookies()).some(c => c.name === "kt_marketplace_cart" && c.httpOnly)).toBe(true);
    await page.goto("/cart");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("body")).toContainText("E2E Smartphone");
    await page.reload();
    expect((await cart(page.request)).reference).toBe(body.cart.reference);
  });
  test("quantity updates persist across reload with exact recalculated totals", async ({ page }) => {
    const { body } = await add(page);
    const line = body.cart.storeGroups[0].lines[0];
    const response = await page.request.patch(`/api/cart/lines/${line.reference}`, { headers: headers(), data: { cartReference: body.cart.reference, cartVersion: body.cart.version, quantity: 3, ...mutation() } });
    expect(response.status(), await response.text()).toBe(200);
    await page.goto("/cart"); await page.reload();
    expect((await cart(page.request)).storeGroups[0].lines[0]).toMatchObject({ quantity: 3, lineTotal: "4500.00" });
  });
  test("modifier changes apply the canonical option price", async ({ page }) => {
    const { body } = await add(page);
    const line = body.cart.storeGroups[0].lines[0];
    const response = await page.request.patch(`/api/cart/lines/${line.reference}`, { headers: headers(), data: { cartReference: body.cart.reference, cartVersion: body.cart.version, modifiers: [{ groupReference: "mod_warranty", optionReference: "opt_2yr", quantity: 1 }], ...mutation() } });
    expect(response.status(), await response.text()).toBe(200);
    expect((await response.json()).cart.storeGroups[0].lines[0]).toMatchObject({ lineTotal: "1750.00", modifiers: [expect.objectContaining({ optionReference: "opt_2yr", priceDelta: "250.00" })] });
  });
  test("removing a line leaves a truthful empty persisted cart", async ({ page }) => {
    const { body } = await add(page);
    const response = await page.request.delete(`/api/cart/lines/${body.cart.storeGroups[0].lines[0].reference}`, { headers: headers(), data: { cartVersion: body.cart.version, ...mutation() } });
    expect(response.status()).toBe(200);
    expect((await cart(page.request)).storeGroups).toHaveLength(0);
    expect((await cart(page.request)).totals.grandTotal).toBe("0.00");
  });
  test("authenticated claim clears the guest cookie and retains the selected line", async ({ page }) => {
    const guest = await add(page);
    await login(page, "customer@ktcouriers.local", { preserveGuestCart: true });
    const response = await page.request.post("/api/cart/claim", { headers: headers(), data: { cartVersion: guest.body.cart.version, ...mutation() } });
    expect(response.status(), await response.text()).toBe(200);
    expect((await response.json()).cart.cart.owner.type).toBe("CUSTOMER");
    expect((await page.context().cookies()).some(c => c.name === "kt_marketplace_cart")).toBe(false);
    expect((await cart(page.request)).itemCount).toBeGreaterThan(0);
  });
  test("merge combines canonical customer and guest selections by fingerprint", async ({ page }) => {
    const guest = await add(page, 2);
    await login(page, "customer@ktcouriers.local", { preserveGuestCart: true });
    const existing = await cart(page.request);
    const cleared = await page.request.post("/api/cart/clear", { headers: headers(), data: { cartReference: existing.reference, cartVersion: existing.version, ...mutation() } });
    expect(cleared.status()).toBe(200);
    await add(page, 1);
    const response = await page.request.post("/api/cart/merge", { headers: headers(), data: { cartVersion: guest.body.cart.version, ...mutation() } });
    expect(response.status(), await response.text()).toBe(200);
    expect((await cart(page.request)).storeGroups[0].lines[0].quantity).toBe(3);
  });
  test("operation replay preserves one line and one version", async ({ page }) => {
    const first = await add(page);
    const replay = await page.request.post("/api/cart/lines", { headers: headers(), data: first.data });
    expect(replay.status()).toBe(201);
    expect((await replay.json()).cart.replayed).toBe(true);
    const current = await cart(page.request);
    expect(current.version).toBe(first.body.cart.version);
    expect(current.storeGroups[0].lines).toHaveLength(1);
  });
  test("another browser cannot mutate the owner's line, including a known receipt", async ({ page, browser }) => {
    const first = await add(page);
    const other = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL });
    try {
      const foreign = await cart(other.request);
      const response = await other.request.patch(`/api/cart/lines/${first.body.cart.storeGroups[0].lines[0].reference}`, { headers: headers(), data: { cartReference: first.body.cart.reference, cartVersion: foreign.version, quantity: 5, ...mutation() } });
      expect(response.status()).toBe(404);
      expect((await cart(page.request)).storeGroups[0].lines[0].quantity).toBe(1);
    } finally { await other.close(); }
  });
  test("stale mutations fail deterministically without altering the accepted quantity", async ({ page }) => {
    const first = await add(page);
    const path = `/api/cart/lines/${first.body.cart.storeGroups[0].lines[0].reference}`;
    const data = { cartReference: first.body.cart.reference, cartVersion: first.body.cart.version, quantity: 2, ...mutation() };
    expect((await page.request.patch(path, { headers: headers(), data })).status()).toBe(200);
    const stale = await page.request.patch(path, { headers: headers(), data: { ...data, quantity: 4, ...mutation() } });
    expect(stale.status()).toBe(409);
    expect((await stale.json()).code).toBe("CART_VERSION_CONFLICT");
    expect((await cart(page.request)).storeGroups[0].lines[0].quantity).toBe(2);
  });
});
