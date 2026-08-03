import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import { applyVerifiedPayfastItn } from "@/lib/services/payfast-itn-application.service";
import type { ResolvedPayfastItnAttempt } from "@/lib/services/payfast-itn-resolution.service";
import { verifiedEvent } from "../integration/payfast-itn-fixtures";
import { login } from "./fixtures/auth";

const prisma = new PrismaClient();
const customerEmail = "customer@ktcouriers.local";
let orderId = ""; let orderReference = ""; let paymentReference = ""; let attempt: ResolvedPayfastItnAttempt; let notification: ReturnType<typeof verifiedEvent>;
test.beforeAll(async () => { const customer = await prisma.user.findUniqueOrThrow({ where: { email: customerEmail } }); const order = await prisma.order.findFirstOrThrow({ where: { customerId: customer.id, pricingQuoteId: { not: null }, payments: { none: {} } }, orderBy: { createdAt: "asc" } }); orderId = order.id; orderReference = order.orderNumber; });
test.afterAll(async () => prisma.$disconnect());

test.describe.serial("Payfast confirmation customer", () => {
  test("return before ITN remains pending and does not change order state", async ({ page }) => {
    const orderBefore = await prisma.order.findUniqueOrThrow({ where: { id: orderId } }); await login(page, customerEmail); await page.route("https://sandbox.payfast.co.za/eng/process", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<p>Controlled local Payfast handoff fixture</p>" })); await page.goto(`/orders/${encodeURIComponent(orderReference)}/payment`); await page.getByRole("button", { name: "Pay with Payfast", exact: true }).click();
    const payment = await prisma.payment.findUniqueOrThrow({ where: { orderId } }); paymentReference = payment.publicReference; attempt = await prisma.paymentAttempt.findFirstOrThrow({ where: { paymentId: payment.id }, include: { payment: true }, orderBy: { attemptNumber: "desc" } }) as unknown as ResolvedPayfastItnAttempt;
    await page.goto(`/payments/payfast/return?payment=${encodeURIComponent(paymentReference)}`); await expect(page.getByText("waiting for secure payment confirmation", { exact: false })).toBeVisible(); expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).not.toBe("SUCCEEDED"); expect(await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).toEqual(orderBefore);
  });
  test("controlled verified notification fixture establishes success without order mutation", async ({ page }) => {
    const orderBefore = await prisma.order.findUniqueOrThrow({ where: { id: orderId } }); notification = verifiedEvent(attempt, "COMPLETE", { providerPaymentId: "pf-e2e-customer", fingerprintSeed: "e2e-customer-notification" }); await applyVerifiedPayfastItn(notification);
    await login(page, customerEmail); await page.goto(`/payments/payfast/return?payment=${encodeURIComponent(paymentReference)}`); await expect(page.getByText("Payment successful", { exact: false })).toBeVisible(); expect((await prisma.payment.findUniqueOrThrow({ where: { publicReference: paymentReference } })).status).toBe("SUCCEEDED"); expect(await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).toEqual(orderBefore);
  });
  test("duplicate fixture produces no second visible success or journal", async ({ page }) => {
    await applyVerifiedPayfastItn(notification); expect(await prisma.ledgerJournal.count({ where: { correlationId: paymentReference, type: "EXTERNAL_PAYMENT_RECEIPT" } })).toBe(1); await login(page, customerEmail); await page.goto(`/payments/payfast/return?payment=${encodeURIComponent(paymentReference)}`); await expect(page.getByText("Payment successful", { exact: false })).toHaveCount(1);
  });
});
