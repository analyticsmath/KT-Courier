import { randomUUID } from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { prepareRequiredDomainNotifications, reviewRequiredDomainNotification } from "@/lib/notifications/required-domain-configuration";
import { requiredDomainNotificationDefinitions } from "@/lib/notifications/required-domain-definitions";
import { appendRequiredDomainNotificationIntents } from "@/lib/notifications/required-domain-intake";
import { consumeCustomerOrderNotifications } from "@/lib/notifications/customer-order-publication";
vi.mock("@/lib/notifications/production-readiness", () => ({ assertNotificationProductionReady: () => {} }));

describe("durable required-domain notification intake on disposable PostgreSQL", () => {
  const prefix = `required-notification-${randomUUID()}`;
  const definition = requiredDomainNotificationDefinitions.find((entry) => entry.eventType === "PAYMENT_STATUS_CHANGED")!;
  let routeId = ""; let templateId = ""; let userId = ""; let orderId = ""; let paymentId = "";
  const review = (action: Parameters<typeof reviewRequiredDomainNotification>[2], actor = "reviewer") => prisma.$transaction((tx) => reviewRequiredDomainNotification(tx, definition.eventType, action, `${prefix}-${actor}`));
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent");
    if (process.env.NODE_ENV === "production" || process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS !== "1" || url.pathname !== "/kt_launch_test" || !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Disposable closure database required.");
    await prisma.$transaction(prepareRequiredDomainNotifications);
    routeId = (await prisma.notificationEventRoute.findUniqueOrThrow({ where: { key: definition.routeKey } })).id;
    templateId = (await prisma.notificationTemplate.findUniqueOrThrow({ where: { key: definition.templateKey } })).id;
  });
  beforeEach(async () => {
    await prisma.notificationEventRouteVersion.deleteMany({ where: { routeId } });
    await prisma.notificationTemplateVersion.updateMany({ where: { templateId }, data: { status: "UNDER_REVIEW", approvedByUserId: null, approvedAt: null, publishedAt: null } });
    await prisma.notificationRecipientPolicyVersion.updateMany({ where: { key: definition.recipientPolicyKey }, data: { status: "DRAFT", approvedByUserId: null, approvedAt: null } });
    const user = await prisma.user.create({ data: { email: `${randomUUID()}@example.test`, role: "CUSTOMER", status: "ACTIVE", emailVerifiedAt: new Date() } }); userId = user.id;
    const order = await prisma.order.create({ data: { orderNumber: `${prefix}-${randomUUID()}`, customerId: userId, source: "CUSTOMER", deliveryType: "SAME_DAY" } }); orderId = order.id;
    // A failed test payment carries no success or ledger evidence and no real money.
    const payment = await prisma.payment.create({ data: { publicReference: `pay_${randomUUID()}`, userId, orderId, status: "FAILED", amount: "123.45", creationIdempotencyKey: randomUUID(), creationRequestHash: "a".repeat(64) } }); paymentId = payment.id;
  });
  afterEach(async () => {
    const histories = await prisma.paymentStatusHistory.findMany({ where: { paymentId }, select: { id: true } });
    const operations = histories.map((history) => `payment-status-notification:${history.id}`);
    const receipts = await prisma.notificationSourceReceipt.findMany({ where: { OR: [{ sourceEventId: { in: operations } }, { sourceEventId: { startsWith: prefix } }] }, select: { id: true } });
    await prisma.notificationInboxItem.deleteMany({ where: { ownerUserId: userId } });
    await prisma.notificationDelivery.deleteMany({ where: { recipientUserId: userId } });
    await prisma.notificationRecipient.deleteMany({ where: { subjectUserId: userId } });
    await prisma.notificationMessage.deleteMany({ where: { recipientUserId: userId } });
    await prisma.notificationReconciliationCase.deleteMany({ where: { sourceReceiptId: { in: receipts.map((row) => row.id) } } });
    await prisma.notificationSourceReceipt.deleteMany({ where: { id: { in: receipts.map((row) => row.id) } } });
    await prisma.notificationEventIntent.deleteMany({ where: { OR: [{ operationId: { in: operations } }, { operationId: { startsWith: prefix } }] } });
    // Financial history is immutable, including in certification. Keep the
    // owned failed-payment fixtures until the disposable database is destroyed.
  });
  async function activate() {
    await review("APPROVE_RECIPIENT_POLICY"); await review("APPROVE_TEMPLATE"); await review("PUBLISH_TEMPLATE", "publisher");
    await review("PREPARE_ROUTE"); await review("APPROVE_ROUTE"); await review("ACTIVATE_ROUTE", "publisher");
  }
  const history = (createdAt?: Date) => prisma.paymentStatusHistory.create({ data: { paymentId, toStatus: "FAILED", reasonCode: "DISPOSABLE_PROVIDER_REJECTION", ...(createdAt ? { createdAt } : {}) } });
  it("prepares idempotent drafts for every required domain without approval or activation", async () => {
    await prisma.$transaction(prepareRequiredDomainNotifications);
    const keys = requiredDomainNotificationDefinitions.filter((entry) => entry.sourceAuthority !== "LEGACY_ORDER").map((entry) => entry.templateKey);
    expect(await prisma.notificationTemplate.count({ where: { key: { in: keys } } })).toBe(keys.length);
    expect(await prisma.notificationEventRouteVersion.count({ where: { routeId } })).toBe(0);
    await history(); expect(await prisma.$transaction((tx) => appendRequiredDomainNotificationIntents(tx, 50))).toBe(0);
  });
  it("preserves independent publishing and route activation actors", async () => {
    await review("APPROVE_RECIPIENT_POLICY"); await review("APPROVE_TEMPLATE");
    await expect(review("PUBLISH_TEMPLATE")).rejects.toMatchObject({ code: "TEMPLATE_APPROVAL_SEPARATION_REQUIRED" });
    await review("PUBLISH_TEMPLATE", "publisher"); await review("PREPARE_ROUTE"); await review("APPROVE_ROUTE");
    await expect(review("ACTIVATE_ROUTE")).rejects.toMatchObject({ code: "ROUTE_APPROVAL_SEPARATION_REQUIRED" });
    expect(await prisma.notificationEventRouteVersion.findFirst({ where: { routeId } })).toMatchObject({ status: "APPROVED" });
  });
  it("materializes post-activation canonical history once across concurrent consumers", async () => {
    await activate(); const source = await history();
    const results = await Promise.all([consumeCustomerOrderNotifications(50), consumeCustomerOrderNotifications(50)]);
    expect(results.reduce((sum, result) => sum + result.itemsCompleted, 0)).toBe(1);
    expect(results.reduce((sum, result) => sum + result.itemsRetried, 0)).toBe(0);
    expect(await prisma.notificationEventIntent.count({ where: { operationId: `payment-status-notification:${source.id}` } })).toBe(1);
    expect(await prisma.notificationInboxItem.count({ where: { ownerUserId: userId } })).toBe(1);
    expect(await prisma.notificationDelivery.findFirst({ where: { recipientUserId: userId, channel: "EMAIL" } })).toMatchObject({ status: "QUEUED" });
    expect(await prisma.notificationInboxItem.findFirst({ where: { ownerUserId: userId } })).toMatchObject({ body: expect.stringContaining("failed") });
    expect((await consumeCustomerOrderNotifications(50)).itemsExamined).toBe(0);
  });
  it("does not backfill history preceding the first approved route activation", async () => {
    const old = await history(new Date("2020-01-01")); await activate(); const fresh = await history();
    await consumeCustomerOrderNotifications(50);
    expect(await prisma.notificationEventIntent.findUnique({ where: { operationId: `payment-status-notification:${old.id}` } })).toBeNull();
    expect(await prisma.notificationEventIntent.findUnique({ where: { operationId: `payment-status-notification:${fresh.id}` } })).not.toBeNull();
  });
  it("reconciles missing canonical source evidence once without dispatch or perpetual retry", async () => {
    await activate();
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const operationId = `${prefix}-invalid-source`;
    await prisma.notificationEventIntent.create({ data: { sourceAuthority: "PAYMENT", eventType: definition.eventType, aggregateReference: payment.publicReference, operationId, safePayload: { sourceEventId: "absent-history", customerUserId: userId, email: "spoofed@example.test" } } });
    expect((await consumeCustomerOrderNotifications(50)).itemsReconciled).toBe(1);
    expect(await prisma.notificationSourceReceipt.findFirst({ where: { sourceEventId: operationId } })).toMatchObject({ status: "RECONCILIATION_REQUIRED" });
    expect(await prisma.notificationDelivery.count({ where: { recipientUserId: userId } })).toBe(0);
    expect((await consumeCustomerOrderNotifications(50)).itemsExamined).toBe(0);
  });
});
