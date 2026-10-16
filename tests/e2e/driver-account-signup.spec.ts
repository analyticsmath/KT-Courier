import { expect, test } from "@playwright/test";
import { randomInt, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { assertDisposablePaystackAcceptance } from "../../lib/testing/disposable-paystack-policy";

const execute = promisify(execFile);

async function verificationCode(email: string) {
  const { stdout } = await execute(
    process.execPath,
    ["--import", "tsx", "scripts/phase3-identity-control.ts", email, "verification"],
    { env: process.env, timeout: 30_000, maxBuffer: 64_000 },
  );
  const line = stdout.split(/\r?\n/).find((value) => value.startsWith("IDENTITY_TEST_INBOX "));
  if (!line) throw new Error("Owned disposable driver verification inbox evidence unavailable.");
  return (JSON.parse(line.slice("IDENTITY_TEST_INBOX ".length)) as { secret: string }).secret;
}

for (const width of [1440, 390]) {
  test(`driver can apply from the public network page and remains unapproved until review at ${width}px`, async ({ page }) => {
    test.setTimeout(90_000);
    assertDisposablePaystackAcceptance();
    await page.setViewportSize({ width, height: 900 });

    await page.goto("/join");
    await page.getByRole("tab", { name: "Driver & Courier Network" }).click();
    const driverSignup = page.getByRole("link", { name: "Create driver account", exact: true });
    await expect(driverSignup).toHaveAttribute("href", "/signup?role=driver");
    await driverSignup.click();
    await expect(page).toHaveURL(/\/signup\?role=driver$/);
    await expect(page.getByRole("button", { name: "Courier Driver" })).toHaveAttribute("aria-pressed", "true");

    const email = `e2e-driver-account-${width}-${randomUUID().slice(0, 8)}@ktcouriers.local`;
    await page.getByLabel("Full name", { exact: true }).fill("Disposable driver applicant");
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Phone number", { exact: true }).fill(`+2782${randomInt(0, 10_000_000).toString().padStart(7, "0")}`);
    const password = "DisposableDriver123!";
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password", { exact: true }).fill(password);

    const signupResponse = page.waitForResponse((response) => response.url().endsWith("/api/auth/signup") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    const created = await signupResponse;
    expect([201, 202], await created.text()).toContain(created.status());
    await expect(page).toHaveURL(/\/verify-otp/);

    const code = await verificationCode(email);
    await page.getByLabel("Verification code", { exact: true }).fill(code);
    const verificationResponse = page.waitForResponse((response) => response.url().endsWith("/api/auth/verify-otp"));
    await page.getByRole("button", { name: "Verify code", exact: true }).click();
    expect((await verificationResponse).status()).toBe(200);
    await expect(page).toHaveURL(/\/driver\/onboarding$/);
    await expect(page.getByRole("heading", { name: "Identity & Fleet Verification" })).toBeVisible();

    const profileResponse = await page.request.get("/api/driver/profile");
    expect(profileResponse.status()).toBe(200);
    expect(await profileResponse.json()).toMatchObject({
      status: "PENDING_REVIEW",
      availability: "OFFLINE",
      onboardingStatus: "PROFILE_INCOMPLETE",
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}
