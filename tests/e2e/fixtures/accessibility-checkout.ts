import { expect, type Page } from "@playwright/test";

export async function openAccessibleCheckout(page: Page) {
  const cartResponse = await page.request.get("/api/cart");
  expect(cartResponse.status()).toBe(200);
  const cart = (await cartResponse.json()).cart;
  const line = await page.request.post("/api/cart/lines", { data: { offerReference: "CO-E2E64GB", variantReference: "CV-E2E64GB", quantity: 1, modifiers: [], operationId: crypto.randomUUID(), requestHash: crypto.randomUUID(), cartVersion: cart.version } });
  expect(line.status(), await line.text()).toBe(201);
  const checkout = await page.request.post("/api/checkout", { data: { cartReference: (await line.json()).cart.reference } });
  expect(checkout.status(), await checkout.text()).toBe(201);
  const reference = (await checkout.json()).checkout.reference;
  await page.goto(`/checkout?ref=${reference}`);
  await expect(page.getByRole("heading", { name: "Your checkout.", exact: true })).toBeVisible();
}

export async function advanceAccessibleCheckoutToReview(page: Page) {
  await page.getByLabel("Recipient Full Name", { exact: true }).fill("Disposable Recipient");
  await page.getByLabel("Email Address", { exact: true }).fill("disposable-recipient@example.test");
  await page.getByLabel("Phone Number (SA)", { exact: true }).fill("+27110001111");
  await page.getByRole("button", { name: /Continue to Delivery Address/ }).click();
  await page.getByLabel("Street Address (Line 1)", { exact: true }).fill("45 Commission St");
  await page.getByLabel("Suburb / Area", { exact: true }).fill("Central");
  await page.getByLabel("City", { exact: true }).fill("Johannesburg");
  await page.getByLabel("Province", { exact: true }).selectOption("Gauteng");
  await page.getByLabel("Postal Code", { exact: true }).fill("2001");
  await page.getByRole("button", { name: /Calculate Delivery/ }).click();
  await page.getByRole("button", { name: "Review order →", exact: true }).click();
  await expect(page.getByRole("heading", { name: "4. Review your order", exact: true })).toBeVisible();
}
