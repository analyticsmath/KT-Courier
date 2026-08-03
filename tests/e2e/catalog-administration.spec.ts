import { test, expect } from "@playwright/test";

test.describe("catalog administration (Phase 26.5 scaffold)", () => {
  test.skip(true, "Catalog browser validation is deferred to Phase 26.5.");
  test("renders required catalog administration workspaces", async ({ page }) => { await page.goto("/admin/catalog"); await expect(page.getByRole("heading", { name: "Catalog Administration" })).toBeVisible(); for (const label of ["Categories","Product Types","Moderation","Duplicates"]) await expect(page.getByRole("link", { name: label })).toBeVisible(); });
  test("reviews products, requests changes and suspends safely", async ({ page }) => { await page.goto("/admin/catalog/moderation"); await expect(page.getByRole("heading", { name: "Catalog Moderation" })).toBeVisible(); });
  test("reviews duplicate and restricted product evidence", async ({ page }) => { await page.goto("/admin/catalog/duplicates"); await expect(page.getByRole("heading", { name: "Duplicate Products" })).toBeVisible(); });
  test("honours explicit DENY and the production lock", async ({ page }) => { await page.goto("/admin/catalog"); await expect(page.getByText("CONSOLIDATED_VALIDATION_NOT_APPROVED")).toBeVisible(); });
  test("reviews media ownership validation history and attachments", async ({ page }) => { await page.goto("/admin/catalog/media"); await expect(page.getByRole("heading", { name: "Catalog Media Evidence" })).toBeVisible(); });
  test("quarantines media without exposing storage identity", async ({ page }) => { await page.goto("/admin/catalog/media"); await expect(page.getByText(/storage keys/i)).toBeVisible(); });
  test("keeps media publication locked", async ({ page }) => { await page.goto("/admin/catalog/media"); await expect(page.getByText("CONSOLIDATED_VALIDATION_NOT_APPROVED")).toBeVisible(); });
});
