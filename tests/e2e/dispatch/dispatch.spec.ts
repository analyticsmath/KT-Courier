import { expect, test } from "@playwright/test";
import { login, logout } from "../fixtures/auth";

async function api(page: import("@playwright/test").Page, path: string, init?: { method?: string; body?: unknown }) {
  return page.evaluate(async ({ path, init }) => {
    const response = await fetch(path, {
      method: init?.method ?? "GET",
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  }, { path, init });
}

test.describe.configure({ mode: "serial" });

test("dispatch browser flow exposes candidates, handles duplicate/reassign/unassign, and lets the assigned driver accept", async ({ page }) => {
  await login(page, "superadmin@ktcouriers.local");
  await page.goto("/admin/dispatch");
  await expect(page.getByRole("heading", { name: "Dispatch Board" })).toBeVisible();
  await expect(page.getByText("E2E-DISPATCH-001")).toBeVisible();

  const board = await api(page, "/api/admin/dispatch");
  expect(board.status).toBe(200);
  const dispatch = board.body as { unassignedOrders: Array<{ id: string; orderNumber: string }>; eligibleDrivers: { recommended: Array<{ id: string; driverCode: string }>; available: Array<{ id: string; driverCode: string }>; regionMismatch: Array<{ id: string; driverCode: string }> } };
  const boardDrivers = [...dispatch.eligibleDrivers.recommended, ...dispatch.eligibleDrivers.available, ...dispatch.eligibleDrivers.regionMismatch];
  const driverA = boardDrivers.find((driver) => driver.driverCode === "E2E-DRV-A");
  const driverB = boardDrivers.find((driver) => driver.driverCode === "E2E-DRV-B");
  const firstOrder = dispatch.unassignedOrders.find((order) => order.orderNumber === "E2E-DISPATCH-001");
  const secondOrder = dispatch.unassignedOrders.find((order) => order.orderNumber === "E2E-DISPATCH-002");
  expect(driverA && driverB && firstOrder && secondOrder).toBeTruthy();

  const offered = await api(page, `/api/admin/orders/${firstOrder!.id}/assign`, { method: "POST", body: { driverProfileId: driverA!.id, reasonCode: "INITIAL_ASSIGNMENT" } });
  expect(offered.status).toBe(200);
  const duplicate = await api(page, `/api/admin/orders/${firstOrder!.id}/assign`, { method: "POST", body: { driverProfileId: driverA!.id, reasonCode: "INITIAL_ASSIGNMENT" } });
  expect(duplicate.status).toBe(200);
  expect(duplicate.body.assignmentId).toBe(offered.body.assignmentId);
  const reassigned = await api(page, `/api/admin/orders/${firstOrder!.id}/reassign`, { method: "POST", body: { currentAssignmentId: offered.body.assignmentId, expectedVersion: offered.body.version, newDriverProfileId: driverB!.id, reasonCode: "E2E_REASSIGN" } });
  expect(reassigned.status).toBe(200);
  const unassigned = await api(page, `/api/admin/orders/${firstOrder!.id}/unassign`, { method: "POST", body: { assignmentId: reassigned.body.assignmentId, expectedVersion: reassigned.body.version, reasonCode: "E2E_UNASSIGN" } });
  expect(unassigned.status).toBe(200);

  const driverOffer = await api(page, `/api/admin/orders/${secondOrder!.id}/assign`, { method: "POST", body: { driverProfileId: driverA!.id, reasonCode: "INITIAL_ASSIGNMENT" } });
  expect(driverOffer.status).toBe(200);
  await logout(page);
  await login(page, "e2e-driver-a@ktcouriers.local");
  await page.goto("/driver/assignments");
  await expect(page.getByText("E2E-DISPATCH-002")).toBeVisible();
  const assignments = await api(page, "/api/driver/assignments");
  const assignment = (assignments.body as Array<{ id: string; orderNumber: string; version: number }>).find((item) => item.orderNumber === "E2E-DISPATCH-002");
  expect(assignment).toBeTruthy();
  const accepted = await api(page, `/api/driver/assignments/${assignment!.id}/accept`, { method: "POST", body: { expectedVersion: assignment!.version } });
  expect(accepted.status).toBe(200);
  const retry = await api(page, `/api/driver/assignments/${assignment!.id}/accept`, { method: "POST", body: { expectedVersion: assignment!.version } });
  expect(retry.status).toBe(200);
});
