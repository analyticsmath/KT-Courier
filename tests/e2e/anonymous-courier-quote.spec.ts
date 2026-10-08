import { expect, test } from "@playwright/test";
import { prisma } from "@/lib/db/prisma";
import { assertDisposablePaystackAcceptance } from "@/lib/testing/disposable-paystack-policy";
for (const width of [1440, 390]) test(`anonymous canonical courier quote, private ownership and signed-in booking at ${width}px`, async ({ page, browser }, info) => {
  assertDisposablePaystackAcceptance(); await page.context().clearCookies(); await page.setViewportSize({ width, height: 900 }); await page.goto("/quote");
  const pickup = page.getByRole("group", { name: "Collection address", exact: true }), dropoff = page.getByRole("group", { name: "Delivery address", exact: true });
  for (const [group, street] of [[pickup, "10 E2E Pickup Road"], [dropoff, "45 Commission St"]] as const) {
    await expect(group).toContainText("Map suggestions are unavailable"); await group.getByLabel("Street address", { exact: true }).fill(street); await group.getByLabel("City", { exact: true }).fill("Johannesburg"); await group.getByLabel("Postal code", { exact: true }).fill("2001"); await group.getByLabel("Province", { exact: true }).selectOption("Gauteng");
  }
  await page.getByLabel("Weight (kg)", { exact: true }).fill("1");
  await expect(page.getByRole("button", { name: "Calculate delivery price", exact: true })).toBeEnabled();
  const calculated = page.waitForResponse(response => response.url().endsWith("/api/public/delivery-quotes") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Calculate delivery price", exact: true }).focus(); await page.keyboard.press("Enter");
  const response = await calculated; expect(response.status(), await response.text()).toBe(201); const dto = await response.json();
  const before = await prisma.pricingQuote.findUniqueOrThrow({ where: { id: dto.id } });
  expect(before.calculationVersion).toBe("client-delivery-v1"); expect(before.status).toBe("ACTIVE"); expect(before.ownerId).toMatch(/^guest:[a-f0-9]{64}$/); expect(before.total.toFixed(2)).toBe(dto.total); expect(before.subtotal.add(before.taxAmount).equals(before.total)).toBe(true); expect(before.total.greaterThan(0)).toBe(true);
  expect(JSON.stringify(dto)).not.toContain(before.ownerId); expect(await prisma.order.count({ where: { pricingQuoteId: dto.id } })).toBe(0);
  await expect(page.getByRole("link", { name: "Sign in to book", exact: true })).toBeVisible();
  const ownedCookie = (await page.context().cookies()).find(cookie => cookie.name === "kt_public_quote")!; expect(ownedCookie.httpOnly).toBe(true); expect(ownedCookie.sameSite).toBe("Lax");
  const foreign = await browser.newContext({ baseURL: process.env.E2E_BASE_URL });
  try { const other = await foreign.newPage(); expect((await other.request.get(`/api/public/delivery-quotes/${dto.id}`)).status()).toBe(404); } finally { await foreign.close(); }
  const endpoint = `/api/public/delivery-quotes/${dto.id}/book`;
  expect((await page.request.post(endpoint, { headers: { origin: process.env.E2E_BASE_URL! }, data: {} })).status()).toBe(401); expect(await prisma.pricingQuote.findUnique({ where: { id: dto.id } })).toEqual(before);
  await info.attach(`anonymous-quote-${width}`, { body: await page.screenshot({ fullPage: true, path: info.outputPath(`anonymous-quote-${width}.png`) }), contentType: "image/png" });
  // Exercise the real sign-in return path: the role-switching test helper
  // clears cookies and would destroy this guest's private quote capability.
  await page.getByRole("link", { name: "Sign in to book", exact: true }).click();
  await page.getByLabel("Email address", { exact: true }).fill("customer@ktcouriers.local");
  await page.getByLabel("Password", { exact: true }).fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/quote\\?reference=${dto.id}$`));
  expect((await page.context().cookies()).find(cookie => cookie.name === "kt_public_quote")?.value).toBe(ownedCookie.value);
  const forbiddenCash = await page.request.post(endpoint, { headers: { origin: process.env.E2E_BASE_URL! }, data: { pickupContactName: "Disposable sender", pickupContactPhone: "+27820000000", recipientName: "Disposable recipient", recipientPhone: "+27820000001", paymentMethod: "DEPOSIT_PLUS_COD" } });
  expect(forbiddenCash.status(), await forbiddenCash.text()).toBe(422);
  expect(await forbiddenCash.json()).toMatchObject({ code: "PAYMENT_POLICY_NOT_CONFIGURED" });
  expect(await prisma.pricingQuote.findUnique({ where: { id: dto.id } })).toEqual(before);
  expect(await prisma.order.count({ where: { pricingQuoteId: dto.id } })).toBe(0);
  for (const [label, value] of [["Sender name", "Disposable sender"], ["Sender phone", "+27820000000"], ["Recipient name", "Disposable recipient"], ["Recipient phone", "+27820000001"]]) await page.getByLabel(label, { exact: true }).fill(value);
  const booked = page.waitForResponse(result => result.url().endsWith(endpoint)); await page.getByRole("button", { name: "Book this delivery", exact: true }).click();
  const created = await booked; expect(created.status(), await created.text()).toBe(201); const result = await created.json();
  const order = await prisma.order.findUniqueOrThrow({ where: { id: result.id } });
  expect(order.pricingQuoteId).toBe(dto.id); expect(order.status).toBe("PENDING"); expect(order.customerId).toBe((await prisma.user.findUniqueOrThrow({ where: { email: "customer@ktcouriers.local" } })).id);
  const consumed = await prisma.pricingQuote.findUniqueOrThrow({ where: { id: dto.id } }); expect(consumed.status).toBe("USED"); expect(consumed.total.equals(before.total)).toBe(true);
  expect(await prisma.order.count({ where: { pricingQuoteId: dto.id } })).toBe(1); expect(await prisma.payment.count({ where: { orderId: result.id, status: "SUCCEEDED" } })).toBe(0);
  const replay = await page.request.post(endpoint, { headers: { origin: process.env.E2E_BASE_URL! }, data: created.request().postDataJSON() }); expect(replay.status()).toBe(409); expect(await prisma.order.count({ where: { pricingQuoteId: dto.id } })).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
