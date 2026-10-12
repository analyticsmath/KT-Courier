import { expect, test } from "@playwright/test";
import { login, logout } from "./fixtures/auth";

test("admin checkout records match canonical unpaid evidence at desktop and mobile without mutation", async ({ page, browser }) => {
  if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
  const guest = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL });
  try {
    const cartResponse = await guest.request.get("/api/cart"); expect(cartResponse.status()).toBe(200);
    const cart = (await cartResponse.json()).cart;
    const lineResponse = await guest.request.post("/api/cart/lines", { data: { offerReference: "CO-E2E64GB", variantReference: "CV-E2E64GB", quantity: 1, modifiers: [], operationId: crypto.randomUUID(), requestHash: crypto.randomUUID(), cartVersion: cart.version } });
    expect(lineResponse.status()).toBe(201);
    const checkoutResponse = await guest.request.post("/api/checkout", { data: { cartReference: (await lineResponse.json()).cart.reference } });
    expect(checkoutResponse.status()).toBe(201);
    const checkout = (await checkoutResponse.json()).checkout;
    const before = await guest.request.get(`/api/checkout/${checkout.reference}`); expect(before.status()).toBe(200);
    const canonical = await before.json();
    await login(page, "superadmin@ktcouriers.local");
    const response = await page.request.get("/api/admin/marketplace-checkout"); expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    const records = await response.json();
    const fields: Record<string, string[]> = {
      checkouts: ["publicReference", "status", "grandTotal", "currency", "createdAt", "updatedAt"],
      orders: ["publicReference", "status", "grandTotal", "currency", "createdAt"],
      reservations: ["publicReference", "status", "expiresAt", "paymentUncertainAt"],
      settlements: ["publicReference", "status", "sellerBasis", "commissionAmount", "storeEarningAmount", "deliveryFeeResidual"],
      reconciliationCases: ["publicReference", "reason", "status", "createdAt"],
    };
    expect(Object.keys(records).sort()).toEqual(Object.keys(fields).sort());
    for (const [key, allowed] of Object.entries(fields)) {
      expect(records[key].length).toBeLessThanOrEqual(100);
      for (const row of records[key]) expect(Object.keys(row).sort()).toEqual([...allowed].sort());
    }
    const record = records.checkouts.find((row: { publicReference: string }) => row.publicReference === checkout.reference);
    expect(record).toMatchObject({ status: canonical.checkout.status, grandTotal: canonical.checkout.totals.grandTotal, currency: "ZAR" });
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport); await page.goto("/admin/marketplace-checkout");
      await expect(page.getByRole("heading", { name: "Marketplace checkout", exact: true })).toBeVisible();
      const row = page.getByRole("table", { name: "Checkouts", exact: true }).getByRole("row").filter({ hasText: checkout.reference });
      await expect(row).toHaveCount(1); await expect(row).toContainText(`ZAR ${record.grandTotal}`);
      await expect(row).toContainText(record.status.replaceAll("_", " ").toLowerCase());
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    }
    const after = await guest.request.get(`/api/checkout/${checkout.reference}`); expect(after.status()).toBe(200);
    expect(await after.json()).toEqual(canonical);
  } finally { await guest.close(); }
});

test("both checkout administration API aliases deny customer, vendor and anonymous access", async ({ page }) => {
  if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
  for (const email of ["customer@ktcouriers.local", "e2e-store@ktcouriers.local"]) {
    await login(page, email);
    for (const path of ["/api/admin/marketplace-checkout", "/api/admin/marketplace-checkouts"]) {
      const response = await page.request.get(path); expect(response.status()).toBe(403);
      const body = await response.json(); expect(body).not.toHaveProperty("checkouts"); expect(body).not.toHaveProperty("settlements");
    }
  }
  await logout(page);
  for (const path of ["/api/admin/marketplace-checkout", "/api/admin/marketplace-checkouts"]) expect((await page.request.get(path)).status()).toBe(401);
});
