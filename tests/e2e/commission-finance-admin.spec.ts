import { test, expect, type Page } from "@playwright/test";
import { login, logout } from "./fixtures/auth";
async function api(page: Page, path: string, method: string, body?: unknown) {
  return page.evaluate(async ({ path, method, body }) => {
    const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, body: await response.json() };
  }, { path, method, body });
}
test.describe("finance commission administration in the disposable browser", () => {
  test("authors a store-specific draft from an explicit rate without approving it", async ({ page }) => {
    await login(page, "superadmin@ktcouriers.local"); await page.goto("/admin/commission-plans");
    await page.getByLabel("Policy subject").selectOption("MARKETPLACE_STORE_ORDER");
    await page.getByLabel("Store", { exact: true }).selectOption({ label: "E2E Store" });
    const storeId = await page.getByLabel("Store", { exact: true }).inputValue();
    await expect(page.getByLabel("Basis", { exact: true })).toHaveValue("ORDER_SUBTOTAL");
    const rate = page.getByLabel("Rate (basis points; 100 equals 1%)", { exact: true });
    await expect(rate).toHaveValue("");
    await rate.fill("500");
    await page.getByLabel("Effective from", { exact: true }).fill("2026-10-01T09:00");
    await page.getByLabel("Calculation version", { exact: true }).fill("disposable-browser-authored-store");
    await page.getByRole("button", { name: "Create draft", exact: true }).click();
    await expect(page.getByRole("status")).toContainText(/Draft CP-[A-F0-9]+ created/);
    const listed = await api(page, "/api/admin/commission-plans", "GET"); expect(listed.status).toBe(200);
    const saved = listed.body.data.find((plan: { calculationVersion: string }) => plan.calculationVersion === "disposable-browser-authored-store");
    expect(saved).toMatchObject({ subjectType: "MARKETPLACE_STORE_ORDER", scopeKey: `STORE:${storeId}`, status: "DRAFT", approvedBy: null, basisType: "ORDER_SUBTOTAL" });
    expect(saved.rules).toEqual([expect.objectContaining({ beneficiaryType: "PLATFORM", rateBasisPoints: 500 })]);
  });
  test("persists a draft, rejects stale changes/self-approval, previews without accrual, and denies customer administration", async ({ page }) => {
    await login(page, "superadmin@ktcouriers.local"); await page.goto("/admin/commission-plans");
    await expect(page.getByRole("heading", { name: "Commission Plans", exact: true })).toBeVisible();
    const input = { subjectType: "COURIER_ORDER", scopeKey: "GLOBAL:COURIER_ORDER", basisType: "ORDER_SUBTOTAL", effectiveFrom: new Date().toISOString(), calculationVersion: "disposable-browser-proof", rules: [{ ruleCode: "DISPOSABLE_PLATFORM", allocationType: "PLATFORM_COMMISSION_REVENUE", beneficiaryType: "PLATFORM", calculationMethod: "FIXED_AMOUNT", fixedAmount: "1.00", priority: 1 }], operationId: crypto.randomUUID() };
    const created = await api(page, "/api/admin/commission-plans", "POST", input); expect(created.status).toBe(201);
    const id = created.body.plan.id; const root = `/api/admin/commission-plans/${id}`;
    const stale = await api(page, root, "PATCH", { ...input, expectedVersion: created.body.plan.version + 1 }); expect(stale.status).toBe(409);
    await page.goto(`/admin/commission-plans/${id}`);
    await expect(page.getByRole("heading", { name: "Edit draft rules" })).toBeVisible();
    await page.getByLabel("Calculation version", { exact: true }).fill("disposable-browser-edited");
    const saveResponse = page.waitForResponse(response => response.url().endsWith(root) && response.request().method() === "PATCH");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    const saved = await saveResponse;
    expect(saved.status(), await saved.text()).toBe(200);
    await expect.poll(async () => (await api(page, root, "GET")).body.plan.calculationVersion).toBe("disposable-browser-edited");
    const preview = await api(page, `${root}/preview`, "POST", { subtotal: "10.00", tax: "0.00", total: "10.00", operationId: crypto.randomUUID() }); expect(preview.status).toBe(200); expect(preview.body.authoritative).toBe(false);
    const submit = await api(page, `${root}/submit`, "POST", { operationId: crypto.randomUUID() }); expect(submit.status).toBe(200); expect(submit.body.plan.status).toBe("UNDER_REVIEW");
    const selfApproval = await api(page, `${root}/approve`, "POST", { operationId: crypto.randomUUID() }); expect(selfApproval.status).toBe(403);
    await page.goto(`/admin/commission-plans/${id}`); await expect(page.getByRole("heading", { name: "Lifecycle history" })).toBeVisible(); await expect(page.getByText("PLAN_UNDER_REVIEW", { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Edit draft rules" })).toHaveCount(0);
    // Separate-actor approval and activation are exercised by the disposable
    // PostgreSQL suite, whose execution remains a separate certification gate.
    await logout(page); await login(page, "customer@ktcouriers.local");
    expect((await api(page, root, "GET")).status).toBe(403);
    expect((await api(page, `${root}/activate`, "POST", { operationId: crypto.randomUUID() })).status).toBe(403);
  });
});
