import { expect, test, type Page } from "@playwright/test";

async function openCheckout(page: Page) {
  if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
  const cartRes = await page.request.get("/api/cart"); expect(cartRes.status()).toBe(200);
  const cart = (await cartRes.json()).cart;
  const lineRes = await page.request.post("/api/cart/lines", { data: { offerReference: "CO-E2E64GB", variantReference: "CV-E2E64GB", quantity: 1, modifiers: [], operationId: crypto.randomUUID(), requestHash: crypto.randomUUID(), cartVersion: cart.version } });
  expect(lineRes.status()).toBe(201);
  const checkoutRes = await page.request.post("/api/checkout", { data: { cartReference: (await lineRes.json()).cart.reference } });
  expect(checkoutRes.status()).toBe(201);
  const checkout = (await checkoutRes.json()).checkout;
  await page.goto(`/checkout?ref=${checkout.reference}`);
  await expect(page.getByRole("heading", { name: "Secure checkout", exact: true })).toBeVisible();
  return checkout;
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`checkout keyboard progression announces server-backed review at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const checkout = await openCheckout(page);
    await page.getByLabel("Recipient Full Name", { exact: true }).fill("Disposable Recipient");
    await page.getByLabel("Email Address", { exact: true }).fill("disposable-recipient@example.test");
    await page.getByLabel("Phone Number (SA)", { exact: true }).fill("+27110001111");
    const contactSubmit = page.getByRole("button", { name: /Continue to Delivery Address/ });
    expect((await contactSubmit.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await contactSubmit.focus(); await contactSubmit.press("Enter");
    await expect(page.getByRole("heading", { name: "2. Delivery address", exact: true })).toBeFocused();
    await expect(page.getByRole("status").filter({ hasText: "Step 2 of 5" })).toContainText("Delivery address");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Street Address (Line 1)", { exact: true })).toBeFocused();
    await page.keyboard.type("45 Commission St");
    await page.getByLabel("Suburb / Area", { exact: true }).fill("Central");
    await page.getByLabel("City", { exact: true }).fill("Johannesburg");
    await page.getByLabel("Province", { exact: true }).selectOption("Gauteng");
    await page.getByLabel("Postal Code", { exact: true }).fill("2001");
    const addressSubmit = page.getByRole("button", { name: /Calculate Delivery/ });
    await addressSubmit.focus(); await addressSubmit.press("Enter");
    await expect(page.getByRole("heading", { name: "3. Delivery options", exact: true })).toBeFocused();
    await expect(page.getByRole("alert")).toHaveCount(0);
    const review = page.getByRole("button", { name: "Review order →", exact: true });
    await review.focus(); await review.press("Enter");
    await expect(page.getByRole("heading", { name: "4. Review your order", exact: true })).toBeFocused();
    await expect(page.getByRole("status").filter({ hasText: "Step 4 of 5" })).toContainText("Review your order");
    const proceed = page.getByRole("button", { name: "Continue to payment →", exact: true });
    await expect(proceed).toBeDisabled();
    const acknowledgement = page.getByRole("checkbox", { name: /I accept the Terms of Service/ });
    await acknowledgement.focus(); await acknowledgement.press("Space");
    await expect(acknowledgement).toBeChecked(); await expect(proceed).toBeEnabled();
    for (const [name, href] of [["Terms of Service", "/terms"], ["Refund and Cancellation Policy", "/refund-policy"], ["Privacy Policy", "/privacy-policy"]]) await expect(acknowledgement.locator("..").getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
    const currentRes = await page.request.get(`/api/checkout/${checkout.reference}`); expect(currentRes.status()).toBe(200);
    const current = (await currentRes.json()).checkout;
    expect(current.version).toBeGreaterThan(checkout.version);
    // Disposable tariff R23.45 plus the seed's explicit 15% VAT = R26.97.
    expect(current.totals.deliveryFeeTotal).toBe("26.97"); expect(current.totals.grandTotal).toBe("1526.97");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    // Stop before reservation/payment; ticking a box cannot claim a paid order.
  });
}

test("server contact rejection is announced and associated with the form without progressing", async ({ page }) => {
  const checkout = await openCheckout(page);
  await page.getByLabel("Recipient Full Name", { exact: true }).fill("Disposable Recipient");
  await page.getByLabel("Email Address", { exact: true }).fill("disposable-recipient@example.test");
  await page.getByLabel("Phone Number (SA)", { exact: true }).fill("123");
  await page.getByRole("button", { name: /Continue to Delivery Address/ }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("form", { name: "1. Contact", exact: true })).toHaveAttribute("aria-describedby", "checkout-error");
  await expect(page.getByRole("status").filter({ hasText: "Step 1 of 5" })).toContainText("Contact");
  const current = await page.request.get(`/api/checkout/${checkout.reference}`); expect(current.status()).toBe(200);
  expect((await current.json()).checkout.version).toBe(checkout.version);
});
