import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createNotificationAuthority } from "@/lib/notifications/authority";
import { prepareCustomerOrderNotifications, customerOrderNotificationDefinitions, customerOrderRecipientPolicyKey } from "@/lib/notifications/customer-order-configuration";
import { reviewCustomerOrderNotification } from "@/lib/notifications/customer-order-review";
import { consumeCustomerOrderNotifications, listPendingCustomerOrderIntents, publishCustomerOrderIntent } from "@/lib/notifications/customer-order-publication";
import { transitionOrderStatusInTx } from "@/lib/services/order-status.service";

// No provider calls in this suite. Only the disposable, explicitly named database.
vi.mock("@/lib/notifications/production-readiness", () => ({ assertNotificationProductionReady: () => {} }));
const enabled = process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS === "1" && new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent").pathname === "/kt_launch_test";
describe.skipIf(!enabled)("customer order notification publication on isolated PostgreSQL", () => {
  const prefix = `customer-notification-${randomUUID()}`;
  const users: string[] = []; const orders: string[] = [];
  let templateIds: string[] = []; let routeIds: string[] = [];
  const review = (eventType: string, action: Parameters<typeof reviewCustomerOrderNotification>[2], actor = "reviewer") => prisma.$transaction((tx) => reviewCustomerOrderNotification(tx, eventType, action, `${prefix}-${actor}`));
  async function activate() {
    await review("ORDER_CONFIRMED", "APPROVE_RECIPIENT_POLICY");
    for (const definition of customerOrderNotificationDefinitions) {
      await review(definition.eventType, "APPROVE_TEMPLATE");
      await review(definition.eventType, "PUBLISH_TEMPLATE", "publisher");
      await review(definition.eventType, "PREPARE_ROUTE");
      await review(definition.eventType, "APPROVE_ROUTE");
      await review(definition.eventType, "ACTIVATE_ROUTE", "publisher");
    }
  }
  async function event(options: { verified?: boolean; customer?: boolean; eventType?: string; sourceAuthority?: string; createdAt?: Date } = {}) {
    const user = await prisma.user.create({ data: { email: `${randomUUID()}@example.test`, role: "CUSTOMER", status: "ACTIVE", emailVerifiedAt: options.verified === false ? null : new Date() } });
    users.push(user.id);
    const order = await prisma.order.create({ data: { orderNumber: `${prefix}-${randomUUID()}`, customerId: options.customer === false ? null : user.id, source: "CUSTOMER", deliveryType: "SAME_DAY" } });
    orders.push(order.id);
    const intent = await prisma.notificationEventIntent.create({ data: { sourceAuthority: options.sourceAuthority ?? "LEGACY_ORDER", eventType: options.eventType ?? "ORDER_CONFIRMED", aggregateReference: order.id, operationId: `${prefix}-${randomUUID()}`, safePayload: { orderNumber: "spoofed", customerUserId: "spoofed-user", email: "spoofed@example.test", status: "IN_TRANSIT" }, ...(options.createdAt ? { createdAt: options.createdAt } : {}) } });
    return { user, order, intent };
  }
  beforeAll(async () => {
    await prisma.$transaction(prepareCustomerOrderNotifications);
    templateIds = (await prisma.notificationTemplate.findMany({ where: { key: { in: customerOrderNotificationDefinitions.map((d) => d.templateKey) } } })).map((r) => r.id);
    routeIds = (await prisma.notificationEventRoute.findMany({ where: { sourceAuthority: "LEGACY_ORDER", sourceEventType: { in: customerOrderNotificationDefinitions.map((d) => d.eventType) } } })).map((r) => r.id);
  });
  beforeEach(async () => {
    await prisma.notificationEventRouteVersion.deleteMany({ where: { routeId: { in: routeIds } } });
    await prisma.notificationTemplateVersion.updateMany({ where: { templateId: { in: templateIds } }, data: { status: "UNDER_REVIEW", approvedByUserId: null, approvedAt: null, publishedAt: null } });
    await prisma.notificationRecipientPolicyVersion.updateMany({ where: { key: customerOrderRecipientPolicyKey }, data: { status: "DRAFT", approvedByUserId: null, approvedAt: null } });
    // This suite owns these receipts and destinations in the isolated database.
    await prisma.notificationInboxItem.deleteMany({ where: { ownerUserId: { in: users } } });
    await prisma.notificationDelivery.deleteMany({ where: { recipientUserId: { in: users } } });
    await prisma.notificationRecipient.deleteMany({ where: { subjectUserId: { in: users } } });
    await prisma.notificationMessage.deleteMany({ where: { recipientUserId: { in: users } } });
    const receipts = await prisma.notificationSourceReceipt.findMany({ where: { sourceEventId: { startsWith: prefix } }, select: { id: true } });
    await prisma.notificationReconciliationCase.deleteMany({ where: { sourceReceiptId: { in: receipts.map((r) => r.id) } } });
    await prisma.notificationSourceReceipt.deleteMany({ where: { sourceEventId: { startsWith: prefix } } });
    await prisma.notificationEventIntent.deleteMany({ where: { operationId: { startsWith: prefix } } });
  });
  afterAll(async () => {
    // Fixtures are removed only in the disposable database, never production.
    await prisma.order.deleteMany({ where: { id: { in: orders } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  });
  it("prepares idempotent review drafts without approving or activating them", async () => {
    await prisma.$transaction(prepareCustomerOrderNotifications);
    expect(await prisma.notificationTemplateVersion.count({ where: { templateId: { in: templateIds } } })).toBe(2);
    expect(await prisma.notificationTemplateVersion.count({ where: { templateId: { in: templateIds }, status: "UNDER_REVIEW" } })).toBe(2);
    expect(await prisma.notificationEventRouteVersion.count({ where: { routeId: { in: routeIds } } })).toBe(0);
    await event();
    expect(await listPendingCustomerOrderIntents(50)).toEqual([]);
  });
  it("requires different publishing and activation actors, recording real review evidence", async () => {
    await review("ORDER_CONFIRMED", "APPROVE_TEMPLATE");
    await expect(review("ORDER_CONFIRMED", "PUBLISH_TEMPLATE")).rejects.toMatchObject({ code: "TEMPLATE_APPROVAL_SEPARATION_REQUIRED" });
    await review("ORDER_CONFIRMED", "PUBLISH_TEMPLATE", "publisher");
    await review("ORDER_CONFIRMED", "APPROVE_RECIPIENT_POLICY");
    await review("ORDER_CONFIRMED", "PREPARE_ROUTE");
    await review("ORDER_CONFIRMED", "PREPARE_ROUTE");
    expect(await prisma.notificationEventRouteVersion.count({ where: { routeId: { in: routeIds } } })).toBe(1);
    await review("ORDER_CONFIRMED", "APPROVE_ROUTE");
    await expect(review("ORDER_CONFIRMED", "ACTIVATE_ROUTE")).rejects.toMatchObject({ code: "ROUTE_APPROVAL_SEPARATION_REQUIRED" });
    await review("ORDER_CONFIRMED", "ACTIVATE_ROUTE", "publisher");
    expect(await prisma.notificationAuditEvent.count({ where: { actorUserId: `${prefix}-publisher`, eventType: "CUSTOMER_ORDER_ACTIVATE_ROUTE" } })).toBe(1);
  });
  it("does not backfill historical events or unrelated notification sources", async () => {
    const old = await event({ createdAt: new Date("2020-01-01") });
    await activate();
    await event({ eventType: "DELIVERY_OTP_ISSUED" });
    await event({ sourceAuthority: "STORE_ORDER" });
    const fresh = await event();
    expect(await listPendingCustomerOrderIntents(50)).toEqual([{ id: fresh.intent.id }]);
    expect(await prisma.$transaction((tx) => publishCustomerOrderIntent(tx, old.intent.id))).toBe("SKIPPED");
  });
  it("atomically creates inbox and email for the canonical customer, and replay is a no-op", async () => {
    await activate(); const { user, order, intent } = await event();
    expect((await consumeCustomerOrderNotifications(50)).itemsCompleted).toBe(1);
    expect((await consumeCustomerOrderNotifications(50)).itemsExamined).toBe(0);
    const inbox = await prisma.notificationInboxItem.findMany({ where: { ownerUserId: user.id } });
    expect(inbox).toHaveLength(1); expect(inbox[0].body).toContain(order.orderNumber); expect(inbox[0].body).not.toContain("spoofed");
    expect(await prisma.notificationDelivery.count({ where: { recipientUserId: user.id } })).toBe(2);
    expect(await prisma.notificationDelivery.findFirst({ where: { recipientUserId: user.id, channel: "EMAIL" } })).toMatchObject({ status: "QUEUED" });
    expect(await prisma.notificationSourceReceipt.findFirst({ where: { sourceEventId: intent.operationId } })).toMatchObject({ status: "CONSUMED" });
  });
  it("rolls back a failed inbox write including the consumed receipt, then resumes", async () => {
    await activate(); const { user, intent } = await event();
    await expect(prisma.$transaction((tx) => publishCustomerOrderIntent(new Proxy(tx, { get(target, property) { if (property === "notificationInboxItem") return { upsert: async () => { throw new Error("simulated inbox failure"); } }; return Reflect.get(target, property); } }), intent.id))).rejects.toThrow("simulated inbox failure");
    expect(await prisma.notificationSourceReceipt.count({ where: { sourceEventId: intent.operationId } })).toBe(0);
    expect(await prisma.notificationMessage.count({ where: { recipientUserId: user.id } })).toBe(0);
    expect((await consumeCustomerOrderNotifications(50)).itemsCompleted).toBe(1);
  });
  it("serializes concurrent publication without duplicate messages or inbox entries", async () => {
    await activate(); const { user } = await event();
    const results = await Promise.all([consumeCustomerOrderNotifications(50), consumeCustomerOrderNotifications(50)]);
    expect(results.reduce((sum, r) => sum + r.itemsCompleted, 0)).toBe(1);
    expect(results.reduce((sum, r) => sum + r.itemsRetried, 0)).toBe(0);
    expect(await prisma.notificationInboxItem.count({ where: { ownerUserId: user.id } })).toBe(1);
  });
  it("keeps the inbox available when the customer has no verified email", async () => {
    await activate(); const { user } = await event({ verified: false });
    expect((await consumeCustomerOrderNotifications(50)).itemsCompleted).toBe(1);
    expect(await prisma.notificationInboxItem.count({ where: { ownerUserId: user.id } })).toBe(1);
    expect(await prisma.notificationDelivery.findFirst({ where: { recipientUserId: user.id, channel: "EMAIL" } })).toMatchObject({ status: "ELIGIBILITY_BLOCKED" });
  });
  it("honours the customer's email preference", async () => {
    await activate(); const { user } = await event();
    await prisma.notificationPreference.create({ data: { userId: user.id, categoryKey: "ORDER_CONFIRMATION", channel: "EMAIL", mode: "DISABLED" } });
    await consumeCustomerOrderNotifications(50);
    expect(await prisma.notificationDelivery.findFirst({ where: { recipientUserId: user.id, channel: "EMAIL" } })).toMatchObject({ status: "ELIGIBILITY_BLOCKED", eligibilityReason: "PREFERENCE_DISABLED" });
  });
  it("records unresolved recipients for review without dispatch or perpetual retries", async () => {
    await activate(); const { intent } = await event({ customer: false });
    expect((await consumeCustomerOrderNotifications(50)).itemsReconciled).toBe(1);
    expect(await prisma.notificationSourceReceipt.findFirst({ where: { sourceEventId: intent.operationId } })).toMatchObject({ status: "RECONCILIATION_REQUIRED" });
    expect((await consumeCustomerOrderNotifications(50)).itemsExamined).toBe(0);
  });
  it("renders status updates and respects suppression before queuing email", async () => {
    await activate(); const { user } = await event({ eventType: "ORDER_STATUS_CHANGED" });
    await createNotificationAuthority(prisma, new Map()).suppressions.suppress({ userId: user.id, channel: "EMAIL", reason: "USER_REVOCATION" });
    await consumeCustomerOrderNotifications(50);
    expect(await prisma.notificationInboxItem.findFirst({ where: { ownerUserId: user.id } })).toMatchObject({ body: expect.stringContaining("in transit") });
    expect(await prisma.notificationDelivery.findFirst({ where: { recipientUserId: user.id, channel: "EMAIL" } })).toMatchObject({ status: "ELIGIBILITY_BLOCKED" });
  });
  it("commits status and notification together, including rollback and same-status replay", async () => {
    const { user, order } = await event();
    const args = { orderId: order.id, toStatus: "CANCELLED" as const, actorRole: "CUSTOMER" as const, actorUserId: user.id, context: { actorOwnsOrder: true, cancellationWindowOpen: true } };
    await expect(prisma.$transaction((tx) => transitionOrderStatusInTx(new Proxy(tx, { get(target, property) { if (property === "notificationEventIntent") return { upsert: async () => { throw new Error("simulated event write failure"); } }; return Reflect.get(target, property); } }), args))).rejects.toThrow("simulated event write failure");
    expect(await prisma.order.findUnique({ where: { id: order.id } })).toMatchObject({ status: "PENDING" });
    expect(await prisma.orderStatusHistory.count({ where: { orderId: order.id } })).toBe(0);
    await prisma.$transaction((tx) => transitionOrderStatusInTx(tx, args));
    await prisma.$transaction((tx) => transitionOrderStatusInTx(tx, args));
    const history = await prisma.orderStatusHistory.findMany({ where: { orderId: order.id } });
    expect(history).toHaveLength(1);
    expect(await prisma.notificationEventIntent.findUnique({ where: { operationId: `legacy-order-status-history:${history[0].id}` } })).toMatchObject({ aggregateReference: order.id, safePayload: { orderNumber: order.orderNumber, status: "CANCELLED", source: "CUSTOMER" } });
    // This test owns the history and event created in the isolated database.
    await prisma.notificationEventIntent.deleteMany({ where: { operationId: `legacy-order-status-history:${history[0].id}` } });
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: order.id } });
  });
});
