import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { randomBytes, randomUUID } from "node:crypto";
import { login } from "./fixtures/auth";

async function documents(page: Page) {
  const response = await page.request.get("/api/driver/documents"); expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store"); return response.json();
}
for (const width of [1440, 390]) {
  test(`driver uploads private licence evidence, replaces it and rejects foreign access at ${width}px`, async ({ page }) => {
    if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
    await page.setViewportSize({ width, height: 900 });
    await login(page, `e2e-documents-${width}@ktcouriers.local`);
    const prior = await documents(page);
    const uploadTag = randomUUID().slice(0, 8);
    const images = await Promise.all([0, 1].map(() => sharp(randomBytes(12), { raw: { width: 2, height: 2, channels: 3 } }).png().toBuffer()));
    await page.goto("/driver/onboarding");
    await page.getByRole("button", { name: /^2\. Driver Licence & Identity Documents/ }).click();
    const form = page.getByRole("form", { name: "Driver document upload", exact: true });
    await form.getByLabel("Document Type *", { exact: true }).selectOption("LICENSE");
    await form.getByLabel("Expiry Date (if applicable)", { exact: true }).fill("2030-01-01");
    const upload = form.getByRole("button", { name: "Upload Document", exact: true });
    await expect(upload).toBeDisabled();
    for (const [index, png] of images.entries()) {
      await form.getByLabel("File (PDF, JPEG, PNG, WEBP, max 10MB) *", { exact: true }).setInputFiles({ name: `disposable-licence-${uploadTag}-${index}.png`, mimeType: "image/png", buffer: png });
      await expect(upload).toBeEnabled();
      const attached = page.waitForResponse(response => response.url().endsWith("/api/driver/documents") && response.request().method() === "POST");
      await upload.focus(); await upload.press("Enter"); expect((await attached).status()).toBe(201);
      await expect(page.getByText("Successfully uploaded and submitted LICENSE.", { exact: true })).toBeVisible();
      await expect(upload).toBeDisabled();
      if (index === 0) await form.getByLabel("Expiry Date (if applicable)", { exact: true }).fill("2030-01-01");
    }
    const saved = await documents(page); expect(saved).toHaveLength(prior.length + 2);
    const current = saved.filter((row: { status: string }) => row.status === "SUBMITTED"); expect(current).toHaveLength(1);
    const rejected = saved.filter((row: { status: string }) => row.status === "REJECTED");
    expect(rejected).toHaveLength(prior.length + 1);
    expect(rejected.every((row: { rejectionReason: string }) => row.rejectionReason === "SUPERSEDED_BY_NEW_UPLOAD")).toBe(true);
    // Re-uploading identical older bytes replays their existing rejected record;
    // it must neither revive that evidence nor claim a fresh submission.
    const oldPng = images[0];
    await form.getByLabel("Expiry Date (if applicable)", { exact: true }).fill("2030-01-01");
    await form.getByLabel("File (PDF, JPEG, PNG, WEBP, max 10MB) *", { exact: true }).setInputFiles({ name: `disposable-licence-${uploadTag}-0.png`, mimeType: "image/png", buffer: oldPng });
    await expect(upload).toBeEnabled();
    await upload.focus(); await upload.press("Enter");
    await expect(page.getByText("This evidence is already attached. Current document status: REJECTED.", { exact: true })).toBeVisible();
    expect(await documents(page)).toEqual(saved);
    const reference = current[0].privateMediaObject.publicReference;
    const media = await page.request.get(`/api/private-media/${reference}`); expect(media.status()).toBe(200);
    expect(media.headers()["cache-control"]).toContain("no-store"); expect(media.headers()["x-content-type-options"]).toBe("nosniff");
    expect(await sharp(await media.body()).metadata()).toMatchObject({ width: 2, height: 2, format: "png" });
    const headers = { Origin: new URL(process.env.PLAYWRIGHT_BASE_URL).origin };
    const command = { documentType: "LICENSE", privateMediaReference: reference, expiresAt: current[0].expiresAt };
    const replay = await page.request.post("/api/driver/documents", { headers, data: command }); expect(replay.status()).toBe(201);
    expect((await replay.json()).id).toBe(current[0].id); expect(await documents(page)).toEqual(saved);
    const profile = await page.request.get("/api/driver/profile"); expect(await profile.json()).toMatchObject({ status: "PENDING_REVIEW", availability: "OFFLINE", onboardingStatus: "PROFILE_INCOMPLETE" });
    await page.reload(); await page.getByRole("button", { name: /^2\. Driver Licence & Identity Documents/ }).click();
    await expect(page.getByText(`disposable-licence-${uploadTag}-1.png`, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

    await login(page, `e2e-onboarding-${width}@ktcouriers.local`);
    expect((await page.request.get(`/api/private-media/${reference}`)).status()).toBe(403);
    const denied = await page.request.post("/api/driver/documents", { headers, data: command }); expect(denied.status()).toBe(422);
    expect(await documents(page)).toEqual([]);
    await login(page, `e2e-documents-${width}@ktcouriers.local`); expect(await documents(page)).toEqual(saved);
    for (const email of ["customer@ktcouriers.local", "e2e-store@ktcouriers.local"]) {
      await login(page, email);
      expect((await page.request.get("/api/driver/documents")).status()).toBe(403);
      expect((await page.request.post("/api/driver/documents", { headers, data: command })).status()).toBe(403);
      expect((await page.request.get(`/api/private-media/${reference}`)).status()).toBe(403);
    }
    await page.context().clearCookies(); expect((await page.request.get(`/api/private-media/${reference}`)).status()).toBe(401);
    expect((await page.request.get("/api/driver/documents")).status()).toBe(401);
  });
}
