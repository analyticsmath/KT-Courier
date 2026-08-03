import { describe, expect, it } from "vitest";
import { NotificationCategoryService, NotificationRouteService, NotificationTemplateService } from "@/lib/notifications/authority";
import { NotificationPolicyError } from "@/lib/notifications/contracts";
import { createNotificationMemoryDb } from "./helpers/in-memory-notification-db";

const securityCategory = { key: "ACCOUNT_SECURITY", purpose: "SECURITY" as const, defaultPriority: "HIGH", defaultSensitivity: "SECURITY" as const, mandatory: true, preferenceControlled: false, consentRequired: false, quietHoursBypass: true, digestEligible: false, retentionPolicyReference: "retention-security-v1" };
const transactionCategory = { key: "ORDER_STATUS", purpose: "TRANSACTIONAL" as const, defaultPriority: "NORMAL", defaultSensitivity: "ACCOUNT" as const, mandatory: false, preferenceControlled: true, consentRequired: false, quietHoursBypass: false, digestEligible: true, retentionPolicyReference: "retention-order-v1" };

describe("Phase 27 category policies", () => {
  it("freezes stable category policy and rejects invalid mandatory or marketing combinations", async () => {
    const db = createNotificationMemoryDb();
    const service = new NotificationCategoryService(db);
    await expect(service.create({ ...securityCategory, mandatory: false })).rejects.toMatchObject({ code: "MANDATORY_NOTIFICATION_CATEGORY_REQUIRED" });
    await expect(service.create({ ...transactionCategory, key: "MARKETING", purpose: "MARKETING", consentRequired: false })).rejects.toMatchObject({ code: "MARKETING_CONSENT_REQUIRED" });
    const created = await service.create(securityCategory);
    expect(created).toMatchObject({ key: "ACCOUNT_SECURITY", mandatory: true, preferenceControlled: false, retentionPolicyReference: "retention-security-v1", status: "ACTIVE" });
    await expect(service.create(securityCategory)).rejects.toMatchObject({ code: "P2002" });
  });

  it("retires categories and excludes them from new templates", async () => {
    const db = createNotificationMemoryDb();
    const categories = new NotificationCategoryService(db);
    const created = await categories.create(transactionCategory);
    await categories.retire(created.publicReference);
    await expect(new NotificationTemplateService(db).create({ key: "ORDER_STATUS_TEMPLATE", categoryKey: transactionCategory.key })).rejects.toMatchObject({ code: "NOTIFICATION_CATEGORY_NOT_ACTIVE" });
  });
});

describe("Phase 27 templates and renderer", () => {
  it("enforces draft, approval separation, publication, immutable published metadata and versioned rendering", async () => {
    const db = createNotificationMemoryDb();
    await new NotificationCategoryService(db).create(transactionCategory);
    const templates = new NotificationTemplateService(db);
    const template = await templates.create({ key: "ORDER_STATUS_TEMPLATE", categoryKey: "ORDER_STATUS" });
    const version = await templates.createVersion(template.publicReference, { purpose: "TRANSACTIONAL", sensitivity: "ACCOUNT", titleTemplate: "Order {{order}}", plainTextTemplate: "Order {{order}} is {{status}}", actionRoute: "/account/orders", variables: [{ name: "order", type: "REFERENCE", required: true, maximumLength: 32, sensitivity: "ACCOUNT", allowedChannels: ["IN_APP", "EMAIL"] }, { name: "status", type: "TEXT", required: true, maximumLength: 80, sensitivity: "ACCOUNT", allowedChannels: ["IN_APP", "EMAIL"] }] });
    await templates.submit(version.publicReference);
    await templates.approve(version.publicReference, "reviewer_1");
    await expect(templates.publish(version.publicReference, "reviewer_1")).rejects.toMatchObject({ code: "TEMPLATE_APPROVAL_SEPARATION_REQUIRED" });
    await templates.publish(version.publicReference, "publisher_1");
    await expect(templates.update(template.publicReference, { categoryKey: "ORDER_STATUS" })).rejects.toMatchObject({ code: "NOTIFICATION_TEMPLATE_IMMUTABLE" });
    await expect(templates.render({ templateVersionId: version.id, channel: "EMAIL", values: { order: "ORD-100", status: "Collected" } })).resolves.toMatchObject({ body: "Order ORD-100 is Collected" });
  });

  it("rejects unsafe rendering contracts and only retires non-draft versions", async () => {
    const db = createNotificationMemoryDb();
    await new NotificationCategoryService(db).create(transactionCategory);
    const templates = new NotificationTemplateService(db);
    const template = await templates.create({ key: "ORDER_STATUS_TEMPLATE", categoryKey: "ORDER_STATUS" });
    await expect(templates.createVersion(template.publicReference, { purpose: "TRANSACTIONAL", sensitivity: "ACCOUNT", plainTextTemplate: "x", actionRoute: "https://example.test", variables: [] })).rejects.toBeInstanceOf(NotificationPolicyError);
    const draft = await templates.createVersion(template.publicReference, { purpose: "TRANSACTIONAL", sensitivity: "ACCOUNT", plainTextTemplate: "x", variables: [] });
    await expect(templates.retire(draft.publicReference)).rejects.toMatchObject({ code: "NOTIFICATION_TEMPLATE_NOT_SUBMITTED" });
  });
});

describe("Phase 27 event routes", () => {
  it("freezes exact category, template version and recipient policy before activation", async () => {
    const db = createNotificationMemoryDb();
    await new NotificationCategoryService(db).create(transactionCategory);
    const templates = new NotificationTemplateService(db);
    const template = await templates.create({ key: "ORDER_STATUS_TEMPLATE", categoryKey: "ORDER_STATUS" });
    const templateVersion = await templates.createVersion(template.publicReference, { purpose: "TRANSACTIONAL", sensitivity: "ACCOUNT", plainTextTemplate: "Order {{order}}", variables: [{ name: "order", type: "REFERENCE", required: true, maximumLength: 32, sensitivity: "ACCOUNT", allowedChannels: ["IN_APP"] }] });
    await templates.submit(templateVersion.publicReference); await templates.approve(templateVersion.publicReference, "reviewer"); await templates.publish(templateVersion.publicReference, "publisher");
    const routes = new NotificationRouteService(db);
    const policy = await routes.createRecipientPolicyVersion({ key: "ORDER_CUSTOMER", policy: { subject: "CUSTOMER", role: "CUSTOMER" } });
    await routes.approveRecipientPolicy(policy.publicReference, "policy-approver");
    const route = await routes.create({ key: "ORDER_STATUS_ROUTE", sourceAuthority: "LEGACY_ORDER", sourceEventType: "ORDER_STATUS_CHANGED" });
    const version = await routes.createVersion(route.publicReference, { categoryKey: "ORDER_STATUS", recipientPolicyVersionId: policy.id, templateKey: template.key, templateVersionId: templateVersion.id, channelPolicy: { channels: ["IN_APP"] }, fallbackPolicy: "IN_APP_ONLY", priority: "NORMAL", quietHoursBypass: false, digestMode: "IMMEDIATE" });
    await routes.approve(version.publicReference, "route-reviewer");
    await expect(routes.activate(version.publicReference, "route-reviewer")).rejects.toMatchObject({ code: "ROUTE_APPROVAL_SEPARATION_REQUIRED" });
    const active = await routes.activate(version.publicReference, "route-publisher");
    expect(active).toMatchObject({ status: "ACTIVE", templateVersionId: templateVersion.id, recipientPolicyVersionId: policy.id });
    await expect(routes.update(route.publicReference, { sourceEventType: "OTHER" })).rejects.toMatchObject({ code: "NOTIFICATION_ROUTE_IMMUTABLE" });
  });
});
