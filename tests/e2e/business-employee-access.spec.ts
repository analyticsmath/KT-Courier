import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { login } from "./fixtures/auth";

async function employees(page: Page) {
  const response = await page.request.get("/api/store/employees");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const body = await response.json();
  expect(JSON.stringify(body)).not.toContain("inviteTokenHash");
  return body.employees as { id: string; email: string; permissions: string[]; status: string }[];
}

for (const width of [1440, 390]) {
  test(`owner manages a products-only employee through invitation and access lifecycle at ${width}px`, async ({ page, browser }) => {
    test.setTimeout(90_000);
    const origin = process.env.PLAYWRIGHT_BASE_URL ?? "";
    if (!origin) throw new Error("Run through the disposable E2E runner.");
    const ownerEmail = `e2e-team-owner-${width}@ktcouriers.local`;
    const employeeEmail = `e2e-team-employee-${width}@ktcouriers.local`;
    await page.setViewportSize({ width, height: 900 });
    await login(page, ownerEmail);
    await page.goto("/store/employees");
    await expect(page.getByRole("heading", { name: "Employees", exact: true })).toBeVisible();
    await page.getByLabel("Email address", { exact: true }).fill(employeeEmail);
    await page.getByLabel("Role", { exact: true }).fill("Catalog assistant");
    await page.getByRole("checkbox", { name: "orders", exact: true }).uncheck();
    await page.getByRole("checkbox", { name: "deliveries", exact: true }).uncheck();
    await page.getByRole("checkbox", { name: "products", exact: true }).check();
    const invitationResponse = page.waitForResponse(r => r.url().endsWith("/api/store/employees") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Create invitation", exact: true }).click();
    expect((await invitationResponse).status()).toBe(201);
    const invitation = await page.locator("#invitation-link").inputValue();
    const invitationUrl = new URL(invitation);
    expect(invitationUrl.origin).toBe(origin);
    const token = invitationUrl.searchParams.get("token");
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const invited = (await employees(page)).find(row => row.email === employeeEmail)!;
    expect(invited).toMatchObject({ permissions: ["products"], status: "INVITED" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

    const context = await browser.newContext({ baseURL: origin, viewport: { width, height: 900 } });
    const employee = await context.newPage();
    try {
      await login(employee, "customer@ktcouriers.local");
      const mismatched = await employee.request.post("/api/business-invitations/accept", { headers: { Origin: origin }, data: { token } });
      expect(mismatched.status()).toBe(403);
      await login(employee, employeeEmail);
      expect((await employee.request.get("/api/store/catalog/products")).status()).toBe(403);
      await employee.goto(invitation);
      const acceptance = employee.waitForResponse(r => r.url().endsWith("/api/business-invitations/accept") && r.request().method() === "POST");
      await employee.getByRole("button", { name: "Accept business invitation", exact: true }).click();
      expect((await acceptance).status()).toBe(200);
      await expect(employee).toHaveURL(/\/store\/workspace$/);
      const accepted = (await employees(page)).find(row => row.id === invited.id)!;
      expect(accepted).toMatchObject({ status: "ACTIVE", permissions: ["products"] });
      expect((await employee.request.post("/api/business-invitations/accept", { headers: { Origin: origin }, data: { token } })).status()).toBe(403);
      expect((await employee.request.get("/api/store/employees")).status()).toBe(403);
      expect((await employee.request.get("/api/store/earnings")).status()).toBe(403);
      for (const path of ["/api/store/catalog/inventory", "/api/store/catalog/imports"]) expect((await employee.request.get(path)).status()).toBe(403);
      expect((await employee.request.post("/api/store/catalog/prices", { headers: { Origin: origin }, data: {} })).status()).toBe(403);
      for (const path of ["/store/catalog/inventory", "/store/catalog/imports"]) {
        await employee.goto(path);
        await expect(employee).toHaveURL(/\/store\/workspace$/);
      }
      await employee.goto("/store/catalog/products/new");
      await expect(employee.getByRole("heading", { name: "New product", exact: true })).toBeVisible();
      await employee.getByRole("button", { name: /Type and category/ }).click();
      const definition = await employee.getByLabel("Product type", { exact: true }).selectOption({ label: "Smartphone · v1" });
      const category = await employee.getByLabel("Category", { exact: true }).selectOption({ label: "Electronics · /electronics" });
      const title = "Disposable employee product " + randomUUID();
      const command = { operationId: randomUUID(), scope: "STORE_PRIVATE", productTypeDefinitionId: definition[0], primaryCategoryId: category[0], title, description: "Synthetic employee access validation only.", condition: "NEW", attributeValues: {}, complianceValues: {} };
      const created = await employee.request.post("/api/store/catalog/products", { headers: { Origin: origin }, data: command });
      expect(created.status()).toBe(201);
      const product = (await created.json()).product;
      expect(product).toMatchObject({ title, status: "DRAFT", publicationStatus: "DRAFT" });
      await employee.goto("/store/catalog/products");
      await expect(employee.getByRole("heading", { name: "Products", exact: true })).toBeVisible();
      await expect(employee.getByText(title, { exact: true })).toBeVisible();
      expect(await employee.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

      await employee.goto("/store/earnings");
      await expect(employee).toHaveURL(/\/store\/workspace$/);
      await expect(employee.getByRole("link", { name: "Earnings", exact: true })).toHaveCount(0);

      await page.reload();
      const row = page.getByRole("article").filter({ has: page.getByRole("heading", { name: employeeEmail, exact: true }) });
      async function setStatus(button: string, status: string) {
        const response = page.waitForResponse(r => r.url().endsWith("/api/store/employees") && r.request().method() === "PATCH");
        await row.getByRole("button", { name: button, exact: true }).click();
        expect((await response).status()).toBe(200);
        await expect.poll(async () => (await employees(page)).find(r => r.id === invited.id)?.status).toBe(status);
      }
      async function denied() {
        expect((await employee.request.get("/api/store/catalog/products")).status()).toBe(403);
        expect((await employee.request.get(`/api/store/catalog/products/${product.publicReference}`)).status()).toBe(403);
        expect((await employee.request.post("/api/store/catalog/products", { headers: { Origin: origin }, data: { ...command, operationId: randomUUID() } })).status()).toBe(403);
        await employee.goto("/store/catalog/products");
        await expect(employee).toHaveURL(/\/account$/);
        await expect(employee.getByText(title, { exact: true })).toHaveCount(0);
      }
      await setStatus("Disable", "DISABLED");
      await denied();
      await setStatus("Reactivate", "ACTIVE");
      expect((await employee.request.get(`/api/store/catalog/products/${product.publicReference}`)).status()).toBe(200);
      await employee.goto("/store/catalog/products");
      await expect(employee.getByText(title, { exact: true })).toBeVisible();
      const removal = page.waitForResponse(r => r.url().endsWith("/api/store/employees") && r.request().method() === "PATCH");
      await row.getByRole("button", { name: "Remove access", exact: true }).click();
      expect((await removal).status()).toBe(200);
      await expect(row).toHaveCount(0);
      await denied();
      expect((await employees(page)).find(r => r.id === invited.id)).toBeUndefined();
      expect((await page.request.get(`/api/store/catalog/products/${product.publicReference}`)).status()).toBe(200);
      await page.goto("/store/catalog/products");
      await expect(page.getByText(title, { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

      await login(employee, "e2e-other-store@ktcouriers.local");
      expect((await employee.request.get(`/api/store/catalog/products/${product.publicReference}`)).status()).toBe(404);
      expect((await employee.request.patch("/api/store/employees", { headers: { Origin: origin }, data: { id: invited.id, roleLabel: "Catalog assistant", permissions: ["products"], status: "ACTIVE" } })).status()).toBe(404);
      await context.clearCookies();
      expect((await employee.request.get("/api/store/catalog/products")).status()).toBe(401);
    } finally { await context.close(); }
  });
}
