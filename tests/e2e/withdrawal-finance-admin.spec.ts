import { test, expect, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";

async function read(page: Page, path: string) {
  const response = await page.request.get(path); expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store"); return response.json();
}
function requireDisposableRunner() {
  if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
}
async function ownerRequest(page: Page, width: number) {
  await login(page, `e2e-withdrawal-finance-${width}@ktcouriers.local`);
  const destination = (await read(page, "/api/payout-destinations")).data[0];
  const response = await page.request.post("/api/withdrawals", {
    headers: { Origin: process.env.PLAYWRIGHT_BASE_URL! },
    data: { amount: "5.10", payoutDestinationPublicReference: destination.publicReference, operationId: crypto.randomUUID() },
  });
  expect(response.status()).toBe(201);
  const reference = (await response.json()).withdrawal.publicReference;
  await login(page, "superadmin@ktcouriers.local");
  const record = (await read(page, "/api/admin/withdrawals?pageSize=100")).data.find((row: { publicReference: string }) => row.publicReference === reference);
  expect(record).toBeTruthy(); return { record, destination };
}
async function action(page: Page, id: string, path: string, buttonName: string) {
  const responsePromise = page.waitForResponse(response => response.url().endsWith(`/api/admin/withdrawals/${id}/${path}`) && response.request().method() === "POST");
  const button = page.getByRole("button", { name: buttonName, exact: true });
  await button.focus(); await button.press("Enter"); expect((await responsePromise).status()).toBe(200);
  await expect(page.getByRole("status").filter({ hasText: "Action recorded." })).toBeVisible();
  await page.reload();
}
for (const width of [1440, 390]) {
  test(`finance reviews, rejects with released capacity and investigates an uncertain payout at ${width}px`, async ({ page }) => {
    requireDisposableRunner(); await page.setViewportSize({ width, height: 900 });
    const first = await ownerRequest(page, width);
    await page.goto("/admin/withdrawals");
    await expect(page.getByRole("heading", { name: "Withdrawals", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

    const recordLink = page.getByRole("link", { name: first.record.publicReference, exact: true });
    await recordLink.focus(); await recordLink.press("Enter");
    await expect(page).toHaveURL(`/admin/withdrawals/${first.record.id}`);
    const before = (await read(page, `/api/admin/withdrawals/${first.record.id}`)).withdrawal;
    expect(before).toMatchObject({ amount: "5.10", status: "REQUESTED", journals: { release: null, payout: null } });
    await page.route(`**/api/admin/withdrawals/${first.record.id}/review`, route => route.abort("failed"));
    await page.getByRole("button", { name: "Start review", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Action could not be sent. Check your connection and try again." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start review", exact: true })).toBeEnabled();
    expect((await read(page, `/api/admin/withdrawals/${first.record.id}`)).withdrawal).toEqual(before);

    await page.unroute(`**/api/admin/withdrawals/${first.record.id}/review`);
    await action(page, first.record.id, "review", "Start review");
    expect((await read(page, `/api/admin/withdrawals/${first.record.id}`)).withdrawal.status).toBe("UNDER_REVIEW");
    await action(page, first.record.id, "reject", "Reject and release");
    const rejected = (await read(page, `/api/admin/withdrawals/${first.record.id}`)).withdrawal;
    expect(rejected).toMatchObject({ status: "REJECTED", journals: { payout: null } }); expect(rejected.journals.release).toBeTruthy();
    expect(rejected.history.map((row: { reasonCode: string }) => row.reasonCode)).toContain("RESERVATION_RELEASED");
    await expect(page.getByRole("button", { name: /start review|approve|reject and release|start payout processing/i })).toHaveCount(0);

    const second = await ownerRequest(page, width);
    await page.goto(`/admin/withdrawals/${second.record.id}`);
    await action(page, second.record.id, "approve", "Approve");
    expect((await read(page, `/api/admin/withdrawals/${second.record.id}`)).withdrawal.status).toBe("APPROVED");
    // Commit the real canonical start, then lose the response. No external payout is invoked.
    const routePath = `**/api/admin/withdrawals/${second.record.id}/start-processing`;
    let operationId = ""; let attemptReference = "";
    await page.route(routePath, async route => {
      operationId = route.request().postDataJSON().operationId;
      const response = await route.fetch(); expect(response.status()).toBe(200);
      attemptReference = (await response.json()).payoutAttempt.publicReference; await route.abort("failed");
    });
    await page.getByRole("button", { name: "Start payout processing", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Action could not be sent." })).toBeVisible();
    await page.unroute(routePath);
    const retryPromise = page.waitForResponse(response => response.url().endsWith(`/api/admin/withdrawals/${second.record.id}/start-processing`) && response.request().method() === "POST");
    await page.getByRole("button", { name: "Start payout processing", exact: true }).click();
    const retry = await retryPromise; expect(retry.status()).toBe(200);
    expect(retry.request().postDataJSON().operationId).toBe(operationId);
    expect((await retry.json()).payoutAttempt.publicReference).toBe(attemptReference);
    await page.reload();
    const processing = (await read(page, `/api/admin/withdrawals/${second.record.id}`)).withdrawal;
    expect(processing.status).toBe("PROCESSING"); expect(processing.payoutAttempts).toHaveLength(1); expect(processing.journals.payout).toBeNull();
    await action(page, second.record.id, "payout-unknown", "Record unknown outcome");
    const uncertain = (await read(page, `/api/admin/withdrawals/${second.record.id}`)).withdrawal;
    expect(uncertain).toMatchObject({ status: "RECONCILIATION_REQUIRED", journals: { release: null, payout: null } });
    expect(uncertain.payoutAttempts[0].status).toBe("UNKNOWN"); expect(uncertain.reconciliation).toHaveLength(1);
    await expect(page.getByRole("button", { name: /record verified payout|start payout processing|reject and release/i })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

    await page.goto("/admin/withdrawal-reconciliation");
    const caseReference = uncertain.reconciliation[0].publicReference;
    const caseLink = page.getByRole("link", { name: caseReference, exact: true }); await caseLink.focus(); await caseLink.press("Enter");
    await expect(page.getByRole("heading", { name: "Withdrawal Reconciliation", exact: true })).toBeVisible();
    await expect(page.getByText("UNKNOWN_PAYOUT_OUTCOME", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /resolve|mark paid|close case/i })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

    await page.goto("/admin/payout-destinations");
    await page.getByRole("link", { name: second.destination.publicReference, exact: true }).click();
    const masked = (await read(page, `/api/admin/payout-destinations/${second.destination.publicReference}`)).payoutDestination;
    expect(masked).not.toHaveProperty("externalReference"); expect(masked).not.toHaveProperty("walletId");
    await expect(page.getByText(second.destination.maskedLabel, { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

  });
}

test("withdrawal finance reads and mutations deny wrong roles, explicit DENY and anonymous accounts", async ({ page }) => {
  requireDisposableRunner(); await login(page, "superadmin@ktcouriers.local");
  const record = (await read(page, "/api/admin/withdrawals")).data[0];
  const destination = (await read(page, "/api/admin/payout-destinations")).data[0].publicReference;
  const reconciliation = (await read(page, "/api/admin/withdrawal-reconciliation")).data[0].publicReference;
  const paths = ["/api/admin/withdrawals", `/api/admin/withdrawals/${record.id}`, "/api/admin/withdrawal-reconciliation", `/api/admin/withdrawal-reconciliation/${reconciliation}`, "/api/admin/payout-destinations", `/api/admin/payout-destinations/${destination}`];
  for (const email of ["customer@ktcouriers.local", "e2e-store@ktcouriers.local", "e2e-withdrawal-driver-1440@ktcouriers.local", "e2e-ledger-denied@ktcouriers.local"]) {
    await login(page, email);
    for (const path of paths) expect((await page.request.get(path)).status()).toBe(403);
    for (const path of ["review", "approve", "reject", "start-processing", "payout-failed", "payout-unknown", "complete-payout"]) expect((await page.request.post(`/api/admin/withdrawals/${record.id}/${path}`, { data: { operationId: crypto.randomUUID() } })).status()).toBe(403);
    expect((await page.request.post(`/api/admin/payout-destinations/${destination}/activate`, { data: { operationId: crypto.randomUUID() } })).status()).toBe(403);
  }
  await page.context().clearCookies(); for (const path of paths) expect((await page.request.get(path)).status()).toBe(401);
  expect((await page.request.post(`/api/admin/withdrawals/${record.id}/approve`, { data: {} })).status()).toBe(401);
});
