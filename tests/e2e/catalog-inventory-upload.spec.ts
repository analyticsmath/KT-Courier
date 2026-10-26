import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { prisma } from "@/lib/db/prisma";
import { assertDisposablePaystackAcceptance } from "@/lib/testing/disposable-paystack-policy";
import { INVENTORY_UPLOAD_HEADER } from "@/lib/catalog/inventory-upload-policy";
import { login } from "./fixtures/auth";
for (const width of [1440, 390]) test(`native vendor CSV stock receipt with scoped preview and replay at ${width}px`, async ({ page }, info) => {
  assertDisposablePaystackAcceptance();
  expect(await prisma.$queryRaw`SELECT current_database() AS database, current_user AS role`).toEqual([{ database: "kt_phase75_e2e", role: "kt_phase75_e2e" }]);
  await page.setViewportSize({ width, height: 900 });
  const offer = await prisma.storeCatalogOffer.findUniqueOrThrow({ where: { publicReference: "CO-E2E64GB" }, include: { store: { include: { ownerUser: true } }, inventoryItem: { include: { levels: { include: { location: true } } } } } });
  const inventory = offer.inventoryItem!; const level = inventory.levels.find(item => item.location.status === "ACTIVE")!;
  const state = async () => ({ item: await prisma.catalogInventoryItem.findUniqueOrThrow({ where: { id: inventory.id } }), level: await prisma.catalogInventoryLevel.findUniqueOrThrow({ where: { id: level.id } }), movements: await prisma.catalogInventoryMovement.count({ where: { inventoryItemId: inventory.id } }) });
  const before = await state();
  const csv = `${INVENTORY_UPLOAD_HEADER}\n${inventory.publicReference},${level.location.publicReference},${before.item.version},2`;
  const endpoint = "/api/store/catalog/inventory/upload";
  const post = (data: object) => page.request.post(endpoint, { headers: { origin: process.env.E2E_BASE_URL! }, data });
  expect((await post({ csv, operationId: randomUUID(), dryRun: false })).status()).toBe(401); expect(await state()).toEqual(before);
  expect((await page.request.post(`/api/store/catalog/offers/${offer.publicReference}/resume`, { headers: { origin: process.env.E2E_BASE_URL! }, data: { version: offer.version, operationId: randomUUID() } })).status()).toBe(401);
  await login(page, "customer@ktcouriers.local"); expect((await post({ csv, operationId: randomUUID(), dryRun: false })).status()).toBe(403); expect(await state()).toEqual(before);
  await login(page, offer.store.ownerUser!.email); await page.goto("/store/catalog/inventory");
  await expect(page.getByRole("heading", { name: "Upload stock receipts", exact: true })).toBeVisible();
  await page.getByLabel("Inventory CSV file", { exact: true }).setInputFiles({ name: "invalid.csv", mimeType: "text/csv", buffer: Buffer.from(`${INVENTORY_UPLOAD_HEADER}\n${inventory.publicReference},${level.location.publicReference},1,-1`) });
  await expect(page.getByRole("alert").filter({ hasText: "positive whole-unit" })).toBeVisible(); expect(await state()).toEqual(before);
  if (width === 390) {
    await page.getByLabel("Product and stock location", { exact: true }).selectOption(inventory.publicReference);
    await page.getByLabel("Units received", { exact: true }).fill("2");
    await page.getByRole("button", { name: "Prepare stock receipt", exact: true }).click();
  } else {
    await page.getByLabel("Inventory CSV file", { exact: true }).setInputFiles({ name: "receipts.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  }
  const reviewed = page.waitForResponse(response => response.url().endsWith(endpoint));
  await page.getByRole("button", { name: "Review stock changes", exact: true }).focus(); await page.keyboard.press("Enter");
  expect((await reviewed).status()).toBe(200); await expect(page.getByRole("list", { name: "Reviewed stock changes" })).toContainText(`${before.level.onHand} + 2 = ${before.level.onHand + 2}`); expect(await state()).toEqual(before);
  const posted = page.waitForResponse(response => response.url().endsWith(endpoint)); await page.getByRole("button", { name: "Apply received stock", exact: true }).click();
  const result = await posted; expect(result.status(), await result.text()).toBe(201); const command = result.request().postDataJSON();
  const after = await state(); expect(after.level.onHand).toBe(before.level.onHand + 2); expect(after.level.available).toBe(before.level.available + 2); expect(after.level.reserved).toBe(before.level.reserved); expect(after.movements).toBe(before.movements + 1);
  expect((await post(command)).status()).toBe(201); expect(await state()).toEqual(after);
  expect((await post({ ...command, csv: csv.replace(/,2$/, ",3") })).status()).toBe(409); expect(await state()).toEqual(after);
  expect((await post({ ...command, operationId: randomUUID() })).status()).toBe(409); expect(await state()).toEqual(after);
  const denied = await post({ ...command, operationId: randomUUID(), csv: `${INVENTORY_UPLOAD_HEADER}\nforeign-inventory,foreign-location,1,2` }); expect(denied.status()).toBe(403); expect(await state()).toEqual(after);
  await expect(page.getByRole("status").filter({ hasText: "Stock receipt recorded for 1 items." })).toBeVisible();
  if (width === 390) {
    await page.goto(`/store/catalog/offers/${offer.publicReference}`);
    const paused = page.waitForResponse(r => r.url().endsWith(`/offers/${offer.publicReference}/pause`));
    await page.getByRole("button", { name: "Pause listing", exact: true }).click(); expect((await paused).status()).toBe(200);
    expect(await prisma.storeCatalogOffer.findUniqueOrThrow({ where: { id: offer.id } })).toMatchObject({ status: "PAUSED", publicationStatus: offer.publicationStatus });
    const resumed = page.waitForResponse(r => r.url().endsWith(`/offers/${offer.publicReference}/resume`));
    await page.getByRole("button", { name: "Resume listing", exact: true }).click(); expect((await resumed).status()).toBe(200);
    expect(await prisma.storeCatalogOffer.findUniqueOrThrow({ where: { id: offer.id } })).toMatchObject({ status: "ACTIVE", publicationStatus: offer.publicationStatus });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await info.attach(`inventory-upload-${width}`, { body: await page.screenshot({ fullPage: true, path: info.outputPath(`inventory-upload-${width}.png`) }), contentType: "image/png" });
});
