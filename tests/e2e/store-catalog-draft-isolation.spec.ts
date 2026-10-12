import { expect, test, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";

const legacyKey = "kt_store_catalog_wizard_draft";
const scopedPrefix = `${legacyKey}:v2:`;
const legacyDraft = {
  existingSearch: "", productTypeDefinitionId: "", primaryCategoryId: "",
  title: "Unattributed legacy private title", description: "Unattributed legacy private description",
  attributes: "{}", variants: "Default", compliance: "{}", storeSku: "", price: "", stock: "0", modifiers: "",
};

async function openCoreInformation(page: Page) {
  await page.goto("/store/catalog/products/new");
  await expect(page.getByRole("heading", { name: "New product", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Core information/ }).click();
  await expect(page.getByLabel("Product title", { exact: true })).toBeVisible();
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`catalog drafts stay with their authenticated owner/store at ${viewport.width}px`, async ({ page }) => {
    if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
    await page.setViewportSize(viewport);
    await login(page, "e2e-store@ktcouriers.local");
    await page.evaluate(({ key, draft }) => localStorage.setItem(key, JSON.stringify(draft)), { key: legacyKey, draft: legacyDraft });
    await openCoreInformation(page);
    const title = page.getByLabel("Product title", { exact: true });
    const description = page.getByLabel("Description", { exact: true });
    await expect(title).toHaveValue(""); await expect(description).toHaveValue("");
    const ownerTitle = `First store private draft ${viewport.width}`;
    const ownerDescription = `First store private description ${viewport.width}`;
    await title.fill(ownerTitle); await description.fill(ownerDescription);
    await page.reload();
    await page.getByRole("button", { name: /Core information/ }).click();
    await expect(title).toHaveValue(ownerTitle); await expect(description).toHaveValue(ownerDescription);

    // Login clears cookies, retaining this browser's storage exactly as an account switch does.
    await login(page, "e2e-other-store@ktcouriers.local");
    await openCoreInformation(page);
    await expect(title).toHaveValue(""); await expect(description).toHaveValue("");
    const otherTitle = `Second store private draft ${viewport.width}`;
    await title.fill(otherTitle);
    await page.reload(); await page.getByRole("button", { name: /Core information/ }).click();
    await expect(title).toHaveValue(otherTitle); await expect(description).toHaveValue("");
    await login(page, "e2e-store@ktcouriers.local");
    await openCoreInformation(page);
    await expect(title).toHaveValue(ownerTitle); await expect(description).toHaveValue(ownerDescription);
    const stored = await page.evaluate((prefix) => Object.keys(localStorage).filter(key => key.startsWith(prefix)).map(key => ({ key, draft: JSON.parse(localStorage.getItem(key)!) })), scopedPrefix);
    expect(stored).toHaveLength(2);
    expect(stored.map(entry => entry.draft.title).sort()).toEqual([ownerTitle, otherTitle].sort());
    for (const entry of stored) expect(entry.draft).not.toHaveProperty("media");
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), legacyKey)).toEqual(legacyDraft);

    // A second tab updates this owner's cached draft, while another owner's storage event is ignored.
    const secondTab = await page.context().newPage();
    try {
      await openCoreInformation(secondTab);
      await secondTab.getByLabel("Product title", { exact: true }).fill(`${ownerTitle} updated`);
      await expect(title).toHaveValue(`${ownerTitle} updated`);
      const otherKey = stored.find(entry => entry.draft.title === otherTitle)!.key;
      await secondTab.evaluate(({ key, draft }) => localStorage.setItem(key, JSON.stringify(draft)), { key: otherKey, draft: legacyDraft });
      await expect(title).toHaveValue(`${ownerTitle} updated`);
      await secondTab.evaluate(() => localStorage.clear());
      await expect(title).toHaveValue(""); await expect(description).toHaveValue("");
    } finally {
      await secondTab.close();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    // These assertions exercise local draft privacy, not product submission or financial activation.
  });
}
