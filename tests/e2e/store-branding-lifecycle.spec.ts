import { expect, test } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { login } from "./fixtures/auth";
import { assertDisposablePaystackAcceptance } from "../../lib/testing/disposable-paystack-policy";
const execute = promisify(execFile);
async function receipt(email: string) {
  assertDisposablePaystackAcceptance();
  const { stdout } = await execute(process.execPath, ["--import", "tsx", "scripts/phase3-media-control.ts", email, "branding"], { env: process.env, timeout: 30_000, maxBuffer: 1_000_000 });
  const line = stdout.split(/\r?\n/).find(value => value.startsWith("STORE_BRANDING_SNAPSHOT "));
  if (!line) throw Error("Actual disposable branding receipt required.");
  return JSON.parse(line.slice("STORE_BRANDING_SNAPSHOT ".length)) as { assets: Array<{ publicReference: string; status: string; purpose: string; mimeType: string; width: number; height: number; privacyInspectionPassed: boolean }>; projection: { logoMediaReference: string | null; heroMediaReference: string | null } | null; history: Array<{ action: string; toStatus: string }> };
}
for (const width of [1440, 390]) test(`native store logo and cover replacement, replay and revocation at ${width}px`, async ({ page }, info) => {
  test.setTimeout(180_000);
  const email = `e2e-avatar-store-${width}@ktcouriers.local`;
  await page.setViewportSize({ width, height: 900 }); await login(page, email); await page.goto("/store/profile");
  const baseline = await receipt(email); expect(baseline.assets).toEqual([]);
  const headers = { origin: new URL(page.url()).origin };
  const references: string[] = [];
  for (const [purpose, label, projectionKey] of [["STORE_LOGO", "Store logo", "logoMediaReference"], ["STORE_HERO", "Store cover photo", "heroMediaReference"]] as const) {
    const picker = page.getByLabel(label, { exact: true }); await expect(picker).toBeVisible();
    const beforeInvalid = await receipt(email);
    await picker.setInputFiles({ name: "untrusted.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
    await expect(page.getByRole("alert").filter({ hasText: "Choose a JPEG" })).toBeVisible(); expect(await receipt(email)).toEqual(beforeInvalid);
    const spoofed = await page.request.post("/api/store/profile-media", { headers: { ...headers, "x-catalog-operation-id": crypto.randomUUID() }, multipart: { purpose, file: { name: "spoof.png", mimeType: "image/png", buffer: Buffer.from("not a raster") } } });
    expect(spoofed.status()).toBe(422); expect(await receipt(email)).toEqual(beforeInvalid);
    let prior: string | null = null;
    for (const background of ["#194276", "#6f2848"]) {
      const bytes = await sharp({ create: { width: 400, height: 400, channels: 3, background } }).png().toBuffer();
      const path = "**/api/store/profile-media";
      let operationId = "";
      await page.route(path, async route => {
        if (route.request().method() !== "POST") return route.continue();
        operationId = route.request().headers()["x-catalog-operation-id"];
        const response = await route.fetch(); expect(response.status()).toBe(201); await route.abort("failed");
      });
      await picker.setInputFiles({ name: "synthetic-store-image.png", mimeType: "image/png", buffer: bytes });
      await expect(page.getByRole("alert").filter({ hasText: "The upload could not be confirmed." })).toBeVisible();
      const committed = await receipt(email); const active = committed.assets.filter(asset => asset.purpose === purpose && asset.status === "READY");
      expect(active).toHaveLength(1); expect(active[0]).toMatchObject({ mimeType: "image/webp", width: 400, height: 400, privacyInspectionPassed: true });
      await page.unroute(path);
      const retry = page.waitForResponse(response => response.url().endsWith("/api/store/profile-media") && response.request().method() === "POST");
      await picker.setInputFiles({ name: "synthetic-store-image.png", mimeType: "image/png", buffer: bytes });
      const retried = await retry; expect(retried.status(), await retried.text()).toBe(201); expect(retried.request().headers()["x-catalog-operation-id"]).toBe(operationId);
      await expect(page.getByRole("status").filter({ hasText: "Your store image has been saved." })).toBeVisible();
      expect(await receipt(email)).toEqual(committed); expect(committed.projection?.[projectionKey]).toBe(active[0].publicReference);
      const served = await page.request.get(`/api/store/profile-media?reference=${active[0].publicReference}`); expect(served.status()).toBe(200); expect(served.headers()["cache-control"]).toContain("no-store");
      expect(await sharp(await served.body()).metadata()).toMatchObject({ format: "webp", width: 400, height: 400 });
      if (prior) { expect(committed.assets.find(asset => asset.publicReference === prior)?.status).toBe("ARCHIVED"); expect((await page.request.get(`/api/store/profile-media?reference=${prior}`)).status()).toBe(404); }
      prior = active[0].publicReference;
    }
    references.push(prior!);
  }
  await page.reload(); await expect(page.getByRole("img", { name: "Your store logo", exact: true })).toBeVisible(); await expect(page.getByRole("img", { name: "Your store cover photo", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await info.attach(`store-branding-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  const beforeDenied = await receipt(email);
  await login(page, "e2e-other-store@ktcouriers.local");
  for (const reference of references) { expect((await page.request.get(`/api/store/profile-media?reference=${reference}`)).status()).toBe(404); expect((await page.request.delete("/api/store/profile-media", { headers, data: { reference, operationId: crypto.randomUUID() } })).status()).toBe(404); }
  expect(await receipt(email)).toEqual(beforeDenied);
  await login(page, email); await page.goto("/store/profile");
  for (const name of ["Remove store logo", "Remove store cover photo"]) { const removed = page.waitForResponse(response => response.url().endsWith("/api/store/profile-media") && response.request().method() === "DELETE"); await page.getByRole("button", { name, exact: true }).click(); expect((await removed).status()).toBe(200); }
  const final = await receipt(email); expect(final.assets.every(asset => asset.status === "ARCHIVED")).toBe(true); expect(final.projection).toEqual({ logoMediaReference: null, heroMediaReference: null });
  expect(final.history.filter(row => row.action === "STORE_BRANDING_REPLACED")).toHaveLength(2);
  for (const reference of references) expect((await page.request.get(`/api/store/profile-media?reference=${reference}`)).status()).toBe(404);
  await page.context().clearCookies(); expect((await page.request.get(`/api/store/profile-media?reference=${references[0]}`)).status()).toBe(401);
  await info.attach("store-branding-postgres", { body: JSON.stringify({ baseline, beforeDenied, final }), contentType: "application/json" });
});
