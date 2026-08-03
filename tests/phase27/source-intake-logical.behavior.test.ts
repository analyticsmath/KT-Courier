import { describe, expect, it } from "vitest";
import { NotificationCategoryService, NotificationRouteService, NotificationSourceIntakeService, NotificationTemplateService, RecipientPolicyService, NotificationReconciliationService } from "@/lib/notifications/authority";
import { NotificationService } from "@/lib/notifications/notification.service";
import { createNotificationMemoryDb } from "./helpers/in-memory-notification-db";

async function activeOrderRoute(db: ReturnType<typeof createNotificationMemoryDb>) {
  await new NotificationCategoryService(db).create({ key: "ORDER_STATUS", purpose: "TRANSACTIONAL", defaultPriority: "NORMAL", defaultSensitivity: "ACCOUNT", mandatory: false, preferenceControlled: true, consentRequired: false, quietHoursBypass: false, digestEligible: true });
  const templates = new NotificationTemplateService(db);
  const template = await templates.create({ key: "ORDER_STATUS_TEMPLATE", categoryKey: "ORDER_STATUS" });
  const templateVersion = await templates.createVersion(template.publicReference, { purpose: "TRANSACTIONAL", sensitivity: "ACCOUNT", plainTextTemplate: "Order {{order}}", variables: [{ name: "order", type: "REFERENCE", required: true, maximumLength: 32, sensitivity: "ACCOUNT", allowedChannels: ["IN_APP"] }] });
  await templates.submit(templateVersion.publicReference); await templates.approve(templateVersion.publicReference, "template-reviewer"); await templates.publish(templateVersion.publicReference, "template-publisher");
  const routes = new NotificationRouteService(db);
  const policy = await routes.createRecipientPolicyVersion({ key: "ORDER_CUSTOMER", policy: { subject: "CUSTOMER", role: "CUSTOMER" } });
  await routes.approveRecipientPolicy(policy.publicReference, "policy-reviewer");
  const route = await routes.create({ key: "ORDER_STATUS_ROUTE", sourceAuthority: "LEGACY_ORDER", sourceEventType: "ORDER_STATUS_CHANGED" });
  const routeVersion = await routes.createVersion(route.publicReference, { categoryKey: "ORDER_STATUS", recipientPolicyVersionId: policy.id, templateKey: template.key, templateVersionId: templateVersion.id, channelPolicy: { channels: ["IN_APP"] }, fallbackPolicy: "IN_APP_ONLY", priority: "NORMAL", quietHoursBypass: false, digestMode: "IMMEDIATE", expiryMinutes: 60 });
  await routes.approve(routeVersion.publicReference, "route-reviewer"); await routes.activate(routeVersion.publicReference, "route-activator");
  return routeVersion;
}

describe("Phase 27 source-event intake", () => {
  it("validates source authority, preserves identical replay, and rejects changed payloads", async () => {
    const db = createNotificationMemoryDb();
    const intake = new NotificationSourceIntakeService(db, new RecipientPolicyService(db), new NotificationReconciliationService(db));
    await expect(intake.intake({ sourceAuthority: "UNTRUSTED", sourceEventId: "event-1", sourceEventType: "ORDER_STATUS_CHANGED", aggregateReference: "order-1", payload: {} })).rejects.toMatchObject({ code: "INVALID_NOTIFICATION_SOURCE_AUTHORITY" });
    const first = await intake.intake({ sourceAuthority: "LEGACY_ORDER", sourceEventId: "event-1", sourceEventType: "ORDER_STATUS_CHANGED", aggregateReference: "order-1", payload: { order: "ORD-1" } });
    const replay = await intake.intake({ sourceAuthority: "LEGACY_ORDER", sourceEventId: "event-1", sourceEventType: "ORDER_STATUS_CHANGED", aggregateReference: "order-1", payload: { order: "ORD-1" } });
    expect(replay).toMatchObject({ replay: true, receipt: { id: first.receipt.id, status: "RECEIVED" } });
    await expect(intake.intake({ sourceAuthority: "LEGACY_ORDER", sourceEventId: "event-1", sourceEventType: "ORDER_STATUS_CHANGED", aggregateReference: "order-1", payload: { order: "ORD-2" } })).rejects.toMatchObject({ code: "NOTIFICATION_SOURCE_EVENT_PAYLOAD_CONFLICT" });
  });

  it("fans out atomically with all frozen message authorities and no duplicate under concurrent intake", async () => {
    const db = createNotificationMemoryDb({ user: [{ id: "customer-1", role: "CUSTOMER", status: "ACTIVE", email: "customer@example.test", emailVerifiedAt: new Date() }] });
    const routeVersion = await activeOrderRoute(db);
    const intake = new NotificationSourceIntakeService(db, new RecipientPolicyService(db), new NotificationReconciliationService(db));
    const [first, second] = await Promise.all([intake.intake({ sourceAuthority: "LEGACY_ORDER", sourceEventId: "event-2", sourceEventType: "ORDER_STATUS_CHANGED", aggregateReference: "order-2", payload: { customerUserId: "customer-1", order: "ORD-2" } }), intake.intake({ sourceAuthority: "LEGACY_ORDER", sourceEventId: "event-2", sourceEventType: "ORDER_STATUS_CHANGED", aggregateReference: "order-2", payload: { customerUserId: "customer-1", order: "ORD-2" } })]);
    const accepted = first.replay ? second : first;
    const fanout = await intake.fanout({ receiptId: accepted.receipt.id, payload: { customerUserId: "customer-1", order: "ORD-2" } });
    const replay = await intake.fanout({ receiptId: accepted.receipt.id, payload: { customerUserId: "customer-1", order: "ORD-2" } });
    expect(fanout.message).toMatchObject({ sourceReceiptId: accepted.receipt.id, recipientUserId: "customer-1", categoryKey: "ORDER_STATUS", routeVersionId: routeVersion.id, templateVersionId: routeVersion.templateVersionId, recipientPolicyVersionId: routeVersion.recipientPolicyVersionId, purpose: "TRANSACTIONAL", sensitivity: "ACCOUNT", status: "FANOUT_COMPLETED" });
    expect(replay).toMatchObject({ replay: true });
    expect(db.__state.notificationMessage).toHaveLength(1);
    expect(db.__state.notificationRecipient).toEqual([expect.objectContaining({ subjectUserId: "customer-1", roleProjection: "CUSTOMER" })]);
  });

  it("does not consume a source receipt until the transaction has persisted its recipient and logical message", async () => {
    const db = createNotificationMemoryDb({ user: [{ id: "customer-1", role: "CUSTOMER", status: "ACTIVE", email: "customer@example.test", emailVerifiedAt: new Date() }] });
    await activeOrderRoute(db);
    const intake = new NotificationSourceIntakeService(db, new RecipientPolicyService(db), new NotificationReconciliationService(db));
    const receipt = await intake.intake({ sourceAuthority: "LEGACY_ORDER", sourceEventId: "event-3", sourceEventType: "ORDER_STATUS_CHANGED", aggregateReference: "order-3", payload: { customerUserId: "customer-1", order: "ORD-3" } });
    const originalCreate = db.notificationRecipient.create;
    db.notificationRecipient.create = async () => { throw new Error("recipient write failed"); };
    await expect(intake.fanout({ receiptId: receipt.receipt.id, payload: { customerUserId: "customer-1", order: "ORD-3" } })).rejects.toThrow("recipient write failed");
    db.notificationRecipient.create = originalCreate;
    expect(db.__state.notificationSourceReceipt[0]).toMatchObject({ id: receipt.receipt.id, status: "RECEIVED" });
    expect(db.__state.notificationMessage).toHaveLength(0);
  });

  it("opens reconciliation rather than dropping unmapped events or unresolved recipients", async () => {
    const db = createNotificationMemoryDb();
    const intake = new NotificationSourceIntakeService(db, new RecipientPolicyService(db), new NotificationReconciliationService(db));
    const unmapped = await intake.intake({ sourceAuthority: "LEGACY_ORDER", sourceEventId: "event-4", sourceEventType: "ORDER_STATUS_CHANGED", aggregateReference: "order-4", payload: {} });
    await expect(intake.fanout({ receiptId: unmapped.receipt.id, payload: {} })).resolves.toMatchObject({ reconciliationRequired: true });
    await activeOrderRoute(db);
    const unresolved = await intake.intake({ sourceAuthority: "LEGACY_ORDER", sourceEventId: "event-5", sourceEventType: "ORDER_STATUS_CHANGED", aggregateReference: "order-5", payload: { customerUserId: "missing", order: "ORD-5" } });
    await expect(intake.fanout({ receiptId: unresolved.receipt.id, payload: { customerUserId: "missing", order: "ORD-5" } })).resolves.toMatchObject({ reconciliationRequired: true });
    expect(db.__state.notificationReconciliationCase.map((item: any) => item.reason)).toEqual(expect.arrayContaining(["EVENT_ROUTE_NOT_CONFIGURED", "RECIPIENT_NOT_RESOLVED"]));
  });
});

describe("Phase 27 logical-message idempotency", () => {
  it("returns the original immutable message on an identical replay and conflicts on changed variables", async () => {
    const db = createNotificationMemoryDb();
    const service = new NotificationService(db);
    const source = await db.notificationSourceReceipt.create({ data: { publicReference: "receipt-1", sourceAuthority: "LEGACY_ORDER", sourceEventId: "event-6", sourceEventType: "ORDER_STATUS_CHANGED", aggregateReference: "order-6", payloadHash: "hash", occurredAt: new Date(), status: "RECEIVED" } });
    const input = { sourceReceiptId: source.id, recipientUserId: "customer-1", categoryKey: "ORDER_STATUS", routeVersionId: "route-version-1", templateVersionId: "template-version-1", recipientPolicyVersionId: "policy-version-1", purpose: "TRANSACTIONAL" as const, priority: "NORMAL" as const, sensitivity: "ACCOUNT" as const, renderVariables: { order: "ORD-6" }, expiresAt: new Date(Date.now() + 60_000) };
    const first = await service.createLogicalMessage(input);
    const replay = await service.createLogicalMessage(input);
    expect(replay).toMatchObject({ replay: true, message: { id: first.message.id, routeVersionId: "route-version-1" } });
    await expect(service.createLogicalMessage({ ...input, renderVariables: { order: "ORD-7" } })).rejects.toMatchObject({ code: "NOTIFICATION_SOURCE_EVENT_PAYLOAD_CONFLICT" });
  });
});
