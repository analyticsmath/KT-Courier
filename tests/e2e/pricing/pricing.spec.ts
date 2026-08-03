import { expect, test } from "@playwright/test";
import { login } from "../fixtures/auth";

test("customer browser flow calculates an immutable quote, invalidates it, creates one order, and rejects reuse", async ({ page }) => {
  await login(page, "customer@ktcouriers.local");
  await page.goto("/account/request-delivery");
  await page.locator("label").filter({ hasText: "Same-day delivery" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator("#pickup_address_line1").fill("101 E2E Pickup Road");
  await page.locator("#pickup_address_city").fill("Johannesburg");
  await page.locator("#pickup_address_province").fill("Gauteng");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator("#recipient_name").fill("E2E Recipient");
  await page.locator("#recipient_phone").fill("+27110000000");
  await page.locator("#dropoff_address_line1").fill("202 E2E Dropoff Road");
  await page.locator("#dropoff_address_city").fill("Johannesburg");
  await page.locator("#dropoff_address_province").fill("Gauteng");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator("#parcel_description").fill("E2E parcel");
  const quoteResponse = page.waitForResponse((response) => response.url().includes("/api/pricing/quotes") && response.status() === 200);
  await page.getByRole("button", { name: "Continue" }).click();
  const quote = await (await quoteResponse).json() as { id: string; total: string; lineItems: Array<{ label: string }> };
  await expect(page.getByText("Estimated price")).toBeVisible();
  await expect(page.getByText("Quote expires", { exact: false })).toBeVisible();
  await expect(page.getByText(quote.lineItems[0]!.label, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Back" }).click();
  await page.locator("#dropoff_address_line1").fill("303 E2E Changed Dropoff Road");
  await page.getByRole("button", { name: "Continue" }).click();
  const refreshedQuoteResponse = page.waitForResponse((response) => response.url().includes("/api/pricing/quotes") && response.status() === 200);
  await page.getByRole("button", { name: "Continue" }).click();
  const refreshedQuote = await (await refreshedQuoteResponse).json() as { id: string };
  expect(refreshedQuote.id).not.toBe(quote.id);

  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByText("Delivery request submitted")).toBeVisible();
  const replay = await page.evaluate(async ({ quoteId }) => {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pricingQuoteId: quoteId, deliveryType: "SAME_DAY", pickupAddress: { line1: "101 E2E Pickup Road", city: "Johannesburg", province: "Gauteng", country: "South Africa", latitude: -26.2041, longitude: 28.0473 }, dropoffAddress: { line1: "303 E2E Changed Dropoff Road", city: "Johannesburg", province: "Gauteng", country: "South Africa", latitude: -26.1, longitude: 28.1 }, recipientName: "E2E Recipient", recipientPhone: "+27110000000", parcelCount: 1, parcelDescription: "E2E parcel" }),
    });
    return response.status;
  }, { quoteId: refreshedQuote.id });
  expect(replay).toBe(409);
});

test("store browser flow receives a server quote and creates an order from its saved pickup context", async ({ page }) => {
  await login(page, "e2e-store@ktcouriers.local");
  await page.goto("/store/new-delivery");
  await page.locator("label").filter({ hasText: "Same-day delivery" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Pickup details" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Dropoff details" })).toBeVisible();
  await page.locator("#recipient_name").fill("Store E2E Recipient");
  await page.locator("#recipient_phone").fill("+27110000001");
  await page.locator("#dropoff_address_line1").fill("404 Store E2E Dropoff Road");
  await page.locator("#dropoff_address_city").fill("Johannesburg");
  await page.locator("#dropoff_address_province").fill("Gauteng");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Parcel & schedule" })).toBeVisible();
  await page.locator("#parcel_description").fill("Store E2E parcel");
  const quotePromise = page.waitForResponse((response) => response.url().includes("/api/pricing/quotes") && response.status() === 200);
  await page.getByRole("button", { name: "Continue" }).click();
  await quotePromise;
  await expect(page.getByText("Estimated price")).toBeVisible();
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByText("Delivery request submitted")).toBeVisible();
});
