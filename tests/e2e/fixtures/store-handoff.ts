import { expect, type Page } from "@playwright/test";
import { login } from "./auth";
import { storeControl, storeAction } from "./store-order";

/** Exercises actor-authenticated HTTP assignment + two-party custody from a
 * canonical paid store group. Eligibility inputs are synthetic; no GPS or POD
 * result is fabricated and this is not live physical acceptance. */
export async function completeSyntheticStoreHandoff(page: Page, reference: string, suffix: string) {
  const baseline = await storeControl(reference);
  const offered = await storeControl(reference, "offer-handoff");
  expect(offered.custody.assignment?.status).toBe("ASSIGNED");
  const assignment = offered.custody.assignment!;
  await login(page, `e2e-handoff-driver-${suffix}@ktcouriers.local`);
  const accepted = await page.request.post(`/api/driver/assignments/${assignment.id}/accept`, { data: { expectedVersion: assignment.version }, headers: { origin: new URL(page.url()).origin } });
  expect(accepted.status(), await accepted.text()).toBe(200);
  const generic = await page.request.post(`/api/driver/assignments/${assignment.id}/pickup/complete`, { data: { operationId: crypto.randomUUID(), assignmentVersion: (await storeControl(reference)).custody.assignment!.version, parcelCount: 1, parcelCondition: "NOT_RECORDED", confirmPickup: true }, headers: { origin: new URL(page.url()).origin } });
  expect(generic.status()).not.toBe(200);
  await login(page, "e2e-store@ktcouriers.local");
  await page.goto(`/store/marketplace-orders/${reference}`);
  const issued = page.waitForResponse(response => response.url().endsWith(`/api/store/orders/${reference}/actions`) && response.request().postDataJSON().action === "generate-pickup-code");
  await page.getByRole("button", { name: "Generate store pickup code", exact: true }).click();
  const response = await issued; expect(response.status(), await response.text()).toBe(200);
  const code = (await response.json()).result.pickupCode as string;
  expect(code).toMatch(/^\d{6}$/);
  await expect(page.getByRole("status").filter({ hasText: "Store pickup code:" })).toContainText(code);
  const body = { operationId: crypto.randomUUID(), pickupCode: code, packageCount: 1 };
  await login(page, "e2e-handoff-driver-foreign@ktcouriers.local");
  const foreign = await page.request.post(`/api/driver/store-order-handoffs/${reference}`, { data: body, headers: { origin: new URL(page.url()).origin } });
  expect(foreign.status()).toBe(422);
  const before = await storeControl(reference); expect(before.custody.courierStatus).toBe("PICKUP_SCHEDULED");
  await login(page, `e2e-handoff-driver-${suffix}@ktcouriers.local`);
  const wrongCount = await page.request.post(`/api/driver/store-order-handoffs/${reference}`, { data: { ...body, operationId: crypto.randomUUID(), packageCount: 2 }, headers: { origin: new URL(page.url()).origin } });
  expect(wrongCount.status()).toBe(422); expect(await storeControl(reference)).toEqual(before);
  await page.goto(`/driver/assignments/${assignment.id}`);
  await page.getByRole("link", { name: "Verify store pickup", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Store pickup", exact: true })).toBeVisible();
  await page.getByLabel("Store pickup code", { exact: true }).fill(code);
  await page.getByRole("checkbox", { name: "I checked and collected these packages from the store." }).check();
  const verified = page.waitForResponse(response => response.url().endsWith(`/api/driver/store-order-handoffs/${reference}`) && response.request().method() === "POST");
  await page.getByRole("button", { name: "Verify store pickup", exact: true }).click();
  const completed = await verified; expect(completed.status(), await completed.text()).toBe(200);
  await expect(page.locator("#pickup-feedback")).toContainText("Store handoff verified");
  const after = await storeControl(reference);
  expect(after.preparationStatus).toBe("HANDED_OFF"); expect(after.deliveryBridgeStatus).toBe("HANDED_OFF"); expect(after.custody.courierStatus).toBe("PICKED_UP");
  expect(after.payment).toEqual(baseline.payment); expect(after.stock).toEqual(baseline.stock);
  expect(after.history.filter(row => row.eventType === "STORE_PICKUP_HANDOFF_VERIFIED")).toHaveLength(1);
  const replayBody = completed.request().postDataJSON();
  const replay = await page.request.post(`/api/driver/store-order-handoffs/${reference}`, { data: replayBody, headers: { origin: new URL(page.url()).origin } });
  expect(replay.status()).toBe(200); expect((await replay.json()).result.replayed).toBe(true);
  expect(await storeControl(reference)).toEqual(after);
  await login(page, "e2e-handoff-driver-foreign@ktcouriers.local");
  expect((await page.request.post(`/api/driver/store-order-handoffs/${reference}`, { data: replayBody, headers: { origin: new URL(page.url()).origin } })).status()).toBe(422);
  expect(await storeControl(reference)).toEqual(after);
  // The store cannot repeat collection after custody has transferred.
  await login(page, "e2e-store@ktcouriers.local");
  expect((await storeAction(page, reference, { action: "generate-pickup-code" })).status()).toBe(422);
}
