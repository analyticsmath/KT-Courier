import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { createNotificationAuthority } from "./authority";
import { NotificationPolicyError } from "./contracts";
import { customerOrderNotificationDefinitions, customerOrderRecipientPolicyKey, customerOrderRouteKey, prepareCustomerOrderRouteVersion } from "./customer-order-configuration";

export const customerOrderReviewPermissions = {
  APPROVE_TEMPLATE: PERMISSIONS.NOTIFICATION_TEMPLATE_APPROVE,
  PUBLISH_TEMPLATE: PERMISSIONS.NOTIFICATION_TEMPLATE_PUBLISH,
  APPROVE_RECIPIENT_POLICY: PERMISSIONS.NOTIFICATION_ROUTE_APPROVE,
  PREPARE_ROUTE: PERMISSIONS.NOTIFICATION_ROUTE_MANAGE,
  APPROVE_ROUTE: PERMISSIONS.NOTIFICATION_ROUTE_APPROVE,
  ACTIVATE_ROUTE: PERMISSIONS.NOTIFICATION_ROUTE_ACTIVATE,
} as const;
export type CustomerOrderReviewAction = keyof typeof customerOrderReviewPermissions;

/** Caller supplies an authenticated, permission-checked actor and a transaction. */
export async function reviewCustomerOrderNotification(db: Prisma.TransactionClient, eventType: string, action: CustomerOrderReviewAction, actorUserId: string) {
  const definition = customerOrderNotificationDefinitions.find((entry) => entry.eventType === eventType);
  if (!definition) throw new NotificationPolicyError("CLIENT_NOTIFICATION_NOT_FOUND");
  const authority = createNotificationAuthority(db, new Map());
  let result: { publicReference: string; status: string };
  if (action === "APPROVE_RECIPIENT_POLICY") {
    const policy = await db.notificationRecipientPolicyVersion.findFirst({ where: { key: customerOrderRecipientPolicyKey }, orderBy: { versionNumber: "desc" } });
    if (!policy) throw new NotificationPolicyError("CLIENT_NOTIFICATION_NOT_FOUND");
    result = await authority.routes.approveRecipientPolicy(policy.publicReference, actorUserId);
  } else if (action === "APPROVE_TEMPLATE" || action === "PUBLISH_TEMPLATE") {
    const template = await db.notificationTemplate.findUnique({ where: { key: definition.templateKey } });
    const version = template ? await db.notificationTemplateVersion.findFirst({ where: { templateId: template.id }, orderBy: { versionNumber: "desc" } }) : null;
    if (!version) throw new NotificationPolicyError("CLIENT_NOTIFICATION_NOT_FOUND");
    result = action === "APPROVE_TEMPLATE" ? await authority.templates.approve(version.publicReference, actorUserId) : await authority.templates.publish(version.publicReference, actorUserId);
  } else if (action === "PREPARE_ROUTE") {
    result = await prepareCustomerOrderRouteVersion(db, eventType);
  } else {
    const route = await db.notificationEventRoute.findUnique({ where: { key: customerOrderRouteKey(eventType) } });
    const version = route ? await db.notificationEventRouteVersion.findFirst({ where: { routeId: route.id }, orderBy: { versionNumber: "desc" } }) : null;
    if (!version) throw new NotificationPolicyError("CLIENT_NOTIFICATION_NOT_FOUND");
    result = action === "APPROVE_ROUTE" ? await authority.routes.approve(version.publicReference, actorUserId) : await authority.routes.activate(version.publicReference, actorUserId);
  }
  await db.notificationAuditEvent.create({ data: { publicReference: `naudit_${randomUUID()}`, actorUserId, eventType: `CUSTOMER_ORDER_${action}`, entityReference: result.publicReference, safeEvidence: { eventType, status: result.status } } });
  return { status: result.status };
}
