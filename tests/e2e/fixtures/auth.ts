import { expect, type Page } from "@playwright/test";

const demoPassword = "ChangeMe123!";

export async function login(page: Page, email: string, options?: { preserveGuestCart: boolean }) {
  const guestCookies = options?.preserveGuestCart ? (await page.context().cookies()).filter(cookie => cookie.name === "kt_marketplace_cart") : [];
  await page.context().clearCookies();
  if (guestCookies.length) await page.context().addCookies(guestCookies);
  await page.goto("/login");
  const res = await page.evaluate(async ({ email, password }) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    return { status: response.status, data };
  }, { email, password: demoPassword });

  expect(res.status, `API Login failed for ${email}: ${JSON.stringify(res.data)}`).toBe(200);
  await page.goto(res.data.redirect ?? "/account");
}

export async function logout(page: Page) {
  await page.context().clearCookies();
}
