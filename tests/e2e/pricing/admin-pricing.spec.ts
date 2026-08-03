import { expect, test } from "@playwright/test";
import { login } from "../fixtures/auth";

async function pricingApi(page: import("@playwright/test").Page, path: string, init: { method: string; body?: unknown }) {
  return page.evaluate(async ({ path, init }) => {
    const response = await fetch(path, { method: init.method, headers: { "Content-Type": "application/json" }, body: init.body ? JSON.stringify(init.body) : undefined });
    return { status: response.status, body: await response.json() };
  }, { path, init });
}

test("pricing administrator browser flow manages a complete rule lifecycle", async ({ page }) => {
  await login(page, "superadmin@ktcouriers.local");
  await page.goto("/admin/pricing");
  await page.getByRole("button", { name: "+ New rule" }).click();
  await expect(page.getByText("Vehicle and parcel constraints")).toBeVisible();
  await expect(page.getByText("Applicability and lifecycle")).toBeVisible();

  const effectiveFrom = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const effectiveTo = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const body = { name: "E2E future pricing rule", type: "FLAT", deliveryType: "SAME_DAY", amount: 91, baseFee: 91, perKmRate: 0, includedDistanceKm: 0, distanceIncrementKm: 0.1, priority: 999, currency: "ZAR", effectiveFrom, effectiveTo, active: true, dimensionalPricingEnabled: false, allowGlobalFallback: true };
  const created = await pricingApi(page, "/api/admin/pricing/rules", { method: "POST", body });
  expect(created.status).toBe(201);
  const conflict = await pricingApi(page, "/api/admin/pricing/rules", { method: "POST", body: { ...body, name: "E2E conflicting pricing rule" } });
  expect(conflict.status).toBe(409);
  const updated = await pricingApi(page, `/api/admin/pricing/rules/${created.body.id}`, { method: "PATCH", body: { expectedRevision: created.body.revision, changeReason: "E2E future rate review", amount: 92, baseFee: 92 } });
  expect(updated.status).toBe(200);
  expect(updated.body.revision).toBe(created.body.revision + 1);
  const archived = await pricingApi(page, `/api/admin/pricing/rules/${created.body.id}`, { method: "DELETE", body: { expectedRevision: updated.body.revision, changeReason: "E2E archive verification" } });
  expect(archived.status).toBe(200);
});
