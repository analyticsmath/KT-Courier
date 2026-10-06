import { Prisma } from "@prisma/client";
import { createNotificationAuthority } from "./authority";
import { NotificationPolicyError } from "./contracts";

export const customerOrderNotificationDefinitions = [
  { eventType: "ORDER_CONFIRMED", categoryKey: "ORDER_CONFIRMATION", templateKey: "CLIENT_COURIER_ORDER_CONFIRMED", title: "KT Couriers: booking {{orderNumber}} received", body: "Your courier booking {{orderNumber}} has been received. View its status and payment details in your KT Couriers account." },
  { eventType: "ORDER_STATUS_CHANGED", categoryKey: "ORDER_STATUS", templateKey: "CLIENT_COURIER_ORDER_STATUS", title: "KT Couriers: order {{orderNumber}} update", body: "Your order {{orderNumber}} is now {{status}}. View the details in your KT Couriers account." },
] as const;
export const customerOrderRecipientPolicyKey = "CLIENT_COURIER_CUSTOMER";
export const customerOrderRouteKey = (eventType: string) => `CLIENT_COURIER_${eventType}`;

/** Prepare concrete drafts only. Never fabricate reviewers or bypass publication separation. */
export async function prepareCustomerOrderNotifications(db: Prisma.TransactionClient) {
  const authority = createNotificationAuthority(db, new Map());
  if (!await db.notificationRecipientPolicyVersion.findFirst({ where: { key: customerOrderRecipientPolicyKey } })) {
    await authority.routes.createRecipientPolicyVersion({ key: customerOrderRecipientPolicyKey, policy: { subject: "CUSTOMER" } });
  }
  for (const definition of customerOrderNotificationDefinitions) {
    const category = await db.notificationCategory.findUnique({ where: { key: definition.categoryKey } });
    if (!category) await authority.categories.create({ key: definition.categoryKey, purpose: "TRANSACTIONAL", defaultPriority: "NORMAL", defaultSensitivity: "ACCOUNT", mandatory: false, preferenceControlled: true, consentRequired: false, quietHoursBypass: false, digestEligible: false });
    else if (category.status !== "ACTIVE" || category.purpose !== "TRANSACTIONAL" || category.defaultSensitivity !== "ACCOUNT") throw new NotificationPolicyError("CLIENT_NOTIFICATION_CATEGORY_CONFLICT");
    let template = await db.notificationTemplate.findUnique({ where: { key: definition.templateKey } });
    if (!template) template = await authority.templates.create({ key: definition.templateKey, categoryKey: definition.categoryKey });
    if (template!.categoryKey !== definition.categoryKey) throw new NotificationPolicyError("CLIENT_NOTIFICATION_CATEGORY_CONFLICT");
    if (!await db.notificationTemplateVersion.findFirst({ where: { templateId: template!.id } })) {
      const names = definition.eventType === "ORDER_CONFIRMED" ? ["orderNumber"] : ["orderNumber", "status"];
      const version = await authority.templates.createVersion(template!.publicReference, { purpose: "TRANSACTIONAL", sensitivity: "ACCOUNT", subjectTemplate: definition.title, titleTemplate: definition.title, plainTextTemplate: definition.body, actionLabel: "View orders", actionRoute: "/account/orders", expiryMinutes: 1440, variables: names.map((name) => ({ name, type: "TEXT" as const, required: true, maximumLength: 160, sensitivity: "ACCOUNT" as const, allowedChannels: ["IN_APP", "EMAIL"] })) });
      await authority.templates.submit(version.publicReference);
    }
    if (!await db.notificationEventRoute.findUnique({ where: { key: customerOrderRouteKey(definition.eventType) } })) {
      await authority.routes.create({ key: customerOrderRouteKey(definition.eventType), sourceAuthority: "LEGACY_ORDER", sourceEventType: definition.eventType });
    }
  }
}

export async function prepareCustomerOrderRouteVersion(db: Prisma.TransactionClient, eventType: string) {
  const definition = customerOrderNotificationDefinitions.find((entry) => entry.eventType === eventType);
  if (!definition) throw new NotificationPolicyError("CLIENT_NOTIFICATION_NOT_FOUND");
  const route = await db.notificationEventRoute.findUnique({ where: { key: customerOrderRouteKey(eventType) } });
  const template = await db.notificationTemplate.findUnique({ where: { key: definition.templateKey } });
  const policy = await db.notificationRecipientPolicyVersion.findFirst({ where: { key: customerOrderRecipientPolicyKey, status: "APPROVED" }, orderBy: { versionNumber: "desc" } });
  const version = template ? await db.notificationTemplateVersion.findFirst({ where: { templateId: template.id, status: "PUBLISHED" }, orderBy: { versionNumber: "desc" } }) : null;
  if (!route || !template || !policy || !version) throw new NotificationPolicyError("CLIENT_NOTIFICATION_APPROVAL_REQUIRED");
  const previous = await db.notificationEventRouteVersion.findFirst({ where: { routeId: route.id }, orderBy: { versionNumber: "desc" } });
  // Repeated clicks do not create duplicate drafts or reactivate retired versions.
  if (previous) return previous;
  return createNotificationAuthority(db, new Map()).routes.createVersion(route.publicReference, { categoryKey: definition.categoryKey, recipientPolicyVersionId: policy.id, templateKey: template.key, templateVersionId: version.id, channelPolicy: { channels: ["IN_APP", "EMAIL"] }, fallbackPolicy: "IN_APP_ONLY", priority: "NORMAL", quietHoursBypass: false, digestMode: "IMMEDIATE", expiryMinutes: 1440 });
}
