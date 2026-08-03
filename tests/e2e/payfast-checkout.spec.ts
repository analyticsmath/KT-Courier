import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import { hashPassword } from "@/lib/auth/password";
import { login, logout } from "./fixtures/auth";

const prisma = new PrismaClient();
const customerEmail = "customer@ktcouriers.local";
let otherCustomerEmail = "";
let orderId = "";
let orderReference = "";
let expectedAmount = "";
let paymentReference = "";
let attemptReference = "";

test.beforeAll(async () => {
  const customer = await prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });
  const other = await prisma.user.findFirst({ where: { role: "CUSTOMER", status: "ACTIVE", id: { not: customer.id } }, orderBy: { createdAt: "asc" } });
  if (other) {
    await prisma.user.update({ where: { id: other.id }, data: { passwordHash: await hashPassword("Demo1234!") } });
    otherCustomerEmail = other.email;
  } else {
    otherCustomerEmail = customerEmail;
  }
  const order = await prisma.order.findFirstOrThrow({
    where: { customerId: customer.id, status: { in: ["PENDING", "CONFIRMED", "PICKUP_SCHEDULED"] }, pricingQuoteId: { not: null } },
    orderBy: { createdAt: "asc" },
  });
  orderId = order.id;
  orderReference = order.orderNumber;
  if (!order.priceEstimate) throw new Error("The seeded Payfast E2E order has no authoritative amount.");
  expectedAmount = order.priceEstimate.toFixed(2);
});
test.afterAll(async () => prisma.$disconnect());

test.describe.serial("Payfast sandbox checkout", () => {
  test("customer sees exact server amount and prepares payment without an amount input", async ({ page }) => {
    await login(page, customerEmail);
    await page.goto(`/orders/${encodeURIComponent(orderReference)}/payment`);
    await expect(page.getByRole("heading", { name: `Pay for ${orderReference}` })).toBeVisible();
    await expect(page.getByText(`ZAR ${expectedAmount}`, { exact: true })).toBeVisible();
    await expect(page.getByText("Payfast Sandbox — no real money will be transferred", { exact: true })).toBeVisible();
    await expect(page.locator('input[name="amount"]')).toHaveCount(0);
    await expect(page.locator("select")).toHaveCount(0);
  });

  test("checkout hands off one exact POST form without contacting real Payfast", async ({ page }) => {
    page.on("console", (msg) => console.log("PAGE_LOG:", msg.type(), msg.text()));
    page.on("response", async (res) => {
      console.log("RES:", res.status(), res.url());
      if (!res.ok()) {
        try { console.log("RES_BODY:", res.url(), res.status(), await res.text()); } catch {}
      }
    });
    await prisma.payment.updateMany({ where: { orderId }, data: { status: "CREATED", version: { increment: 1 } } });
    await prisma.paymentAttempt.updateMany({ where: { payment: { orderId } }, data: { status: "EXPIRED", version: { increment: 1 } } });
    await login(page, customerEmail);
    await page.route("https://sandbox.payfast.co.za/eng/process", async (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Isolated Payfast form capture</h1>" }));
    await page.goto(`/orders/${encodeURIComponent(orderReference)}/payment`);
    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url() === "https://sandbox.payfast.co.za/eng/process" && req.method() === "POST"),
      page.getByRole("button", { name: "Pay with Payfast", exact: true }).click(),
    ]);
    const fields = new URLSearchParams(request.postData() ?? "");
    for (const name of ["merchant_id", "merchant_key", "return_url", "cancel_url", "notify_url", "email_address", "m_payment_id", "amount", "item_name", "signature"]) expect(fields.get(name), name).toBeTruthy();
    expect(fields.get("passphrase")).toBeNull();
    expect(fields.get("subscription_type")).toBeNull();
    expect(fields.get("signature")).toMatch(/^[a-f0-9]{32}$/);
    expect(await page.getByRole("heading", { name: "Isolated Payfast form capture" }).textContent()).toBeTruthy();
    const payment = await prisma.payment.findUniqueOrThrow({ where: { orderId } });
    const attempt = await prisma.paymentAttempt.findFirstOrThrow({ where: { paymentId: payment.id }, orderBy: { attemptNumber: "desc" } });
    paymentReference = payment.publicReference;
    attemptReference = attempt.publicReference!;
    expect(fields.get("m_payment_id")).toBe(attempt.merchantReference);
    expect(fields.get("amount")).toBe(payment.amount.toFixed(2));
    expect(JSON.stringify({ request: attempt.requestSnapshot, result: attempt.resultSnapshot })).not.toContain(fields.get("signature"));
  });

  test("manual fallback exists on the authenticated internal checkout page", async ({ browser }) => {
    const authContext = await browser.newContext();
    const authPage = await authContext.newPage();
    await login(authPage, customerEmail);
    const cookies = await authContext.cookies();
    await authContext.close();
    const context = await browser.newContext({ javaScriptEnabled: false });
    await context.addCookies(cookies);
    const page = await context.newPage();
    await page.goto(`/payments/payfast/checkout/${encodeURIComponent(attemptReference)}`);
    await expect(page.locator('form[method="post"]')).toHaveAttribute("action", "https://sandbox.payfast.co.za/eng/process");
    await expect(page.getByRole("button", { name: "Continue to Payfast", exact: true })).toBeVisible();
    await context.close();
  });

  test("return navigation stays non-authoritative and leaves order/accounting unchanged", async ({ page }) => {
    const beforePayment = await prisma.payment.findUniqueOrThrow({ where: { publicReference: paymentReference } });
    const beforeOrder = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const beforeLedgerCount = await prisma.ledgerJournal.count();
    await login(page, customerEmail);
    await page.goto(`/payments/payfast/return?payment=${encodeURIComponent(paymentReference)}`);
    await expect(page.getByText("waiting for secure payment confirmation", { exact: false })).toBeVisible();
    await expect(page.getByText("Payment successful", { exact: true })).toHaveCount(0);
    const afterPayment = await prisma.payment.findUniqueOrThrow({ where: { publicReference: paymentReference } });
    const afterOrder = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(afterPayment.status).toBe(beforePayment.status);
    expect(afterPayment.version).toBe(beforePayment.version);
    expect(afterOrder.status).toBe(beforeOrder.status);
    expect(await prisma.ledgerJournal.count()).toBe(beforeLedgerCount);
  });

  test("cancel navigation does not cancel payment or order", async ({ page }) => {
    const before = await prisma.payment.findUniqueOrThrow({ where: { publicReference: paymentReference } });
    await login(page, customerEmail);
    await page.goto(`/payments/payfast/cancel?payment=${encodeURIComponent(paymentReference)}`);
    await expect(page.getByText("No final payment result has been confirmed yet", { exact: false })).toBeVisible();
    const after = await prisma.payment.findUniqueOrThrow({ where: { publicReference: paymentReference } });
    expect(after.status).toBe(before.status); expect(after.version).toBe(before.version);
  });

  test("wrong customer cannot access payment status or checkout", async ({ page }) => {
    test.skip(otherCustomerEmail === customerEmail, "A second seeded customer is required.");
    await login(page, otherCustomerEmail);
    await page.goto(`/payments/payfast/checkout/${encodeURIComponent(attemptReference)}`);
    await expect(page).toHaveURL(/\/not-found|\/404|\/payments\/payfast\/checkout/);
    await expect(page.getByRole("heading", { name: "Continue to Payfast" })).toHaveCount(0);
  });

  test("admin readiness shows sandbox form capability without credentials", async ({ page }) => {
    await logout(page); await login(page, "superadmin@ktcouriers.local"); await page.goto("/admin/payment-providers");
    await expect(page.getByRole("table", { name: "Payment providers" })).toContainText("Form POST checkout: Supported");
    await expect(page.getByRole("table", { name: "Payment providers" })).toContainText("sandbox");
    const visible = (await page.locator("body").innerText()).toLowerCase();
    for (const forbidden of ["integration-merchant-key", "integration-private-passphrase", "signature base", "request hash"]) expect(visible).not.toContain(forbidden);
  });
});

test("production activation remains locked in a production-configured deployment", async ({ page }) => {
  test.skip(process.env.PAYFAST_MODE !== "production", "Runs in the deferred production-lock E2E configuration.");
  await login(page, customerEmail); await page.goto(`/orders/${encodeURIComponent(orderReference)}/payment`);
  await expect(page.getByText("production checkout is unavailable", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pay with Payfast" })).toBeDisabled();
});
