import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getEffectivePermissionKeysForUser } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { requiredDomainNotificationDefinitions } from "@/lib/notifications/required-domain-definitions";
import { customerOrderReviewPermissions, type CustomerOrderReviewAction } from "@/lib/notifications/customer-order-review";
import { NOTIFICATION_PRODUCTION_VALIDATION_APPROVED } from "@/lib/notifications/production-readiness";
import { CustomerOrderNotificationReview, type CustomerOrderReviewRow } from "@/components/protected-v2/notification-admin/CustomerOrderNotificationReview";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";

export default async function CustomerOrderNotificationsPage() {
  const user = await requireAdminPagePermission(PERMISSIONS.NOTIFICATION_TEMPLATE_READ);
  await requireAdminPagePermission(PERMISSIONS.NOTIFICATION_ROUTE_READ);
  const permissions = await getEffectivePermissionKeysForUser({ userId: user.id, role: user.role });
  const rows: CustomerOrderReviewRow[] = await Promise.all(requiredDomainNotificationDefinitions.map(async (definition) => {
    const policy = await prisma.notificationRecipientPolicyVersion.findFirst({ where: { key: definition.recipientPolicyKey }, orderBy: { versionNumber: "desc" } });
    const template = await prisma.notificationTemplate.findUnique({ where: { key: definition.templateKey } });
    const version = template ? await prisma.notificationTemplateVersion.findFirst({ where: { templateId: template.id }, orderBy: { versionNumber: "desc" } }) : null;
    const route = await prisma.notificationEventRoute.findUnique({ where: { key: definition.routeKey } });
    const routeVersion = route ? await prisma.notificationEventRouteVersion.findFirst({ where: { routeId: route.id }, orderBy: { versionNumber: "desc" } }) : null;
    const firstActivation = route ? await prisma.notificationEventRouteVersion.findFirst({ where: { routeId: route.id, activatedAt: { not: null } }, orderBy: { activatedAt: "asc" } }) : null;
    const actions: CustomerOrderReviewRow["actions"] = [];
    const add = (action: CustomerOrderReviewAction, label: string, eligible: boolean) => { if (eligible && permissions.includes(customerOrderReviewPermissions[action])) actions.push({ action, label }); };
    add("APPROVE_TEMPLATE", "Approve template", version?.status === "UNDER_REVIEW");
    add("PUBLISH_TEMPLATE", "Publish template", version?.status === "APPROVED" && version.approvedByUserId !== user.id);
    add("APPROVE_RECIPIENT_POLICY", "Approve recipient policy", policy?.status === "DRAFT");
    add("PREPARE_ROUTE", "Prepare delivery route", !routeVersion && version?.status === "PUBLISHED" && policy?.status === "APPROVED");
    add("APPROVE_ROUTE", "Approve delivery route", routeVersion?.status === "DRAFT");
    add("ACTIVATE_ROUTE", "Activate future order updates", routeVersion?.status === "APPROVED" && routeVersion.approvedByUserId !== user.id);
    return { eventType: definition.eventType, label: definition.eventType.replaceAll("_", " ").toLowerCase(), recipientSummary: definition.recipientSummary, title: version?.subjectTemplate ?? "", body: version?.plainTextTemplate ?? "", templateStatus: version?.status ?? "NOT_PREPARED", recipientPolicyStatus: policy?.status ?? "NOT_PREPARED", routeStatus: routeVersion?.status ?? "NOT_PREPARED", activatedAt: firstActivation?.activatedAt?.toISOString() ?? null, actions, publisherMustDiffer: version?.status === "APPROVED" && version.approvedByUserId === user.id, activatorMustDiffer: routeVersion?.status === "APPROVED" && routeVersion.approvedByUserId === user.id };
  }));
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Notification administration" title="Order, payment and refund updates" description="Review the prepared copy and recipient policy, publish the template, then prepare, approve and activate the delivery route. Publication and activation each require a different administrator from the approver." />
    <p className="mb-6">Activation applies to new source events. Historical events receive no backfill. Guest email requires contact verification; guests have no account inbox. Email preferences, suppression and quiet hours apply.</p>
    <CustomerOrderNotificationReview rows={rows} locked={!NOTIFICATION_PRODUCTION_VALIDATION_APPROVED} />
  </ProtectedPageFrame>;
}
