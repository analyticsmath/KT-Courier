import { expect, test, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";

async function readCheckout(page: Page, reference: string) {
  const response = await page.request.get(`/api/checkout/${reference}`);
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  return (await response.json()).checkout;
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`customer corrects and resumes an unpaid checkout without granting foreign confirmation access at ${viewport.width}px`, async ({ page }) => {
    if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
    await page.setViewportSize(viewport);
    const email = `e2e-checkout-${viewport.width}@ktcouriers.local`;
    await login(page, email);
    const cartResponse = await page.request.get("/api/cart"); expect(cartResponse.status()).toBe(200);
    const cart = (await cartResponse.json()).cart;
    const line = await page.request.post("/api/cart/lines", { data: { offerReference: "CO-E2E64GB", variantReference: "CV-E2E64GB", quantity: 1, modifiers: [], operationId: crypto.randomUUID(), requestHash: crypto.randomUUID(), cartVersion: cart.version } }); expect(line.status()).toBe(201);
    const created = await page.request.post("/api/checkout", { data: { cartReference: (await line.json()).cart.reference } }); expect(created.status()).toBe(201);
    const reference = (await created.json()).checkout.reference as string;
    await page.goto(`/checkout?ref=${reference}`);
    const recipient = `Disposable recipient ${viewport.width}`;
    await page.getByLabel("Recipient Full Name", { exact: true }).fill(recipient);
    await page.getByLabel("Email Address", { exact: true }).fill(email);
    await page.getByLabel("Phone Number (SA)", { exact: true }).fill("+27821112233");
    await page.getByRole("button", { name: /Continue to Delivery Address/ }).click();
    await expect(page.getByRole("heading", { name: "2. Delivery address", exact: true })).toBeFocused();
    await page.getByLabel("Street Address (Line 1)", { exact: true }).fill("999 Unknown St");
    await page.getByLabel("Suburb / Area", { exact: true }).fill("Central");
    await page.getByLabel("City", { exact: true }).fill("Johannesburg");
    await page.getByLabel("Province", { exact: true }).selectOption("Gauteng");
    await page.getByLabel("Postal Code", { exact: true }).fill("2001");
    const before = await readCheckout(page, reference);
    await page.getByRole("button", { name: /Calculate Delivery/ }).click();
    await expect(page.locator("#checkout-error")).toContainText("could not be located");
    await expect(page.getByRole("form", { name: "2. Delivery address", exact: true })).toHaveAttribute("aria-describedby", "checkout-error");
    expect(await readCheckout(page, reference)).toEqual(before);
    await page.getByLabel("Street Address (Line 1)", { exact: true }).fill("45 Commission St");
    await page.getByLabel("Delivery Instructions / Gate Access", { exact: true }).fill("Disposable reception instruction");
    await page.getByRole("button", { name: /Calculate Delivery/ }).click();
    await expect(page.getByRole("heading", { name: "3. Delivery options", exact: true })).toBeFocused();
    const saved = await readCheckout(page, reference);
    expect(saved.contact).toMatchObject({ recipientName: recipient, email, phone: "+27821112233" });
    expect(saved.deliveryAddress).toMatchObject({ line1: "45 Commission St", city: "Johannesburg", deliveryInstructions: "Disposable reception instruction" });
    expect(saved.deliveryAddress).not.toHaveProperty("protectedCoordinates");
    expect(saved.contact).not.toHaveProperty("verifiedCustomerReference");
    await page.reload();
    await expect(page.getByLabel("Recipient Full Name", { exact: true })).toHaveValue(recipient);
    await expect(page.getByLabel("Email Address", { exact: true })).toHaveValue(email);
    await page.getByRole("button", { name: /Continue to Delivery Address/ }).click();
    await expect(page.getByLabel("Street Address (Line 1)", { exact: true })).toHaveValue("45 Commission St");
    await expect(page.getByLabel("Delivery Instructions / Gate Access", { exact: true })).toHaveValue("Disposable reception instruction");
    await page.getByLabel("Delivery Instructions / Gate Access", { exact: true }).fill("Corrected reception instruction");
    await page.getByRole("button", { name: /Calculate Delivery/ }).click();
    await expect(page.getByRole("heading", { name: "3. Delivery options", exact: true })).toBeFocused();
    const corrected = await readCheckout(page, reference);
    expect(corrected.version).toBeGreaterThan(saved.version);
    expect(corrected.deliveryAddress.deliveryInstructions).toBe("Corrected reception instruction");

    // Return parameters and browser status routes never grant payment or order authority.
    await page.goto(`/checkout/${reference}/return?status=success&paid=true&reference=forged-provider-reference`);
    await expect(page.getByRole("heading", { name: "Confirming your payment", exact: true })).toBeVisible();
    expect(await readCheckout(page, reference)).toEqual(corrected);
    await page.getByRole("link", { name: "Return to checkout", exact: true }).click();
    await expect(page.getByLabel("Recipient Full Name", { exact: true })).toHaveValue(recipient);
    await expect(page.getByRole("heading", { name: "Your order is confirmed", exact: true })).toHaveCount(0);
    expect(corrected.status).not.toBe("COMPLETED");
    await login(page, "e2e-checkout-other@ktcouriers.local");
    for (const path of [`/api/checkout/${reference}`, `/api/checkout/${reference}/status`]) {
      const denied = await page.request.get(path); expect(denied.status()).toBe(404);
      const body = await denied.json(); expect(body).not.toHaveProperty("checkout"); expect(JSON.stringify(body)).not.toContain(recipient);
    }
    await page.goto(`/checkout?ref=${reference}`);
    await expect(page.getByRole("heading", { name: "Your checkout is not available", exact: true })).toBeVisible();
    await expect(page.getByLabel("Recipient Full Name", { exact: true })).toHaveCount(0);
    await login(page, email);
    expect(await readCheckout(page, reference)).toEqual(corrected);
    await page.context().clearCookies();
    expect((await page.request.get(`/api/checkout/${reference}/status`)).status()).toBe(401);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    // Actual successful payment/finalization and paid-order confirmation remain separate open gates.
  });
}
