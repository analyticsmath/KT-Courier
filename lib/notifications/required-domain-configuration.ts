import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { createNotificationAuthority } from "./authority";
import { NotificationPolicyError } from "./contracts";
import { requiredDomainNotificationDefinitions } from "./required-domain-definitions";
import { reviewCustomerOrderNotification, type CustomerOrderReviewAction } from "./customer-order-review";

/** Add review drafts; no approver, publisher or activation identity is manufactured. */
export async function prepareRequiredDomainNotifications(db: Prisma.TransactionClient) {
  const authority = createNotificationAuthority(db, new Map());
  for (const definition of requiredDomainNotificationDefinitions.filter((entry) => entry.sourceAuthority !== "LEGACY_ORDER")) {
    if (!await db.notificationRecipientPolicyVersion.findFirst({ where: { key: definition.recipientPolicyKey } })) await authority.routes.createRecipientPolicyVersion({ key: definition.recipientPolicyKey, policy: { subject: definition.subject } });
    const category = await db.notificationCategory.findUnique({ where: { key: definition.categoryKey } });
    if (!category) await authority.categories.create({ key: definition.categoryKey, purpose: "TRANSACTIONAL", defaultPriority: "NORMAL", defaultSensitivity: "ACCOUNT", mandatory: false, preferenceControlled: true, consentRequired: false, quietHoursBypass: false, digestEligible: false });
    else if (category.status !== "ACTIVE" || category.purpose !== "TRANSACTIONAL" || category.defaultSensitivity !== "ACCOUNT") throw new NotificationPolicyError("CLIENT_NOTIFICATION_CATEGORY_CONFLICT");
    let template = await db.notificationTemplate.findUnique({ where: { key: definition.templateKey } });
    if (!template) template = await authority.templates.create({ key: definition.templateKey, categoryKey: definition.categoryKey });
    if (template!.categoryKey !== definition.categoryKey) throw new NotificationPolicyError("CLIENT_NOTIFICATION_CATEGORY_CONFLICT");
    if (!await db.notificationTemplateVersion.findFirst({ where: { templateId: template!.id } })) {
      const version = await authority.templates.createVersion(template!.publicReference, { purpose: "TRANSACTIONAL", sensitivity: "ACCOUNT", subjectTemplate: definition.title, titleTemplate: definition.title, plainTextTemplate: definition.body, actionRoute: definition.actionRoute, expiryMinutes: 1440, variables: definition.variables.map((name) => ({ name, type: "TEXT" as const, required: true, maximumLength: 160, sensitivity: "ACCOUNT" as const, allowedChannels: ["IN_APP", "EMAIL"] })) });
      await authority.templates.submit(version.publicReference);
    }
    if (!await db.notificationEventRoute.findUnique({ where: { key: definition.routeKey } })) await authority.routes.create({ key: definition.routeKey, sourceAuthority: definition.sourceAuthority, sourceEventType: definition.eventType });
  }
}

export async function reviewRequiredDomainNotification(db: Prisma.TransactionClient, eventType: string, action: CustomerOrderReviewAction, actorUserId: string) {
  const definition = requiredDomainNotificationDefinitions.find((entry) => entry.eventType === eventType);
  if (!definition) throw new NotificationPolicyError("CLIENT_NOTIFICATION_NOT_FOUND");
  if (definition.sourceAuthority === "LEGACY_ORDER") return reviewCustomerOrderNotification(db, eventType, action, actorUserId);
  const authority = createNotificationAuthority(db, new Map());
  const policy = await db.notificationRecipientPolicyVersion.findFirst({ where: { key: definition.recipientPolicyKey }, orderBy: { versionNumber: "desc" } });
  const template = await db.notificationTemplate.findUnique({ where: { key: definition.templateKey } });
  const version = template ? await db.notificationTemplateVersion.findFirst({ where: { templateId: template.id }, orderBy: { versionNumber: "desc" } }) : null;
  const route = await db.notificationEventRoute.findUnique({ where: { key: definition.routeKey } });
  let result: { publicReference: string; status: string };
  if (action === "APPROVE_RECIPIENT_POLICY") {
    if (!policy) throw new NotificationPolicyError("CLIENT_NOTIFICATION_NOT_FOUND");
    result = await authority.routes.approveRecipientPolicy(policy.publicReference, actorUserId);
  } else if (action === "APPROVE_TEMPLATE" || action === "PUBLISH_TEMPLATE") {
    if (!version) throw new NotificationPolicyError("CLIENT_NOTIFICATION_NOT_FOUND");
    result = action === "APPROVE_TEMPLATE" ? await authority.templates.approve(version.publicReference, actorUserId) : await authority.templates.publish(version.publicReference, actorUserId);
  } else {
    if (!route) throw new NotificationPolicyError("CLIENT_NOTIFICATION_NOT_FOUND");
    const routeVersion = await db.notificationEventRouteVersion.findFirst({ where: { routeId: route.id }, orderBy: { versionNumber: "desc" } });
    if (action === "PREPARE_ROUTE") {
      if (routeVersion) result = routeVersion;
      else {
        if (!policy || policy.status !== "APPROVED" || !template || !version || version.status !== "PUBLISHED") throw new NotificationPolicyError("CLIENT_NOTIFICATION_APPROVAL_REQUIRED");
        result = await authority.routes.createVersion(route.publicReference, { categoryKey: definition.categoryKey, recipientPolicyVersionId: policy.id, templateKey: template.key, templateVersionId: version.id, channelPolicy: { channels: ["IN_APP", "EMAIL"] }, fallbackPolicy: "IN_APP_ONLY", priority: "NORMAL", quietHoursBypass: false, digestMode: "IMMEDIATE", expiryMinutes: 1440 });
      }
    } else {
      if (!routeVersion) throw new NotificationPolicyError("CLIENT_NOTIFICATION_NOT_FOUND");
      result = action === "APPROVE_ROUTE" ? await authority.routes.approve(routeVersion.publicReference, actorUserId) : await authority.routes.activate(routeVersion.publicReference, actorUserId);
    }
  }
  await db.notificationAuditEvent.create({ data: { publicReference: `naudit_${randomUUID()}`, actorUserId, eventType: `REQUIRED_DOMAIN_${action}`, entityReference: result.publicReference, safeEvidence: { sourceAuthority: definition.sourceAuthority, eventType, status: result.status } } });
  return { status: result.status };
}
