import { expect, test } from "@playwright/test";
import { login } from "./fixtures/auth";
import { assertDisposablePaystackAcceptance } from "../../lib/testing/disposable-paystack-policy";

for (const width of [1440, 390]) test(`native customer verification, owned addresses and password reset revocation at ${width}px`, async ({ page, browser }, info) => {
  test.setTimeout(180_000); assertDisposablePaystackAcceptance();
  await page.setViewportSize({ width, height: 900 });
  const email = `e2e-identity-${width}-${crypto.randomUUID().slice(0, 8)}@ktcouriers.local`;
  const password = "DisposableIdentity123!"; const newPassword = "DisposableChanged456!";
  await page.goto("/signup?type=customer");
  await page.getByLabel("Full name", { exact: true }).fill("Disposable identity customer");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password); await page.getByLabel("Confirm password", { exact: true }).fill(password);
  const signup = page.waitForResponse(r => r.url().endsWith("/api/auth/signup") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  const created = await signup; expect(created.status(), await created.text()).toBe(201);
  // Existing nonproduction response only; no delivery or destination ownership
  // is claimed. The deliberate receipt excludes fixture codes and reset keys.
  const code = (await created.json())._dev_otp as string; expect(code).toMatch(/^\d{6}$/);
  await expect(page).toHaveURL(/\/verify-otp/);
  const origin = new URL(page.url()).origin;
  expect((await page.request.post("/api/auth/verify-otp", { headers: { origin: "https://foreign.example.test" }, data: { email, code } })).status()).toBe(403);
  expect((await page.request.post("/api/auth/verify-otp", { headers: { origin }, data: { email, code: code === "999999" ? "888888" : "999999" } })).status()).toBe(400);
  await page.getByLabel("Verification code", { exact: true }).fill(code);
  const verification = page.waitForResponse(r => r.url().endsWith("/api/auth/verify-otp"));
  await page.getByRole("button", { name: "Verify code", exact: true }).click(); expect((await verification).status()).toBe(200);
  await expect(page).toHaveURL(/\/account/);
  expect((await page.request.post("/api/auth/verify-otp", { headers: { origin }, data: { email, code } })).status()).toBe(400);
  await page.goto("/account/addresses");
  if (!await page.getByLabel("Label", { exact: true }).isVisible()) await page.getByRole("button", { name: "Add address", exact: true }).first().click();
  await page.getByLabel("Label", { exact: true }).fill("Synthetic home");
  await page.getByLabel("Street address", { exact: true }).fill("45 Commission St");
  const addressCreated = page.waitForResponse(r => r.url().endsWith("/api/account/addresses") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Add address", exact: true }).click();
  const addressResponse = await addressCreated; expect(addressResponse.status(), await addressResponse.text()).toBe(201);
  const address = (await addressResponse.json()).address;
  await expect(page.getByText("Synthetic home", { exact: true })).toBeVisible();
  const owned = (await (await page.request.get(`/api/account/addresses/${address.id}`)).json()).address;
  expect(owned.line1).toBe("45 Commission St"); expect(owned).not.toHaveProperty("customerUserId");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await info.attach(`customer-address-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  const otherContext = await browser.newContext({ baseURL: origin }); const other = await otherContext.newPage();
  try {
    await login(other, "e2e-checkout-other@ktcouriers.local");
    expect((await other.request.get(`/api/account/addresses/${address.id}`)).status()).toBe(404);
    expect((await other.request.patch(`/api/account/addresses/${address.id}`, { headers: { origin }, data: { label: "Foreign replacement" } })).status()).toBe(404);
    expect((await other.request.delete(`/api/account/addresses/${address.id}`, { headers: { origin } })).status()).toBe(404);
    expect((await (await page.request.get(`/api/account/addresses/${address.id}`)).json()).address).toEqual(owned);
    await other.goto("/login");
    expect((await other.request.post("/api/auth/login", { headers: { origin }, data: { email, password } })).status()).toBe(200);
    await page.goto("/forgot-password"); await page.getByLabel("Email address", { exact: true }).fill(email);
    const forgot = page.waitForResponse(r => r.url().endsWith("/api/auth/forgot-password")); await page.getByRole("button", { name: "Send reset link", exact: true }).click();
    const forgotten = await forgot; expect(forgotten.status()).toBe(200); const token = (await forgotten.json())._dev_token as string; expect(token).toBeTruthy();
    await page.goto(`/reset-password?token=${token}`); await page.getByLabel("New password", { exact: true }).fill(newPassword); await page.getByLabel("Confirm new password", { exact: true }).fill(newPassword);
    const reset = page.waitForResponse(r => r.url().endsWith("/api/auth/reset-password")); await page.getByRole("button", { name: "Update password", exact: true }).click(); expect((await reset).status()).toBe(200);
    await expect(page).toHaveURL(/\/login\?reset=success/);
    expect((await other.request.get("/api/account/addresses")).status()).toBe(401); expect((await page.request.get("/api/account/addresses")).status()).toBe(401);
    expect((await page.request.post("/api/auth/reset-password", { headers: { origin }, data: { token, password: newPassword, confirmPassword: newPassword } })).status()).toBe(400);
    expect((await page.request.post("/api/auth/login", { headers: { origin }, data: { email, password } })).status()).toBe(401);
    await page.getByLabel("Email address", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill(newPassword);
    const signedIn = page.waitForResponse(r => r.url().endsWith("/api/auth/login")); await page.getByRole("button", { name: "Sign in", exact: true }).click(); expect((await signedIn).status()).toBe(200);
    await expect(page).toHaveURL(/\/account/); expect((await page.request.get(`/api/account/addresses/${address.id}`)).status()).toBe(200);
    await info.attach("identity-authority", { body: JSON.stringify({ evidenceClass: "NAMED_DISPOSABLE_NO_EXTERNAL_EMAIL", viewport: width, verificationCodeConsumed: true, foreignAddressDenied: true, oldSessionsRevoked: true, resetReplayDenied: true }), contentType: "application/json" });
  } finally { await otherContext.close(); }
});
