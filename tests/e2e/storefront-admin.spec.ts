import { expect, test, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";

async function readRecord(page: Page, base: string, reference: string, key: string) {
  const response = await page.request.get(`${base}/${reference}`); expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  return (await response.json())[key];
}

async function activate(page: Page, base: string, record: { publicReference: string; version: number }, key: string) {
  const response = await page.request.post(`${base}/${record.publicReference}/activate`, { data: { version: record.version, operationId: crypto.randomUUID() } });
  expect(response.status()).toBe(200);
  expect((await response.json())[key]).toMatchObject({ status: "ACTIVE", version: record.version + 1 });
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`admin authors and reviews canonical collection and synonym controls at ${viewport.width}px`, async ({ page }) => {
    if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
    await page.setViewportSize(viewport);
    const name = `e2e-editorial-${viewport.width}-${crypto.randomUUID()}`;
    const collections = "/api/admin/storefront/collections";
    await login(page, "superadmin@ktcouriers.local");
    await page.goto("/admin/storefront/collections");
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByLabel("Slug", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Create draft", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Collection draft created." })).toBeVisible();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("");
    const list = await page.request.get(collections); expect(list.status()).toBe(200);
    const matching = (await list.json()).collections.filter((row: { name: string }) => row.name === name);
    expect(matching).toHaveLength(1);
    let collection = matching[0]; expect(collection).toMatchObject({ status: "DRAFT", version: 1 });
    const collectionLink = page.locator(`a.eo-table-link[href="/admin/storefront/collections/${collection.publicReference}"]`);
    await expect(collectionLink).toHaveCount(1);
    await collectionLink.click();
    await expect(page).toHaveURL(`/admin/storefront/collections/${collection.publicReference}`);
    await page.getByRole("combobox", { name: "Target type", exact: true }).selectOption("PRODUCT");
    await page.getByLabel("Public reference", { exact: true }).fill("CP-E2ESMARTPHONE");
    await page.getByRole("button", { name: "Add eligible item", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Collection evidence was added." })).toBeVisible();
    await expect(page.getByLabel("Public reference", { exact: true })).toHaveValue("");
    collection = await readRecord(page, collections, collection.publicReference, "collection");
    expect(collection.items).toHaveLength(1);
    expect(collection.items[0]).toMatchObject({ targetType: "PRODUCT", targetReference: "CP-E2ESMARTPHONE", removedAt: null });
    await page.getByRole("button", { name: "Submit for review", exact: true }).click();
    await expect(page.getByRole("button", { name: "Approve", exact: true })).toBeVisible();
    await login(page, "e2e-editorial-reviewer@ktcouriers.local");
    await page.goto(`/admin/storefront/collections/${collection.publicReference}`);
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByText("No lifecycle transition is currently eligible.", { exact: true })).toBeVisible();
    collection = await readRecord(page, collections, collection.publicReference, "collection");
    expect(collection.status).toBe("APPROVED");
    await activate(page, collections, collection, "collection");
    await page.reload(); await page.getByRole("button", { name: "Retire", exact: true }).click();
    await expect(page.getByText("No lifecycle transition is currently eligible.", { exact: true })).toBeVisible();
    collection = await readRecord(page, collections, collection.publicReference, "collection");
    expect(collection.status).toBe("RETIRED");
    expect(collection.history.map((row: { toStatus: string }) => row.toStatus)).toEqual(["DRAFT", "UNDER_REVIEW", "APPROVED", "ACTIVE", "RETIRED"]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

    const synonyms = "/api/admin/storefront/search-synonyms";
    await login(page, "superadmin@ktcouriers.local"); await page.goto("/admin/storefront/search-synonyms");
    await page.getByLabel("Set name", { exact: true }).fill(name);
    await page.getByLabel("Input term", { exact: true }).fill(`closurephone${viewport.width}`);
    await page.getByLabel("Output term", { exact: true }).fill("smartphone");
    await page.getByRole("button", { name: "Create synonym draft", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Synonym draft created." })).toBeVisible();
    await expect(page.getByLabel("Set name", { exact: true })).toHaveValue("");
    const synonymList = await page.request.get(synonyms); expect(synonymList.status()).toBe(200);
    const sets = (await synonymList.json()).synonymSets.filter((row: { name: string }) => row.name === name); expect(sets).toHaveLength(1);
    let synonym = sets[0]; expect(synonym).toMatchObject({ status: "DRAFT", terms: [{ input: `closurephone${viewport.width}`, outputs: ["smartphone"], direction: "EQUIVALENT" }] });
    await page.getByRole("link", { name: new RegExp(name) }).first().click();
    await page.getByRole("button", { name: "Submit for review", exact: true }).click();
    await expect(page.getByRole("button", { name: "Approve", exact: true })).toBeVisible();
    await login(page, "e2e-editorial-reviewer@ktcouriers.local"); await page.goto(`/admin/storefront/search-synonyms/${synonym.publicReference}`);
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByText("No lifecycle transition is currently eligible.", { exact: true })).toBeVisible();
    synonym = await readRecord(page, synonyms, synonym.publicReference, "synonymSet"); expect(synonym.status).toBe("APPROVED");
    await activate(page, synonyms, synonym, "synonymSet");
    await page.reload(); await page.getByRole("button", { name: "Retire", exact: true }).click();
    await expect(page.getByText("No lifecycle transition is currently eligible.", { exact: true })).toBeVisible();
    expect((await readRecord(page, synonyms, synonym.publicReference, "synonymSet")).status).toBe("RETIRED");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    // Activation uses the existing authenticated API; the UI currently offers review and retirement only.
  });
}

test("projection controls reject public overrides and unsupported manual rebuild without changing evidence", async ({ page }) => {
  if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
  await login(page, "superadmin@ktcouriers.local");
  const base = "/api/admin/storefront/projections"; const reference = "SPC-E2EEDITORIALCONTROL";
  const before = await readRecord(page, base, reference, "projectionCase");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto(`/admin/storefront/projections/${reference}`);
    await expect(page.getByRole("heading", { name: "Projection case", exact: true })).toBeVisible();
    const rebuildResponse = page.waitForResponse(response => response.url().endsWith(`${base}/${reference}/rebuild`) && response.request().method() === "POST");
    await page.getByRole("button", { name: "Request canonical rebuild", exact: true }).click();
    const refused = await rebuildResponse; expect(refused.status()).toBe(409);
    expect(await refused.json()).toMatchObject({ code: "CANONICAL_REBUILD_UNAVAILABLE" });
    await expect(page.getByRole("alert").filter({ hasText: "requires correction through its canonical source event" })).toBeVisible();
    expect(await readRecord(page, base, reference, "projectionCase")).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  }
  const override = await page.request.post(`${base}/${reference}/resolve`, { data: { version: before.version, operationId: crypto.randomUUID(), title: "Forged public override" } }); expect(override.status()).toBe(422);
  const resolve = await page.request.post(`${base}/${reference}/resolve`, { data: { version: before.version, operationId: crypto.randomUUID() } }); expect(resolve.status()).toBe(409);
  expect(await readRecord(page, base, reference, "projectionCase")).toEqual(before);
});

test("storefront admin APIs enforce role, anonymous and explicit DENY controls", async ({ page }) => {
  if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
  const bases = ["/api/admin/storefront/collections", "/api/admin/storefront/search-synonyms", "/api/admin/storefront/projections"];
  for (const email of ["customer@ktcouriers.local", "e2e-store@ktcouriers.local", "e2e-onboarding-1440@ktcouriers.local", "e2e-ledger-denied@ktcouriers.local"]) {
    await login(page, email);
    for (const base of bases) {
      const denied = await page.request.get(base); expect(denied.status()).toBe(403);
      expect(await denied.json()).not.toHaveProperty("collections");
    }
    for (const path of [`${bases[0]}/guessed-reference/approve`, `${bases[1]}/guessed-reference/activate`, `${bases[2]}/SPC-E2EEDITORIALCONTROL/resolve`]) expect((await page.request.post(path, { data: { version: 1, operationId: crypto.randomUUID() } })).status()).toBe(403);
  }
  await page.context().clearCookies();
  for (const base of bases) expect((await page.request.get(base)).status()).toBe(401);
});

