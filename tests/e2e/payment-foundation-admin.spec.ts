import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import { login, logout } from "./fixtures/auth";

const prisma = new PrismaClient();
const fixtureHash = createHash("sha256").update("phase10-e2e-fixture").digest("hex");

test.beforeAll(async () => {
  const [customer, baseOrder, permission] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "customer@ktcouriers.local" } }),
    prisma.order.findFirstOrThrow({ where: { customer: { email: "customer@ktcouriers.local" } }, orderBy: { createdAt: "asc" } }),
    prisma.permission.findUniqueOrThrow({ where: { key: "payments.read" } }),
  ]);
  const deniedAdmin = await prisma.user.upsert({
    where: { email: "e2e-payments-denied@ktcouriers.local" },
    update: { role: "ADMIN", status: "ACTIVE" },
    create: { email: "e2e-payments-denied@ktcouriers.local", passwordHash: await bcrypt.hash("ChangeMe123!", 10), name: "E2E payment denied", role: "ADMIN", status: "ACTIVE", emailVerifiedAt: new Date() },
  });
  await prisma.userPermission.upsert({
    where: { userId_permissionId: { userId: deniedAdmin.id, permissionId: permission.id } },
    update: { effect: "DENY", reason: "Phase 10 E2E fixture" },
    create: { userId: deniedAdmin.id, permissionId: permission.id, effect: "DENY", reason: "Phase 10 E2E fixture" },
  });

  for (let index = 0; index < 21; index += 1) {
    const suffix = String(index).padStart(2, "0");
    const order = await prisma.order.upsert({
      where: { orderNumber: `KT-PAY-E2E-${suffix}` },
      update: {},
      create: { orderNumber: `KT-PAY-E2E-${suffix}`, source: "CUSTOMER", status: "PENDING", deliveryType: baseOrder.deliveryType, currency: "ZAR", customerId: customer.id, priceEstimate: baseOrder.priceEstimate ?? "1.00" },
    });
    const payment = await prisma.payment.upsert({
      where: { creationIdempotencyKey: `phase10:e2e:payment:${suffix}` },
      update: {},
      create: {
        publicReference: `pay_e2e_phase10_${suffix}`, userId: customer.id, orderId: order.id, provider: index === 0 ? "PAYFAST" : null,
        purpose: "ORDER", status: index === 0 ? "REQUIRES_ACTION" : "CREATED", amount: order.priceEstimate ?? "1.00", currency: "ZAR",
        creationIdempotencyKey: `phase10:e2e:payment:${suffix}`, creationRequestHash: fixtureHash, version: index === 0 ? 2 : 0, latestAttemptNumber: index === 0 ? 1 : 0,
      },
    });
    if (await prisma.paymentStatusHistory.count({ where: { paymentId: payment.id } }) === 0) {
      await prisma.paymentStatusHistory.createMany({ data: index === 0 ? [
        { paymentId: payment.id, fromStatus: null, toStatus: "CREATED", reasonCode: "E2E_FIXTURE", actorType: "SYSTEM" },
        { paymentId: payment.id, fromStatus: "CREATED", toStatus: "PROVIDER_PENDING", reasonCode: "E2E_FIXTURE", actorType: "SYSTEM" },
        { paymentId: payment.id, fromStatus: "PROVIDER_PENDING", toStatus: "REQUIRES_ACTION", reasonCode: "E2E_FIXTURE", actorType: "PROVIDER" },
      ] : [{ paymentId: payment.id, fromStatus: null, toStatus: "CREATED", reasonCode: "E2E_FIXTURE", actorType: "SYSTEM" }] });
    }
    if (index === 0) {
      await prisma.paymentAttempt.upsert({
        where: { idempotencyKey: "phase10:e2e:attempt:00" },
        update: {},
        create: { paymentId: payment.id, publicReference: "pat_e2e_phase10_foundation_00", attemptNumber: 1, provider: "PAYFAST", idempotencyKey: "phase10:e2e:attempt:00", requestHash: fixtureHash, merchantReference: `kt:payment:${payment.publicReference}:attempt:1`, providerReference: "e2e-provider-reference", status: "REQUIRES_ACTION", amount: payment.amount, currency: "ZAR", redirectUrl: "https://checkout.example.test/e2e", providerEnvironment: "SANDBOX", providerProtocolVersion: "phase10-e2e", configurationFingerprint: "phase10-e2e:sandbox", providerCredentialVersion: "phase10-e2e-v1", providerStatusCode: "ACTION_REQUIRED", requestSnapshot: { fixture: true }, resultSnapshot: { status: "REQUIRES_ACTION" }, startedAt: new Date() },
      });
    }
  }
});

test.afterAll(async () => prisma.$disconnect());

test.describe.serial("read-only payment foundation admin", () => {
  test("authorized admin filters and paginates Payments with ZAR amounts", async ({ page }) => {
    await login(page, "superadmin@ktcouriers.local");
    await page.goto("/admin/payments");
    await expect(page.getByRole("heading", { name: "Payments", exact: true })).toBeVisible();
    await expect(page.getByRole("table", { name: "Payments" })).toBeVisible();
    await expect(page.getByText("ZAR", { exact: false }).first()).toBeVisible();
    await page.getByLabel("Payment provider", { exact: true }).selectOption("PAYFAST");
    await page.getByRole("button", { name: "Apply filters", exact: true }).click();
    await expect(page.getByRole("table", { name: "Payments" }).getByText("PAYFAST", { exact: true }).first()).toBeVisible();
    await page.goto("/admin/payments");
    await page.getByRole("link", { name: "Next page", exact: true }).click();
    await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
  });

  test("payment detail shows safe attempts and lifecycle history", async ({ page }) => {
    const payment = await prisma.payment.findFirstOrThrow({ where: { creationIdempotencyKey: "phase10:e2e:payment:00" } });
    await login(page, "superadmin@ktcouriers.local");
    await page.goto(`/admin/payments/${payment.id}`);
    await expect(page.getByRole("heading", { name: "Payment details", exact: true })).toBeVisible();
    await expect(page.getByRole("table", { name: "Payment attempts" })).toContainText("kt:payment:");
    await expect(page.getByRole("table", { name: "Payment attempts" })).toContainText("e2e-provider-reference");
    await expect(page.getByRole("table", { name: "Payment lifecycle history" })).toBeVisible();
  });

  test("Payment Providers shows PayFast known but inactive without credentials", async ({ page }) => {
    await login(page, "superadmin@ktcouriers.local");
    await page.goto("/admin/payment-providers");
    await expect(page.getByRole("heading", { name: "Payment Providers", exact: true })).toBeVisible();
    await expect(page.getByRole("table", { name: "Payment providers" })).toContainText("PAYFAST");
    await expect(page.getByRole("table", { name: "Payment providers" })).toContainText("Known, not configured");
  });

  test("explicit payments.read DENY and non-admin roles cannot access", async ({ page }) => {
    await login(page, "e2e-payments-denied@ktcouriers.local"); await page.goto("/admin/payments"); await expect(page).not.toHaveURL(/\/admin\/payments/); await logout(page);
    await login(page, "customer@ktcouriers.local"); await page.goto("/admin/payments"); await expect(page).not.toHaveURL(/\/admin\/payments/);
  });

  test("payment inspection exposes no mutation controls or visible secret material", async ({ page }) => {
    const payment = await prisma.payment.findFirstOrThrow({ where: { creationIdempotencyKey: "phase10:e2e:payment:00" } });
    await login(page, "superadmin@ktcouriers.local"); await page.goto(`/admin/payments/${payment.id}`);
    for (const label of ["Capture", "Retry", "Refund", "Cancel", "Mark success", "Edit amount", "Edit credentials"]) await expect(page.getByRole("button", { name: label, exact: true })).toHaveCount(0);
    const visibleText = (await page.locator("body").innerText()).toLowerCase();
    for (const forbidden of ["secret", "merchant key", "api token", "password", "authorization header", "request hash", "card detail", "bank detail"]) expect(visibleText).not.toContain(forbidden);
  });
});
