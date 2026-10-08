import { test, expect } from "@playwright/test";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { login } from "./fixtures/auth";

function snapshot(email: string) {
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/phase3-media-control.ts", email], { encoding: "utf8", timeout: 30_000, env: process.env });
  if (result.status !== 0) throw new Error(`Profile receipt failed: ${result.stderr}`);
  const receipt = result.stdout.split(/\r?\n/).find(line => line.startsWith("PROFILE_MEDIA_SNAPSHOT "));
  if (!receipt) throw new Error("Missing actual profile media receipt.");
  return JSON.parse(receipt.slice("PROFILE_MEDIA_SNAPSHOT ".length)) as { avatarReference: string | null; role: string; objects: Array<{ publicReference: string; status: string; byteSize: number; detectedMimeType: string }> };
}

for (const role of ["customer", "store", "driver"] as const) for (const width of [1440, 390]) {
  test(`${role} owns upload, replacement and revoked removal at ${width}px`, async ({ page }, testInfo) => {
    if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the named disposable browser runner.");
    test.setTimeout(90_000);
    const email = `e2e-avatar-${role}-${width}@ktcouriers.local`, path = role === "customer" ? "/account/profile" : `/${role}/profile`;
    await page.setViewportSize({ width, height: 900 }); await login(page, email); await page.goto(path);
    const baseline = snapshot(email); expect(baseline.avatarReference).toBeNull(); expect(baseline.objects).toEqual([]);
    const picker = page.getByLabel("Profile image", { exact: true });
    await expect(picker).toBeVisible(); await expect(page.getByRole("button", { name: "Upload image", exact: true })).toBeDisabled();
    await picker.setInputFiles({ name: "invalid.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
    await expect(page.getByRole("status").filter({ hasText: "Choose a JPEG" })).toBeVisible(); expect(snapshot(email)).toEqual(baseline);
    const headers = { origin: new URL(page.url()).origin };
    const invalid = await page.request.post("/api/platform/avatar", { headers, multipart: { file: { name: "spoof.png", mimeType: "image/png", buffer: Buffer.from("invalid image data") } } });
    expect(invalid.status()).toBe(422); expect(snapshot(email)).toEqual(baseline);
    const references: string[] = [];
    for (const background of ["#204070", "#9c4420"]) {
      const png = await sharp({ create: { width: 32, height: 32, channels: 3, background } }).png().toBuffer();
      await picker.setInputFiles({ name: "synthetic-avatar.png", mimeType: "image/png", buffer: png });
      const upload = page.waitForResponse(r => r.url().endsWith("/api/platform/avatar") && r.request().method() === "POST");
      await page.getByRole("button", { name: "Upload image", exact: true }).focus(); await page.getByRole("button", { name: "Upload image", exact: true }).press("Enter");
      expect((await upload).status()).toBe(200);
      await expect(page.getByRole("status").filter({ hasText: "Profile image updated." })).toBeVisible();
      const current = snapshot(email); expect(current.avatarReference).toBeTruthy(); references.push(current.avatarReference!);
      expect(current.objects.filter(o => o.status === "READY")).toHaveLength(1);
      expect(current.objects.find(o => o.publicReference === current.avatarReference)?.detectedMimeType).toBe("image/webp");
      const served = await page.request.get("/api/platform/avatar"); expect(served.status()).toBe(200);
      expect(served.headers()["cache-control"]).toContain("no-store"); expect(served.headers()["x-content-type-options"]).toBe("nosniff");
      expect(await sharp(await served.body()).metadata()).toMatchObject({ width: 32, height: 32, format: "webp" });
      const replay = await page.request.post("/api/platform/avatar", { headers, multipart: { file: { name: "synthetic-avatar.png", mimeType: "image/png", buffer: png } } });
      expect(replay.status()).toBe(200); expect(snapshot(email)).toEqual(current);
    }
    expect(references[1]).not.toBe(references[0]);
    expect((await page.request.get(`/api/private-media/${references[0]}`)).status()).toBe(409);
    await page.reload(); await expect(page.getByRole("img", { name: "Your profile", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await testInfo.attach(`profile-${role}-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    await login(page, "e2e-checkout-other@ktcouriers.local");
    expect((await page.request.get(`/api/private-media/${references[1]}`)).status()).toBe(403); expect(snapshot(email).avatarReference).toBe(references[1]);
    await login(page, email); await page.goto(path);
    const removed = page.waitForResponse(r => r.url().endsWith("/api/platform/avatar") && r.request().method() === "DELETE");
    await page.getByRole("button", { name: "Remove image", exact: true }).click(); expect((await removed).status()).toBe(200);
    await expect(page.getByRole("status").filter({ hasText: "Profile image removed." })).toBeVisible();
    const final = snapshot(email); expect(final.avatarReference).toBeNull(); expect(final.objects).toHaveLength(2); expect(final.objects.every(o => o.status === "DELETED")).toBe(true);
    expect((await page.request.get("/api/platform/avatar")).status()).toBe(404); expect((await page.request.get(`/api/private-media/${references[1]}`)).status()).toBe(409);
    expect((await page.request.delete("/api/platform/avatar", { headers })).status()).toBe(200); expect(snapshot(email)).toEqual(final);
    await page.context().clearCookies(); expect((await page.request.get(`/api/private-media/${references[1]}`)).status()).toBe(401);
    expect((await page.request.delete("/api/platform/avatar", { headers })).status()).toBe(401); expect(snapshot(email)).toEqual(final);
  });
}
