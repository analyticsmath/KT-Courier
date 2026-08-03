import { expect, test } from "@playwright/test";
import { login, logout } from "./fixtures/auth";

test.describe.serial("read-only admin ledger", () => {
  test("authorized admin inspects accounts, filters, journal balancing, and reversal links", async ({ page }) => {
    await login(page, "superadmin@ktcouriers.local");
    await page.goto("/admin/ledger");
    await expect(page.getByRole("heading", { name: "Ledger", exact: true })).toBeVisible();
    await expect(page.getByRole("table", { name: "Ledger accounts" })).toBeVisible();
    await expect(page.getByRole("table", { name: "Ledger journals" })).toBeVisible();

    await page.getByLabel("Account purpose", { exact: true }).selectOption("CASH_CLEARING");
    await page.getByRole("button", { name: "Filter accounts", exact: true }).click();
    const accountTable = page.getByRole("table", { name: "Ledger accounts" });
    await expect(accountTable.getByRole("link", { name: "PLATFORM-CASH-CLEARING-ZAR", exact: true })).toBeVisible();
    await accountTable.getByRole("link", { name: "PLATFORM-CASH-CLEARING-ZAR", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Ledger account", exact: true })).toBeVisible();
    await expect(page.getByRole("table", { name: "Account entries" })).toBeVisible();
    await expect(page.getByText("ZAR", { exact: false }).first()).toBeVisible();

    await page.goto("/admin/ledger");
    const journalTable = page.getByRole("table", { name: "Ledger journals" });
    await journalTable.getByRole("link").first().click();
    await expect(page.getByRole("heading", { name: "Ledger journal", exact: true })).toBeVisible();
    await expect(page.getByText("Balanced journal", { exact: true })).toBeVisible();
    await expect(page.getByRole("table", { name: "Journal entries" })).toBeVisible();
    await expect(page.getByText("Total debits", { exact: true })).toBeVisible();
    await expect(page.getByText("Total credits", { exact: true })).toBeVisible();

    const relationLink = page.locator('a[href^="/admin/ledger/journals/"]').filter({ hasText: /^LJ-/ }).first();
    if (await relationLink.isVisible()) {
      await relationLink.click();
      await expect(page.getByRole("heading", { name: "Ledger journal", exact: true })).toBeVisible();
    }
  });

  test("explicit ledger.read DENY and non-admin roles cannot access", async ({ page }) => {
    await login(page, "e2e-ledger-denied@ktcouriers.local");
    await page.goto("/admin/ledger");
    await expect(page).not.toHaveURL(/\/admin\/ledger/);
    await logout(page);

    await login(page, "customer@ktcouriers.local");
    await page.goto("/admin/ledger");
    await expect(page).not.toHaveURL(/\/admin\/ledger/);
  });

  test("ledger inspection has no mutation controls or visible secret material", async ({ page }) => {
    await login(page, "superadmin@ktcouriers.local");
    await page.goto("/admin/ledger");
    for (const name of ["Credit", "Debit", "Transfer", "Reverse", "Edit balance"]) {
      await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
    }
    const visibleText = (await page.locator("body").innerText()).toLowerCase();
    expect(visibleText).not.toContain("requesthash");
    expect(visibleText).not.toContain("password");
    expect(visibleText).not.toContain("authorization token");
    expect(visibleText).not.toContain("payment secret");
  });
});
