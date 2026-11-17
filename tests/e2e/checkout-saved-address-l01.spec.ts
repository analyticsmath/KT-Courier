import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { login } from "./fixtures/auth";
import { assertDisposablePaystackAcceptance } from "../../lib/testing/disposable-paystack-policy";

for (const width of [1440, 390, 320]) {
  test(`L-01 saved address unit vs suburb prefill, historic prompt, same-account /quote parity, /account/addresses fields, and foreign denial at ${width}px`, async ({ page, browser }) => {
    assertDisposablePaystackAcceptance();
    await page.setViewportSize({ width, height: width <= 390 ? 844 : 900 });
    await login(page, "customer@ktcouriers.local");

    const origin = process.env.E2E_BASE_URL!;
    // Create mapped default saved address with Unit 4B and independent Central suburb, plus historic unmapped address
    const mappedRes = await page.request.post("/api/account/addresses", {
      headers: { origin },
      data: {
        type: "CUSTOMER",
        label: `L01 Mapped ${width}`,
        isDefault: true,
        line1: "45 Commission St",
        line2: "Unit 4B",
        suburb: "Central",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "2001",
        country: "South Africa",
        formattedAddress: "45 Commission St, Central, Johannesburg, Gauteng, 2001, South Africa",
        placeId: "ChIJ-l01-mapped",
        latitude: -26.2041,
        longitude: 28.0473,
      },
    });
    expect(mappedRes.status(), await mappedRes.text()).toBe(201);
    const mappedId = (await mappedRes.json()).address.id as string;

    const legacyRes = await page.request.post("/api/account/addresses", {
      headers: { origin },
      data: {
        type: "DROPOFF",
        label: `L01 Historic ${width}`,
        isDefault: false,
        line1: "45 Commission St",
        line2: "Unit 4B",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "2001",
        country: "South Africa",
      },
    });
    expect(legacyRes.status(), await legacyRes.text()).toBe(201);
    const legacyId = (await legacyRes.json()).address.id as string;

    // Create checkout from seeded E2E cart offer
    const cartRes = await page.request.get("/api/cart");
    expect(cartRes.status()).toBe(200);
    const cart = (await cartRes.json()).cart;
    const lineRes = await page.request.post("/api/cart/lines", {
      headers: { origin },
      data: {
        offerReference: "CO-E2E64GB",
        variantReference: "CV-E2E64GB",
        quantity: 1,
        modifiers: [],
        operationId: randomUUID(),
        requestHash: randomUUID(),
        cartVersion: cart.version,
      },
    });
    expect(lineRes.status(), await lineRes.text()).toBe(201);
    const checkoutRes = await page.request.post("/api/checkout", {
      headers: { origin },
      data: { cartReference: (await lineRes.json()).cart.reference },
    });
    expect(checkoutRes.status(), await checkoutRes.text()).toBe(201);
    const reference = (await checkoutRes.json()).checkout.reference as string;

    // Foreign owner isolation
    const foreignCtx = await browser.newContext({ baseURL: origin });
    try {
      const foreignPage = await foreignCtx.newPage();
      expect((await foreignPage.request.get(`/api/checkout/${reference}`)).status()).toBe(401);
      expect((await foreignPage.request.get(`/api/account/addresses/${mappedId}`)).status()).toBe(401);
    } finally {
      await foreignCtx.close();
    }

    await page.goto(`/checkout?ref=${reference}`);
    await page.getByLabel("Phone Number (SA)", { exact: true }).fill("+27821112233");
    await page.getByRole("button", { name: /Continue to Delivery Address/ }).click();
    await expect(page.getByRole("heading", { name: "2. Delivery address", exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

    // Mapped default prefills Unit 4B and Central independently
    const dropdown = page.locator("#checkout-saved-address");
    await expect(page.locator("#addrLine2")).toHaveValue("Unit 4B");
    await expect(page.locator("#addrSuburb")).toHaveValue("Central");

    // Historic saved address lacking suburb/coords shows explicit confirmation prompt and never copies Unit 4B into suburb
    await dropdown.selectOption(legacyId);
    await expect(page.locator("#addrLine2")).toHaveValue("Unit 4B");
    await expect(page.locator("#addrSuburb")).toHaveValue("");
    await expect(page.getByRole("status").filter({ hasText: /confirm the suburb/i })).toBeVisible();

    // Switch back to mapped default via keyboard-compatible select & calculate delivery
    await dropdown.focus();
    await dropdown.selectOption(mappedId);
    await expect(page.locator("#addrSuburb")).toHaveValue("Central");
    await page.getByRole("button", { name: /Calculate Delivery/ }).click();
    await expect(page.getByRole("heading", { name: "3. Delivery options", exact: true })).toBeFocused();

    // Verify independent unit/suburb fields and zero horizontal overflow on /account/addresses
    await page.goto("/account/addresses");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.getByRole("button", { name: "Add address", exact: true }).click();
    await expect(page.locator("#address_line2")).toBeVisible();
    await expect(page.locator("#address_suburb")).toBeVisible();

    // Verify same customer saved address works consistently on /quote with zero horizontal overflow
    await page.goto("/quote");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.locator("#pickup-saved").selectOption(mappedId);
    await expect(page.locator("#pickup-line1")).toHaveValue("45 Commission St");
    await expect(page.locator("#pickup-suburb")).toHaveValue("Central");

    // Clean up saved addresses for repeatable runs
    await page.request.delete(`/api/account/addresses/${mappedId}`, { headers: { origin } });
    await page.request.delete(`/api/account/addresses/${legacyId}`, { headers: { origin } });
  });
}
