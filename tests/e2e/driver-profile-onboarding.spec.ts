import { expect, test, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";

async function profile(page: Page) {
  const response = await page.request.get("/api/driver/profile");
  expect(response.status()).toBe(200); return response.json();
}
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`driver contact editing and pending onboarding persist at ${viewport.width}px`, async ({ page }) => {
    if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
    await page.setViewportSize(viewport);
    await login(page, `e2e-onboarding-${viewport.width}@ktcouriers.local`);
    await page.goto("/driver/profile");
    await expect(page.getByRole("heading", { name: "Profile and vehicle", exact: true })).toBeVisible();
    const contact = page.getByRole("form", { name: "Personal contact details", exact: true });
    await contact.getByLabel("Display name", { exact: true }).fill(`Disposable driver ${viewport.width}`);
    await contact.getByLabel("Phone number", { exact: true }).fill("123");
    const before = await profile(page);
    const save = contact.getByRole("button", { name: "Save changes", exact: true });
    await save.focus(); await save.press("Enter");
    await expect(page.locator("#driver-profile-error")).toBeVisible();
    await expect(contact).toHaveAttribute("aria-describedby", "driver-profile-error");
    expect(await profile(page)).toEqual(before);
    await contact.getByLabel("Phone number", { exact: true }).fill("+27821112233");
    await save.focus(); await save.press("Enter");
    await expect(contact.getByRole("status")).toHaveText("Profile changes have been confirmed.");
    const updated = await profile(page);
    expect(updated.displayName).toBe(`Disposable driver ${viewport.width}`);
    expect(updated.user.name).toBe(updated.displayName); expect(updated.user.phone).toBe(updated.phone);
    expect(updated).not.toHaveProperty("internalNotes"); expect(updated.user).not.toHaveProperty("passwordHash");
    const forgedScope = await page.request.get("/api/driver/profile?userId=foreign-driver&driverProfileId=foreign-driver");
    expect(forgedScope.status()).toBe(200); expect(await forgedScope.json()).toEqual(updated);
    await page.reload();
    await expect(contact.getByLabel("Display name", { exact: true })).toHaveValue(updated.displayName);
    await page.goto("/driver/onboarding");
    const identity = page.getByRole("form", { name: "Driver identity and contact", exact: true });
    await expect(identity.getByLabel("Display / Legal Full Name *", { exact: true })).toHaveValue(updated.displayName);
    await identity.getByLabel("Identity Document Type *", { exact: true }).selectOption("PASSPORT");
    await identity.getByLabel("ID or Passport Number *", { exact: true }).fill("DISPOSABLE-PASSPORT");
    await identity.getByLabel("Date of Birth *", { exact: true }).fill("1990-01-01");
    await identity.getByLabel("Residential Address *", { exact: true }).fill("Synthetic test address");
    await identity.getByLabel("Driver Licence Number *", { exact: true }).fill("TEST-LICENCE");
    await identity.getByLabel("Licence Expiry Date *", { exact: true }).fill("2030-01-01");
    await identity.getByLabel("Emergency Contact Name *", { exact: true }).fill("Test contact");
    await identity.getByLabel("Emergency Contact Phone *", { exact: true }).fill("+27829998877");
    const submit = identity.getByRole("button", { name: "Save and Proceed to Documents →", exact: true });
    expect((await submit.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await submit.focus(); await expect(submit).toBeFocused();
    await submit.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Identity and contact details submitted successfully." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Step 2: Upload Driver Identity & Licence Documents", exact: true })).toBeVisible();
    await expect(page.getByText("Your profile is awaiting administrator review. Check the document and vehicle sections below for any outstanding requirements.", { exact: true })).toBeVisible();
    await expect(page.getByText("Your profile and documents have been submitted. An administrator will verify your credentials shortly.", { exact: true })).toHaveCount(0);
    const documents = await page.request.get("/api/driver/documents"); expect(documents.status()).toBe(200);
    expect(await documents.json()).toEqual([]);
    const submitted = await profile(page);
    expect(submitted).toMatchObject({ idType: "PASSPORT", idNumber: "DISPOSABLE-PASSPORT", onboardingStatus: "PENDING_REVIEW", status: "PENDING_REVIEW", availability: "OFFLINE" });
    expect(submitted).not.toHaveProperty("internalNotes"); expect(submitted.user).not.toHaveProperty("passwordHash");
    await page.reload();
    await expect(identity.getByLabel("ID or Passport Number *", { exact: true })).toHaveValue("DISPOSABLE-PASSPORT");
    await expect(page.getByText("Your profile is awaiting administrator review. Check the document and vehicle sections below for any outstanding requirements.", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    // No document approval, dispatch eligibility or actual device acceptance is claimed.
  });
}

test("non-drivers cannot read or mutate driver identity, including forged foreign IDs", async ({ page }) => {
  if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error("Run through the disposable E2E runner.");
  const headers = { Origin: new URL(process.env.PLAYWRIGHT_BASE_URL).origin };
  for (const email of ["customer@ktcouriers.local", "e2e-store@ktcouriers.local"]) {
    await login(page, email);
    for (const path of ["/api/driver/profile", "/api/driver/profile?userId=foreign-driver", "/api/driver/profile?driverProfileId=foreign-driver"]) {
      const response = await page.request.get(path); expect(response.status()).toBe(403);
      expect(await response.json()).not.toHaveProperty("idNumber");
    }
    const patch = await page.request.patch("/api/driver/profile", { headers, data: { displayName: "Forged update", userId: "foreign-driver" } }); expect(patch.status()).toBe(403);
    const onboarding = await page.request.post("/api/driver/onboarding", { headers, data: { userId: "foreign-driver" } }); expect(onboarding.status()).toBe(403);
  }
  await page.context().clearCookies();
  expect((await page.request.get("/api/driver/profile")).status()).toBe(401);
});
