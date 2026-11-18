import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { prisma } from "@/lib/db/prisma";
import { login } from "./fixtures/auth";
import { DeliveryType, OrderSource, OrderStatus } from "@/types/db";

const createdOrderIds: string[] = [];

test.afterAll(async () => {
  if (createdOrderIds.length > 0) {
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
  }
});

test("admin payment acceptance guard UI, 24h payment deadline display, alerts console, and processor backlog (SYS-03)", async ({
  page,
}) => {
  const seedCustomer = await prisma.user.findUniqueOrThrow({
    where: { email: "customer@ktcouriers.local" },
  });
  const dueAt = new Date(Date.now() + 24 * 3600_000);
  const unpaidOrder = await prisma.order.create({
    data: {
      orderNumber: `KT-E2E-GUARD-${randomUUID().slice(0, 8)}`,
      source: OrderSource.CUSTOMER,
      status: OrderStatus.PENDING,
      deliveryType: DeliveryType.PARCEL_DOCUMENT,
      currency: "ZAR",
      customerId: seedCustomer.id,
      priceEstimate: "150.00",
      paymentDueAt: dueAt,
    },
  });
  createdOrderIds.push(unpaidOrder.id);

  await login(page, "superadmin@ktcouriers.local");

  // 1. Unpaid order detail page shows acceptance blocked banner & disabled Confirmed button
  await page.goto(`/admin/orders/${unpaidOrder.id}`);
  await expect(page.getByTestId("payment-acceptance-blocked-banner")).toBeVisible();
  const confirmButton = page.getByRole("button", { name: /→ Confirmed/i });
  await expect(confirmButton).toBeDisabled();
  await expect(page.getByText(/Payment deadline/i)).toBeVisible();

  // Server-side API still rejects PATCH status=CONFIRMED even if crafted directly
  const apiRes = await page.evaluate(async (orderId) => {
    const r = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CONFIRMED", note: "E2E bypass check" }),
    });
    return { status: r.status, body: await r.json() };
  }, unpaidOrder.id);
  expect(apiRes.status).toBe(400);
  expect(apiRes.body.reasonCode).toBe("PAYMENT_PENDING");

  // 2. Customer view displays 24h payment deadline notice
  await login(page, "customer@ktcouriers.local");
  await page.goto(`/account/orders/${unpaidOrder.id}`);
  await expect(page.getByTestId("customer-payment-deadline")).toBeVisible();

  // 3. Admin Alerts Console & Processor Observability across 320px, 390px, 1440px
  await login(page, "superadmin@ktcouriers.local");
  for (const route of ["/admin/notifications/alerts", "/admin/processors"]) {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(route);
      await expect(page.locator("h1").first()).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 2,
      );
      expect(overflow, `Horizontal overflow at ${route} @ ${width}px`).toBe(false);
    }
  }
  await page.goto("/admin/processors");
  await expect(page.getByText(/expire-unpaid-courier-orders/i)).toBeVisible();
  await expect(page.getByText(/Payment, webhook & 24h expiry backlog/i)).toBeVisible();
});
