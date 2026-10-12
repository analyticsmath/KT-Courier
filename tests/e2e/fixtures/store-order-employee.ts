import { expect, type Page } from "@playwright/test";
import { login } from "./auth";
import { storeAction, storeControl } from "./store-order";

/** Real invitation/membership HTTP authority over one canonically paid child. */
export async function proveStoreOrderEmployeeScope(page: Page, reference: string, width: number) {
  const origin = new URL(page.url()).origin;
  const email = `e2e-order-employee-${width}@ktcouriers.local`;
  const baseline = await storeControl(reference);
  const invite = await page.request.post("/api/store/employees", { headers: { origin }, data: { email, roleLabel: "Orders only", permissions: ["orders"] } });
  expect(invite.status(), await invite.text()).toBe(201);
  const path = (await invite.json()).invitationPath;
  const token = new URL(path, origin).searchParams.get("token");
  await login(page, email);
  expect((await page.request.post("/api/business-invitations/accept", { headers: { origin }, data: { token } })).status()).toBe(200);
  expect((await page.request.get("/api/store/orders")).status()).toBe(200);
  for (const path of ["/api/store/catalog/products", "/api/store/earnings", "/api/store/employees"]) expect((await page.request.get(path)).status()).toBe(403);
  await page.goto(`/store/marketplace-orders/${reference}`);
  await expect(page.getByRole("heading", { name: reference, exact: true })).toBeVisible();
  await storeControl(reference, "deny-employee-review");
  expect((await storeAction(page, reference, { action: "begin-review" })).status()).toBe(404);
  expect(await storeControl(reference)).toEqual(baseline);
  await storeControl(reference, "allow-employee-review");
  const body = { action: "begin-review", operationId: crypto.randomUUID() };
  const review = await storeAction(page, reference, body); expect(review.status(), await review.text()).toBe(200);
  const after = await storeControl(reference); expect(after.acceptanceStatus).toBe("REVIEWING"); expect(after.payment).toEqual(baseline.payment); expect(after.stock).toEqual(baseline.stock);
  await login(page, "e2e-store@ktcouriers.local");
  const membership = (await (await page.request.get("/api/store/employees")).json()).employees.find((row: { email: string }) => row.email === email);
  for (const status of ["DISABLED", "ACTIVE", "REMOVED"]) {
    expect((await page.request.patch("/api/store/employees", { headers: { origin }, data: { id: membership.id, roleLabel: "Orders only", permissions: ["orders"], status } })).status()).toBe(200);
    await login(page, email);
    const replay = await storeAction(page, reference, body);
    expect(replay.status()).toBe(status === "ACTIVE" ? 200 : 403);
    expect(await storeControl(reference)).toEqual(after);
    await login(page, "e2e-store@ktcouriers.local");
  }
}
