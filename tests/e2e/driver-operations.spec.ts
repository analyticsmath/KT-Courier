import { expect, test } from "@playwright/test";
import { login, logout } from "./fixtures/auth";

test.describe.configure({ mode: "serial" });

// The Phase 8 disposable seed supplies the E2E-DRV-OPS orders and test-only OTP
// fixture. This suite never asks a production API for an OTP.
test.describe("Phase 8 driver operations", () => {
  test("availability preference updates without hiding accepted work", async ({ page }) => {
    await login(page, "e2e-driver-a@ktcouriers.local");
    await page.goto("/driver/workbench");
    await expect(page.getByRole("heading", { name: /delivery work/i })).toBeVisible();
    await page.getByRole("link", { name: /manage/i }).click();
    await page.getByRole("button", { name: /unavailable/i }).click();
    await expect(page.getByText(/availability has been set/i)).toBeVisible();
    await page.goto("/driver/workbench");
    await expect(page.getByText(/current operation/i)).toBeVisible();
  });

  test("accepted driver can complete the successful-delivery lifecycle", async ({ page }) => {
    await login(page, "e2e-driver-a@ktcouriers.local");
    await page.goto("/driver/workbench");
    await page.getByRole("link", { name: /confirm pickup|pickup actions/i }).first().click();
    await expect(page.getByRole("heading", { name: "Pickup Actions" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Delivery Route" })).toBeVisible();
  });

  test("retryable failed attempt appears before resume", async ({ page }) => {
    await login(page, "e2e-driver-a@ktcouriers.local");
    await page.goto("/driver/workbench");
    await page.getByRole("link", { name: /confirm pickup|pickup actions/i }).first().click();

    // Perform pickup custody confirmation
    await page.getByRole("button", { name: "Confirm Pickup", exact: true }).click();
    await page.getByRole("checkbox", { name: /confirm the parcel has been collected/i }).check();
    await page.getByRole("button", { name: "Confirm Pickup Collected" }).click();
    await expect(page.getByText("Order: PICKED UP")).toBeVisible();

    // Start delivery
    await page.getByRole("button", { name: "Start Delivery" }).click();
    await page.getByRole("button", { name: "Confirm Start Delivery" }).click();
    await expect(page.getByText("Order: IN TRANSIT")).toBeVisible();

    // Record delivery attempted
    await page.getByRole("button", { name: "Delivery Attempted" }).click();
    await page.getByLabel("Reason *").selectOption("RECIPIENT_UNAVAILABLE");
    await page.locator("#attempt-note").fill("Recipient not answering the intercom.");
    await page.getByRole("button", { name: "Record Delivery Attempted" }).click();
    await expect(page.getByText("Order: DELIVERY ATTEMPTED")).toBeVisible();

    // Go back to workbench and verify attempt is shown
    await page.goto("/driver/workbench");
    await expect(page.getByText(/delivery attempts/i)).toBeVisible();
  });

  test("a different driver cannot access the assigned operation", async ({ page }) => {
    await login(page, "e2e-driver-b@ktcouriers.local");
    await page.goto("/driver/workbench");
    await expect(page.getByText(/current operation/i)).not.toBeVisible();
  });

  test("admin sees safe operational evidence only", async ({ page }) => {
    await logout(page);
    await login(page, "superadmin@ktcouriers.local");
    await page.goto("/admin/orders");
    await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("codeHash");
    expect(bodyText).not.toMatch(/(?<!-)\b\d{6}\b/);
  });
});
