import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createNotificationAuthority } from "./authority";
import { NotificationService } from "./notification.service";
import { NotificationPolicyError } from "./contracts";
import { renderNotificationTemplate, type TemplateVariable } from "./template-renderer";
import { assertNotificationProductionReady } from "./production-readiness";
import { requiredDomainDefinition, requiredDomainNotificationDefinitions } from "./required-domain-definitions";
import { resolveRequiredDomainPayload } from "./required-domain-payload";
import { appendRequiredDomainNotificationIntents } from "./required-domain-intake";

function boundedLimit(limit: number) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error("Invalid notification batch size.");
  return Math.min(limit, 200);
}

/** Only approved, supported customer-order events after initial route activation. */
export async function listPendingCustomerOrderIntents(limit: number) {
  const supported = Prisma.join(requiredDomainNotificationDefinitions.map((definition) => Prisma.sql`(${definition.sourceAuthority}, ${definition.eventType})`));
  return prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT i.id FROM "NotificationEventIntent" i
    JOIN (VALUES ${supported}) AS supported(authority, type) ON supported.authority = i."sourceAuthority" AND supported.type = i."eventType"
    JOIN "NotificationEventRoute" r ON r."sourceAuthority" = i."sourceAuthority" AND r."sourceEventType" = i."eventType"
    WHERE EXISTS (SELECT 1 FROM "NotificationEventRouteVersion" v WHERE v."routeId" = r.id AND v.status = 'ACTIVE')
      AND i."createdAt" >= (SELECT min(v."activatedAt") FROM "NotificationEventRouteVersion" v WHERE v."routeId" = r.id AND v."activatedAt" IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM "NotificationSourceReceipt" s WHERE s."sourceAuthority" = i."sourceAuthority" AND s."sourceEventId" = i."operationId" AND s.status IN ('CONSUMED', 'RECONCILIATION_REQUIRED'))
    ORDER BY i."createdAt", i.id LIMIT ${boundedLimit(limit)}
  `);
}

/** Called inside one transaction, including the receipt, message, inbox and deliveries. */
export async function publishCustomerOrderIntent(db: Prisma.TransactionClient, intentId: string) {
  const intent = await db.notificationEventIntent.findUniqueOrThrow({ where: { id: intentId } });
  if (!requiredDomainDefinition(intent.sourceAuthority, intent.eventType)) throw new NotificationPolicyError("CLIENT_NOTIFICATION_SOURCE_NOT_SUPPORTED");
  const route = await db.notificationEventRoute.findUnique({ where: { sourceAuthority_sourceEventType: { sourceAuthority: intent.sourceAuthority, sourceEventType: intent.eventType } } });
  const routeVersion = route ? await db.notificationEventRouteVersion.findFirst({ where: { routeId: route.id, status: "ACTIVE" } }) : null;
  const firstActivation = route ? await db.notificationEventRouteVersion.findFirst({ where: { routeId: route.id, activatedAt: { not: null } }, orderBy: { activatedAt: "asc" } }) : null;
  if (!routeVersion || !firstActivation?.activatedAt || intent.createdAt < firstActivation.activatedAt) return "SKIPPED" as const;
  const channels = (routeVersion.channelPolicy as { channels?: unknown }).channels;
  if (!Array.isArray(channels) || !channels.length || channels.some((channel) => !["IN_APP", "EMAIL"].includes(channel))) throw new NotificationPolicyError("CLIENT_NOTIFICATION_CHANNEL_NOT_SUPPORTED");
  const authority = createNotificationAuthority(db, new Map());
  let payload: Record<string, unknown>;
  try { payload = await resolveRequiredDomainPayload(db, intent); }
  catch (error) {
    if (!(error instanceof NotificationPolicyError) || error.code !== "CLIENT_NOTIFICATION_SOURCE_EVIDENCE_INVALID") throw error;
    const intake = await authority.intake.intake({ sourceAuthority: intent.sourceAuthority, sourceEventId: intent.operationId, sourceEventType: intent.eventType, aggregateReference: intent.aggregateReference, payload: { invalidSourceEvidence: true }, occurredAt: intent.createdAt });
    if (intake.receipt.status === "RECONCILIATION_REQUIRED") return "SKIPPED" as const;
    await authority.reconciliation.open({ reason: error.code, sourceReceiptId: intake.receipt.id, safeSummary: "Canonical notification source evidence is missing or inconsistent." });
    await db.notificationSourceReceipt.update({ where: { id: intake.receipt.id }, data: { status: "RECONCILIATION_REQUIRED" } });
    return "RECONCILIATION" as const;
  }
  const intake = await authority.intake.intake({ sourceAuthority: intent.sourceAuthority, sourceEventId: intent.operationId, sourceEventType: intent.eventType, aggregateReference: intent.aggregateReference, payload, occurredAt: intent.createdAt });
  if (intake.receipt.status === "CONSUMED") return "SKIPPED" as const;
  const fanout = await authority.intake.fanout({ receiptId: intake.receipt.id, payload });
  if (fanout.reconciliationRequired) return "RECONCILIATION" as const;
  const message = fanout.message;
  if (!message) throw new NotificationPolicyError("CLIENT_NOTIFICATION_MESSAGE_MISSING");
  const recipient = fanout.recipient;
  if (!recipient || recipient.userId !== message.recipientUserId) throw new NotificationPolicyError("CLIENT_NOTIFICATION_RECIPIENT_MISMATCH");
  const [template, variables, category] = await Promise.all([
    db.notificationTemplateVersion.findUniqueOrThrow({ where: { id: message.templateVersionId } }),
    db.notificationTemplateVariable.findMany({ where: { templateVersionId: message.templateVersionId } }),
    db.notificationCategory.findUniqueOrThrow({ where: { key: message.categoryKey } }),
  ]);
  if (template.status !== "PUBLISHED" || template.purpose !== "TRANSACTIONAL" || category.purpose !== template.purpose) throw new NotificationPolicyError("CLIENT_NOTIFICATION_TEMPLATE_NOT_SUPPORTED");
  const values = Object.fromEntries(variables.map((variable) => [variable.name, payload[variable.name as keyof typeof payload]]));
  const expiresAt = routeVersion.expiryMinutes ? new Date(intent.createdAt.getTime() + routeVersion.expiryMinutes * 60_000) : null;
  const service = new NotificationService(db);
  for (const channel of new Set(channels as ("IN_APP" | "EMAIL")[])) {
    const render = (text: string) => renderNotificationTemplate({ template: text, variables: variables as TemplateVariable[], values, channel, sensitivity: template.sensitivity, actionRoute: template.actionRoute ?? undefined });
    const title = render((channel === "EMAIL" ? template.subjectTemplate : template.titleTemplate) ?? "KT Couriers order update");
    if (!template.plainTextTemplate) throw new NotificationPolicyError("NOTIFICATION_CHANNEL_TEMPLATE_NOT_CONFIGURED");
    const body = render(template.plainTextTemplate);
    const suppressed = await authority.suppressions.isSuppressed({ userId: message.recipientUserId, channel, purpose: message.purpose });
    const eligibility = recipient.roleProjection === "GUEST_CHECKOUT_CONTACT" && channel === "IN_APP"
      ? { state: "BLOCKED" as const, reason: "GUEST_HAS_NO_ACCOUNT_INBOX" }
      : await authority.preferences.evaluate({ userId: message.recipientUserId, category, channel, suppressed, verifiedDestination: channel === "IN_APP" || recipient.verifiedEmail, routeQuietHoursBypass: routeVersion.quietHoursBypass, routeDigestMode: routeVersion.digestMode });
    const blocked = eligibility.state === "BLOCKED" || eligibility.state === "DIGEST";
    const delivery = await service.createDelivery({ messageId: message.id, recipientUserId: message.recipientUserId, channel, purpose: message.purpose, verifiedDestination: !blocked, renderedTitle: title, renderedBody: body, actionRoute: template.actionRoute, expiresAt });
    if (blocked) await db.notificationDelivery.update({ where: { id: delivery.id }, data: { status: "ELIGIBILITY_BLOCKED", eligibilityReason: eligibility.state === "DIGEST" ? "DIGEST_NOT_CONFIGURED" : eligibility.reason } });
    else if (channel === "IN_APP") await service.createInboxItem({ messageId: message.id, ownerUserId: message.recipientUserId, title, body, actionRoute: template.actionRoute, expiresAt });
  }
  await db.notificationMessage.update({ where: { id: message.id }, data: { expiresAt } });
  return "PUBLISHED" as const;
}

export async function consumeCustomerOrderNotifications(limit: number) {
  assertNotificationProductionReady();
  await prisma.$transaction((tx) => appendRequiredDomainNotificationIntents(tx, boundedLimit(limit)));
  const candidates = await listPendingCustomerOrderIntents(limit);
  const result = { itemsExamined: candidates.length, itemsClaimed: 0, itemsCompleted: 0, itemsSkipped: 0, itemsRetried: 0, itemsReconciled: 0 };
  for (const candidate of candidates) {
    try {
      const outcome = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${candidate.id})::bigint)`);
        return publishCustomerOrderIntent(tx, candidate.id);
      }, { timeout: 15_000 });
      if (outcome === "PUBLISHED") result.itemsCompleted++;
      else if (outcome === "RECONCILIATION") result.itemsReconciled++;
      else result.itemsSkipped++;
    } catch { result.itemsRetried++; }
  }
  result.itemsClaimed = result.itemsCompleted + result.itemsReconciled;
  return result;
}
