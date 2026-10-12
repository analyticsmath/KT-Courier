import { test, expect, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";

type Withdrawal = { publicReference: string; status: string; canCancel: boolean };
async function read(page: Page, path: string) {
  const response = await page.request.get(path);
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  return response.json();
}
function requireDisposableRunner() {
  if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
}

for (const owner of ["store", "driver"] as const) for (const width of [1440, 390]) {
  test(`${owner} owner reserves, retries a lost response, cancels and inspects masked destinations at ${width}px`, async ({ page }) => {
    requireDisposableRunner();
    await page.setViewportSize({ width, height: 900 });
    await login(page, `e2e-withdrawal-${owner}-${width}@ktcouriers.local`);
    const base = `/${owner}/withdrawals`;
    // Recover only this test owner's cancellable requests after an interrupted attempt.
    const prior: Withdrawal[] = (await read(page, "/api/withdrawals")).data;
    for (const row of prior.filter(row => row.canCancel)) {
      const cancelled = await page.request.post(`/api/withdrawals/${row.publicReference}/cancel`, {
        headers: { Origin: process.env.PLAYWRIGHT_BASE_URL! }, data: { operationId: crypto.randomUUID() },
      });
      expect(cancelled.status()).toBe(200);
    }
    const destinations = (await read(page, "/api/payout-destinations")).data;
    expect(destinations).toHaveLength(1);
    expect(destinations[0]).toMatchObject({ maskedLabel: "Disposable destination ****1234", accountLast4: "1234" });
    for (const key of ["id", "walletId", "ownerId", "externalReference"]) expect(destinations[0]).not.toHaveProperty(key);
    await page.goto(base);
    await expect(page.getByRole("heading", { name: "Withdrawals", exact: true })).toBeVisible();
    await expect(page.getByText(/ZAR 25\.40/).first()).toBeVisible();
    const form = page.getByRole("form", { name: "Request withdrawal" });
    await form.getByLabel("Amount (ZAR)").fill("5.10");
    await form.getByLabel("Payout destination", { exact: true }).selectOption(destinations[0].publicReference);
    let intercepted = 0; let operationId = ""; let committedReference = "";
    await page.route("**/api/withdrawals", async route => {
      if (route.request().method() !== "POST") { await route.continue(); return; }
      intercepted += 1; operationId = route.request().postDataJSON().operationId;
      const actual = await route.fetch(); expect(actual.status()).toBe(201);
      committedReference = (await actual.json()).withdrawal.publicReference;
      await route.abort("failed");
    });
    await form.evaluate(element => {
      const nativeForm = element as HTMLFormElement;
      nativeForm.requestSubmit(); nativeForm.requestSubmit();
    });
    await expect(form.getByRole("status")).toHaveText("Withdrawal request could not be submitted. Please try again.");
    expect(intercepted).toBe(1); expect(operationId).toBeTruthy(); expect(committedReference).toBeTruthy();
    await expect(form.getByLabel("Amount (ZAR)")).toHaveValue("5.10");
    await page.unroute("**/api/withdrawals");
    const retryResponse = page.waitForResponse(response => response.url().endsWith("/api/withdrawals") && response.request().method() === "POST");
    const submit = form.getByRole("button", { name: "Request withdrawal", exact: true });
    await submit.focus(); await submit.press("Enter");
    const retry = await retryResponse;
    expect(retry.status()).toBe(201);
    expect(retry.request().postDataJSON().operationId).toBe(operationId);
    expect((await retry.json()).withdrawal.publicReference).toBe(committedReference);
    await expect(form.getByRole("status")).toContainText(committedReference);
    const rows: Withdrawal[] = (await read(page, "/api/withdrawals")).data;
    expect(rows).toHaveLength(prior.length + 1);
    await page.reload();
    await expect(page.getByText(/ZAR 20\.30/).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

    const record = page.getByRole("link", { name: committedReference, exact: true });
    await record.focus(); await record.press("Enter");
    await expect(page).toHaveURL(`${base}/${committedReference}`);
    const detail = (await read(page, `/api/withdrawals/${committedReference}`)).withdrawal;
    expect(detail).toMatchObject({ amount: "5.10", status: "REQUESTED", canCancel: true });
    for (const key of ["id", "walletId", "ownerId", "requestedByUserId", "payoutId"]) expect(detail).not.toHaveProperty(key);
    const cancelledResponse = page.waitForResponse(response => response.url().endsWith(`/${committedReference}/cancel`) && response.request().method() === "POST");
    const cancel = page.getByRole("button", { name: "Cancel withdrawal", exact: true });
    await cancel.focus(); await cancel.press("Enter"); expect((await cancelledResponse).status()).toBe(200);
    await page.reload();
    expect((await read(page, `/api/withdrawals/${committedReference}`)).withdrawal).toMatchObject({ status: "CANCELLED", canCancel: false });
    await expect(page.getByRole("button", { name: "Cancel withdrawal", exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

    await page.getByRole("link", { name: "Back to withdrawals", exact: true }).click();
    await expect(page.getByText(/ZAR 25\.40/).first()).toBeVisible();
    await page.getByRole("link", { name: "Payout destinations", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Payout destinations", exact: true })).toBeVisible();
    await expect(page.getByText("Disposable destination ****1234", { exact: true })).toBeVisible();
    await expect(page.getByLabel(/bank account|external reference|credential/i)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

  });
}

test("withdrawal owner endpoints conceal foreign records and deny ineligible, unsupported and anonymous accounts", async ({ page }) => {
  requireDisposableRunner();
  await login(page, "e2e-withdrawal-store-1440@ktcouriers.local");
  const reference = (await read(page, "/api/withdrawals")).data[0].publicReference;
  await login(page, "e2e-withdrawal-driver-1440@ktcouriers.local");
  const foreign = await page.request.get(`/api/withdrawals/${reference}`);
  const absent = await page.request.get("/api/withdrawals/WD-00000000000000000000000000000000");
  expect(foreign.status()).toBe(404); expect(absent.status()).toBe(404);
  expect(await foreign.json()).toEqual(await absent.json());
  expect((await page.goto(`/driver/withdrawals/${reference}`))!.status()).toBe(404);
  await login(page, "e2e-onboarding-1440@ktcouriers.local");
  await page.goto("/driver/withdrawals");
  await expect(page.getByRole("heading", { name: "Withdrawals are unavailable", exact: true })).toBeVisible();
  await expect(page.getByRole("form", { name: "Request withdrawal" })).toHaveCount(0);
  const ineligible = await page.request.get("/api/payout-destinations");
  expect(ineligible.status()).toBe(422);
  expect(await ineligible.json()).toEqual({ error: "Withdrawal is unavailable for the selected amount or destination." });
  for (const email of ["customer@ktcouriers.local", "superadmin@ktcouriers.local"]) {
    await login(page, email);
    for (const path of ["/api/withdrawals", "/api/payout-destinations"]) expect((await page.request.get(path)).status()).toBe(403);
  }
  await login(page, "customer@ktcouriers.local"); await page.goto("/account/withdrawals");
  await expect(page.getByRole("heading", { name: "Owner withdrawal access required", exact: true })).toBeVisible();
  await expect(page.getByRole("form", { name: "Request withdrawal" })).toHaveCount(0);
  await page.context().clearCookies();
  for (const path of ["/api/withdrawals", "/api/payout-destinations", `/api/withdrawals/${reference}`]) expect((await page.request.get(path)).status()).toBe(401);
});
