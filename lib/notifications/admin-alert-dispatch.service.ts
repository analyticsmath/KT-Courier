import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { resolveNotificationProductionComposition } from "./composition-root";
import type { NotificationProvider, ProviderSendResult } from "./providers";
import {
  ADMIN_ALERT_EVENT_TYPES,
  activeRecipientsForAdminAlertEvent,
  getAdminAlertAdminPath,
  getAdminAlertEventLabel,
  isValidConfiguredNotificationEmail,
  parseAdminAlertRecipients,
  type AdminAlertEventType,
  type AdminAlertRecipientConfig,
  type AdminAlertRoleScope,
} from "@/lib/settings/admin-alert-recipient-policy";
import { EmailTemplateType } from "@/types/db";

const SAFE_META_FORBIDDEN_KEY =
  /email|phone|password|secret|token|auth|card|pin|otp|address|ip/i;
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const MAX_SAFE_TEXT = 240;

export type AdminAlertMetadata = Readonly<
  Record<string, string | number | boolean | null | undefined>
>;

export interface AdminAlertEventInput {
  readonly eventType: AdminAlertEventType;
  readonly aggregateReference: string;
  readonly title: string;
  readonly summary: string;
  readonly adminPath?: string;
  readonly relatedOrderId?: string;
  readonly metadata?: AdminAlertMetadata;
  readonly details?: AdminAlertMetadata;
}

export interface AdminAlertDispatchResult {
  readonly eventOperationId: string;
  readonly adminPath: string;
  readonly activeRecipientCount: number;
  /** Number of emails accepted by the provider on this invocation (PROVIDER_ACCEPTED). */
  readonly sentCount: number;
  readonly acceptedCount: number;
  readonly failedCount: number;
  readonly cancelledByPolicyCount: number;
  readonly deduplicatedCount: number;
}

export type AdminAlertDeliveryStatus =
  | "PENDING"
  | "PROVIDER_ACCEPTED"
  | "DELIVERED"
  | "BOUNCED"
  | "COMPLAINED"
  | "FAILED"
  | "CANCELLED_BY_POLICY"
  | "SENT"; // Legacy historical status read compatibility

type SafeDeliveryPayload = {
  kind: "RECIPIENT_DELIVERY";
  eventType: AdminAlertEventType;
  aggregateReference: string;
  adminPath: string;
  title: string;
  summary: string;
  recipientDigest: string;
  roleScope?: AdminAlertRoleScope;
  emailLogId: string;
  deliveryStatus: AdminAlertDeliveryStatus;
  eligibilityStatus?: "ELIGIBLE" | "ELIGIBILITY_BLOCKED";
  eligibilityReason?: string | null;
  inboxDeliveryStatus?:
    | "UNKNOWN_PENDING_PROVIDER_RECEIPT"
    | "DELIVERED"
    | "BOUNCED"
    | "COMPLAINED"
    | "DEFERRED"
    | "CANCELLED_BY_POLICY";
  retryCount: number;
  nextAttemptAt: string | null;
  providerMessageReference: string | null;
  providerReceiptId?: string | null;
  lastFailureCode: string | null;
  sentAt: string | null;
  providerAcceptedAt?: string | null;
  deliveredAt?: string | null;
  policyCancelledAt?: string | null;
  policyChangedDuringInFlightSend?: boolean;
};

const NON_RETRYABLE_DELIVERY_STATUSES = new Set<string>([
  "SENT",
  "PROVIDER_ACCEPTED",
  "DELIVERED",
  "BOUNCED",
  "COMPLAINED",
  "CANCELLED_BY_POLICY",
]);

function sanitizeSafeText(value: string, maxLength = MAX_SAFE_TEXT): string {
  return value
    .replace(EMAIL_PATTERN, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function sanitizeAdminMetadata(
  metadata: AdminAlertMetadata | undefined,
): Record<string, string | number | boolean | null> {
  if (!metadata) return {};
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, raw] of Object.entries(metadata)) {
    if (!key || SAFE_META_FORBIDDEN_KEY.test(key) || raw === undefined) continue;
    if (typeof raw === "string") {
      result[key] = sanitizeSafeText(raw, 120);
    } else if (
      typeof raw === "number" ||
      typeof raw === "boolean" ||
      raw === null
    ) {
      result[key] = raw;
    }
  }
  return result;
}

function resolveTemplateType(eventType: AdminAlertEventType): EmailTemplateType {
  if (
    eventType === "PARCEL_ORDER_PAID" ||
    eventType === "MARKETPLACE_ORDER_PAID"
  ) {
    return EmailTemplateType.ADMIN_NEW_ORDER;
  }
  return EmailTemplateType.ADMIN_CONTACT_MESSAGE;
}

function buildAdminAbsoluteLink(adminPath: string): string {
  const base =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  const normalizedPath = adminPath.startsWith("/") ? adminPath : `/${adminPath}`;
  return base ? `${base.replace(/\/+$/, "")}${normalizedPath}` : normalizedPath;
}

function normalizeEmailDigest(email: string): string {
  return createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 16);
}

export function buildAdminAlertEventOperationId(
  eventType: AdminAlertEventType,
  aggregateReference: string,
): string {
  return `admin-alert:${eventType}:${aggregateReference}`;
}

export function buildAdminAlertDeliveryOperationId(
  eventType: AdminAlertEventType,
  aggregateReference: string,
  recipientEmail: string,
): string {
  return `admin-alert-delivery:${eventType}:${aggregateReference}:${normalizeEmailDigest(recipientEmail)}`;
}

function renderAdminAlertEmail(input: {
  eventType: AdminAlertEventType;
  aggregateReference: string;
  title: string;
  summary: string;
  adminPath: string;
}): { subject: string; body: string; htmlBody: string } {
  const eventLabel = getAdminAlertEventLabel(input.eventType);
  const safeTitle = sanitizeSafeText(input.title, 140);
  const safeSummary = sanitizeSafeText(input.summary, 240);
  const link = buildAdminAbsoluteLink(input.adminPath);
  const subject = `[KT Admin Alert] ${eventLabel}: ${safeTitle}`;
  const body = [
    `${eventLabel}`,
    `Title: ${safeTitle}`,
    `Reference: ${sanitizeSafeText(input.aggregateReference, 120)}`,
    `Details: ${safeSummary}`,
    `Admin path: ${input.adminPath}`,
    `Open link: ${link}`,
  ].join("\n");
  const escaped = (text: string) =>
    text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const htmlBody = [
    `<h2>${escaped(eventLabel)}</h2>`,
    `<p><strong>${escaped(safeTitle)}</strong></p>`,
    `<p>${escaped(safeSummary)}</p>`,
    `<p>Reference: <code>${escaped(sanitizeSafeText(input.aggregateReference, 120))}</code></p>`,
    `<p><a href="${escaped(link)}">Review in Admin (${escaped(input.adminPath)})</a></p>`,
  ].join("");
  return { subject, body, htmlBody };
}

function resolveProductionEmailProvider(): NotificationProvider | null {
  try {
    const composition = resolveNotificationProductionComposition();
    return composition.providers.get("EMAIL") ?? null;
  } catch {
    return null;
  }
}

export async function recordAdminAlertIntentInTx(
  db: Partial<Pick<Prisma.TransactionClient, "notificationEventIntent">>,
  input: AdminAlertEventInput,
) {
  const intentDelegate = db?.notificationEventIntent;
  if (!intentDelegate || typeof intentDelegate.upsert !== "function") {
    return null;
  }
  const adminPath = input.adminPath ?? getAdminAlertAdminPath(input.eventType);
  const operationId = buildAdminAlertEventOperationId(
    input.eventType,
    input.aggregateReference,
  );
  return intentDelegate.upsert({
    where: { operationId },
    update: {},
    create: {
      sourceAuthority: "ADMIN_ALERT",
      eventType: input.eventType,
      aggregateReference: sanitizeSafeText(input.aggregateReference, 120),
      operationId,
      safePayload: {
        kind: "DOMAIN_EVENT",
        eventType: input.eventType,
        aggregateReference: sanitizeSafeText(input.aggregateReference, 120),
        adminPath,
        title: sanitizeSafeText(input.title, 140),
        summary: sanitizeSafeText(input.summary, 240),
        metadata: sanitizeAdminMetadata(input.metadata ?? input.details),
        dispatchedAt: null,
      } satisfies Prisma.InputJsonValue,
    },
  });
}

async function loadConfiguredActiveRecipients(
  db: typeof prisma,
  eventType: AdminAlertEventType,
): Promise<AdminAlertRecipientConfig[]> {
  const setting = await db.systemSetting.findUnique({
    where: { key: "notifications.admin_alert_recipients" },
    select: { value: true },
  });
  if (!setting) return [];
  const parsed = parseAdminAlertRecipients(setting.value);
  if (!parsed) return [];
  const filtered = activeRecipientsForAdminAlertEvent(parsed, eventType);
  const seen = new Set<string>();
  return filtered.filter((recipient) => {
    const key = recipient.email.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function roleScopePermitsPrior(
  currentScope: AdminAlertRoleScope,
  dispatchedScope: AdminAlertRoleScope,
): boolean {
  if (currentScope === "ALL") return true;
  return currentScope === dispatchedScope;
}

export type RecipientEligibilityResolution =
  | Readonly<{
      eligible: true;
      recipient: AdminAlertRecipientConfig;
      effectiveRoleScope: AdminAlertRoleScope;
    }>
  | Readonly<{
      eligible: false;
      reasonCode:
        | "INVALID_RECIPIENT_EMAIL"
        | "RECIPIENT_POLICY_NOT_CONFIGURED"
        | "RECIPIENT_DELETED"
        | "RECIPIENT_DISABLED"
        | "EVENT_UNSUBSCRIBED"
        | "RECIPIENT_ROLE_SCOPE_CHANGED"
        | "RECIPIENT_USER_AUTHORITY_REVOKED"
        | "RECIPIENT_ROLE_SCOPE_USER_MISMATCH";
    }>;

/**
 * Single authoritative check resolving current recipient policy AND live User
 * authorization before ANY initial send or retry. Historical queued/failed intents
 * or EmailLog addresses never confer authority by themselves.
 */
export async function resolveRecipientCurrentEligibility(
  db: typeof prisma,
  input: Readonly<{
    recipientEmail: string;
    eventType: AdminAlertEventType;
    dispatchedRoleScope?: AdminAlertRoleScope | null;
  }>,
): Promise<RecipientEligibilityResolution> {
  const normalizedEmail = input.recipientEmail.trim().toLowerCase();
  if (!isValidConfiguredNotificationEmail(normalizedEmail)) {
    return { eligible: false, reasonCode: "INVALID_RECIPIENT_EMAIL" };
  }

  const setting = await db.systemSetting.findUnique({
    where: { key: "notifications.admin_alert_recipients" },
    select: { value: true },
  });
  const parsed = setting ? parseAdminAlertRecipients(setting.value) : null;
  if (!parsed) {
    return { eligible: false, reasonCode: "RECIPIENT_POLICY_NOT_CONFIGURED" };
  }

  const configured = parsed.find((entry) => entry.email === normalizedEmail);
  if (!configured) {
    return { eligible: false, reasonCode: "RECIPIENT_DELETED" };
  }
  if (!configured.active) {
    return { eligible: false, reasonCode: "RECIPIENT_DISABLED" };
  }
  if (!configured.events.includes(input.eventType)) {
    return { eligible: false, reasonCode: "EVENT_UNSUBSCRIBED" };
  }

  const currentScope: AdminAlertRoleScope = configured.roleScope ?? "ALL";
  if (
    input.dispatchedRoleScope &&
    !roleScopePermitsPrior(currentScope, input.dispatchedRoleScope)
  ) {
    return { eligible: false, reasonCode: "RECIPIENT_ROLE_SCOPE_CHANGED" };
  }

  // If this operational address is bound to a platform user account, enforce live
  // active status and admin role scope dynamically before sending.
  if (typeof db.user?.findFirst === "function") {
    const user = await db.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { id: true, role: true, status: true },
    });
    if (user) {
      if (
        user.status !== "ACTIVE" ||
        !["ADMIN", "SUPER_ADMIN"].includes(user.role)
      ) {
        return {
          eligible: false,
          reasonCode: "RECIPIENT_USER_AUTHORITY_REVOKED",
        };
      }
      if (currentScope === "ADMIN" && user.role !== "ADMIN") {
        return {
          eligible: false,
          reasonCode: "RECIPIENT_ROLE_SCOPE_USER_MISMATCH",
        };
      }
      if (currentScope === "SUPER_ADMIN" && user.role !== "SUPER_ADMIN") {
        return {
          eligible: false,
          reasonCode: "RECIPIENT_ROLE_SCOPE_USER_MISMATCH",
        };
      }
    }
  }

  return {
    eligible: true,
    recipient: configured,
    effectiveRoleScope: currentScope,
  };
}

async function cancelDeliveryByPolicy(
  db: typeof prisma,
  input: Readonly<{
    deliveryOperationId: string;
    emailLogId: string;
    recipientEmail: string;
    eventType: AdminAlertEventType;
    aggregateReference: string;
    adminPath: string;
    title: string;
    summary: string;
    priorRetryCount: number;
    priorDeliveryStatus: string;
    roleScope?: AdminAlertRoleScope;
    reasonCode: string;
  }>,
): Promise<void> {
  const now = new Date();
  const payload: SafeDeliveryPayload = {
    kind: "RECIPIENT_DELIVERY",
    eventType: input.eventType,
    aggregateReference: sanitizeSafeText(input.aggregateReference, 120),
    adminPath: input.adminPath,
    title: sanitizeSafeText(input.title, 140),
    summary: sanitizeSafeText(input.summary, 240),
    recipientDigest: normalizeEmailDigest(input.recipientEmail),
    ...(input.roleScope ? { roleScope: input.roleScope } : {}),
    emailLogId: input.emailLogId,
    deliveryStatus: "CANCELLED_BY_POLICY",
    eligibilityStatus: "ELIGIBILITY_BLOCKED",
    eligibilityReason: input.reasonCode,
    inboxDeliveryStatus: "CANCELLED_BY_POLICY",
    retryCount: input.priorRetryCount,
    nextAttemptAt: null,
    providerMessageReference: null,
    lastFailureCode: `ELIGIBILITY_BLOCKED:${input.reasonCode}`,
    sentAt: null,
    policyCancelledAt: now.toISOString(),
  };

  await db.$transaction([
    db.emailLog.update({
      where: { id: input.emailLogId },
      data: {
        status: "FAILED",
        errorMessage: `ELIGIBILITY_BLOCKED:${input.reasonCode}`,
        sentAt: null,
      },
    }),
    db.notificationEventIntent.update({
      where: { operationId: input.deliveryOperationId },
      data: { safePayload: payload as unknown as Prisma.InputJsonValue },
    }),
    db.notificationAuditEvent.create({
      data: {
        publicReference: `naudit_${randomUUID()}`,
        eventType: "ADMIN_ALERT_DELIVERY_CANCELLED_BY_POLICY",
        entityReference: input.deliveryOperationId,
        safeEvidence: {
          eventType: input.eventType,
          recipientDigest: payload.recipientDigest,
          reasonCode: input.reasonCode,
          priorDeliveryStatus: input.priorDeliveryStatus,
          emailLogId: input.emailLogId,
        },
      },
    }),
  ]);
}

/**
 * Concurrency & policy-change race policy:
 *  1. We never hold a PostgreSQL lock across an external SMTP/HTTP provider call.
 *  2. Immediately before invoking `provider.send()`, we revalidate live policy
 *     in DB (`resolveRecipientCurrentEligibility`). Revoked/unsubscribed/changed
 *     recipients transition straight to `CANCELLED_BY_POLICY` / `ELIGIBILITY_BLOCKED`
 *     with zero provider calls.
 *  3. Once `provider.send()` returns:
 *     - If accepted by provider, we truthfully record `PROVIDER_ACCEPTED` +
 *       providerMessageReference (an externally accepted message cannot be
 *       un-accepted locally). We recheck policy post-send and record an audit
 *       event (`ADMIN_ALERT_POLICY_CHANGED_IN_FLIGHT`) if policy changed mid-flight.
 *     - If rejected/failed AND policy was revoked mid-flight, we immediately write
 *       `CANCELLED_BY_POLICY` instead of scheduling a retry.
 */
async function attemptSingleRecipientDelivery(input: {
  db: typeof prisma;
  provider: NotificationProvider | null;
  deliveryOperationId: string;
  emailLogId: string;
  recipientEmail: string;
  eventType: AdminAlertEventType;
  aggregateReference: string;
  adminPath: string;
  title: string;
  summary: string;
  priorRetryCount: number;
  priorDeliveryStatus?: string;
  dispatchedRoleScope?: AdminAlertRoleScope | null;
}): Promise<{ delivered: boolean; cancelledByPolicy: boolean }> {
  const preFlight = await resolveRecipientCurrentEligibility(input.db, {
    recipientEmail: input.recipientEmail,
    eventType: input.eventType,
    dispatchedRoleScope: input.dispatchedRoleScope,
  });
  if (!preFlight.eligible) {
    await cancelDeliveryByPolicy(input.db, {
      deliveryOperationId: input.deliveryOperationId,
      emailLogId: input.emailLogId,
      recipientEmail: input.recipientEmail,
      eventType: input.eventType,
      aggregateReference: input.aggregateReference,
      adminPath: input.adminPath,
      title: input.title,
      summary: input.summary,
      priorRetryCount: input.priorRetryCount,
      priorDeliveryStatus: input.priorDeliveryStatus ?? "PENDING",
      roleScope: input.dispatchedRoleScope ?? undefined,
      reasonCode: preFlight.reasonCode,
    });
    return { delivered: false, cancelledByPolicy: true };
  }

  const { subject, body, htmlBody } = renderAdminAlertEmail(input);
  let result: ProviderSendResult;
  if (!input.provider) {
    result = {
      accepted: false,
      failureClass: "CONFIGURATION_FAILURE",
      safeCode: "EMAIL_PROVIDER_NOT_CONFIGURED",
      retryAfterSeconds: 300,
    };
  } else {
    try {
      result = await input.provider.send({
        destination: input.recipientEmail,
        subject,
        body,
        htmlBody,
        idempotencyKey: input.deliveryOperationId,
      });
    } catch {
      result = {
        accepted: false,
        failureClass: "TRANSIENT_NETWORK",
        safeCode: "EMAIL_PROVIDER_CALL_FAILED",
        retryAfterSeconds: 300,
      };
    }
  }

  const postCheck = await resolveRecipientCurrentEligibility(input.db, {
    recipientEmail: input.recipientEmail,
    eventType: input.eventType,
    dispatchedRoleScope: input.dispatchedRoleScope,
  });

  const now = new Date();
  if (result.accepted && result.providerMessageReference) {
    const payload: SafeDeliveryPayload = {
      kind: "RECIPIENT_DELIVERY",
      eventType: input.eventType,
      aggregateReference: sanitizeSafeText(input.aggregateReference, 120),
      adminPath: input.adminPath,
      title: sanitizeSafeText(input.title, 140),
      summary: sanitizeSafeText(input.summary, 240),
      recipientDigest: normalizeEmailDigest(input.recipientEmail),
      roleScope: preFlight.effectiveRoleScope,
      emailLogId: input.emailLogId,
      deliveryStatus: "PROVIDER_ACCEPTED",
      eligibilityStatus: "ELIGIBLE",
      inboxDeliveryStatus: "UNKNOWN_PENDING_PROVIDER_RECEIPT",
      retryCount: input.priorRetryCount,
      nextAttemptAt: null,
      providerMessageReference: result.providerMessageReference,
      lastFailureCode: null,
      sentAt: now.toISOString(),
      providerAcceptedAt: now.toISOString(),
      ...(postCheck.eligible ? {} : { policyChangedDuringInFlightSend: true }),
    };

    const ops: Prisma.PrismaPromise<unknown>[] = [
      input.db.emailLog.update({
        where: { id: input.emailLogId },
        data: {
          status: "SENT",
          providerMessageId: result.providerMessageReference,
          errorMessage: null,
          sentAt: now,
        },
      }),
      input.db.notificationEventIntent.update({
        where: { operationId: input.deliveryOperationId },
        data: { safePayload: payload as unknown as Prisma.InputJsonValue },
      }),
    ];
    if (!postCheck.eligible) {
      ops.push(
        input.db.notificationAuditEvent.create({
          data: {
            publicReference: `naudit_${randomUUID()}`,
            eventType: "ADMIN_ALERT_POLICY_CHANGED_IN_FLIGHT",
            entityReference: input.deliveryOperationId,
            safeEvidence: {
              eventType: input.eventType,
              recipientDigest: payload.recipientDigest,
              providerMessageReference: result.providerMessageReference,
              postSendReasonCode: postCheck.reasonCode,
            },
          },
        }),
      );
    }
    await input.db.$transaction(ops);
    return { delivered: true, cancelledByPolicy: false };
  }

  if (!postCheck.eligible) {
    await cancelDeliveryByPolicy(input.db, {
      deliveryOperationId: input.deliveryOperationId,
      emailLogId: input.emailLogId,
      recipientEmail: input.recipientEmail,
      eventType: input.eventType,
      aggregateReference: input.aggregateReference,
      adminPath: input.adminPath,
      title: input.title,
      summary: input.summary,
      priorRetryCount: input.priorRetryCount,
      priorDeliveryStatus: input.priorDeliveryStatus ?? "FAILED",
      roleScope: input.dispatchedRoleScope ?? preFlight.effectiveRoleScope,
      reasonCode: postCheck.reasonCode,
    });
    return { delivered: false, cancelledByPolicy: true };
  }

  const safeFailureCode = sanitizeSafeText(
    result.safeCode || result.failureClass || "EMAIL_DELIVERY_FAILED",
    80,
  );
  const backoffMs = Math.max(60, result.retryAfterSeconds ?? 300) * 1000;
  const nextAttemptAt = new Date(now.getTime() + backoffMs).toISOString();
  const payload: SafeDeliveryPayload = {
    kind: "RECIPIENT_DELIVERY",
    eventType: input.eventType,
    aggregateReference: sanitizeSafeText(input.aggregateReference, 120),
    adminPath: input.adminPath,
    title: sanitizeSafeText(input.title, 140),
    summary: sanitizeSafeText(input.summary, 240),
    recipientDigest: normalizeEmailDigest(input.recipientEmail),
    roleScope: preFlight.effectiveRoleScope,
    emailLogId: input.emailLogId,
    deliveryStatus: "FAILED",
    eligibilityStatus: "ELIGIBLE",
    retryCount: input.priorRetryCount + 1,
    nextAttemptAt,
    providerMessageReference: null,
    lastFailureCode: safeFailureCode,
    sentAt: null,
  };
  await input.db.$transaction([
    input.db.emailLog.update({
      where: { id: input.emailLogId },
      data: {
        status: "FAILED",
        errorMessage: safeFailureCode,
      },
    }),
    input.db.notificationEventIntent.update({
      where: { operationId: input.deliveryOperationId },
      data: { safePayload: payload as unknown as Prisma.InputJsonValue },
    }),
  ]);
  return { delivered: false, cancelledByPolicy: false };
}

async function markDomainAlertEventDispatched(
  db: typeof prisma,
  eventIntent: { id: string; safePayload: Prisma.JsonValue } | null,
) {
  if (
    !eventIntent ||
    typeof db.notificationEventIntent?.update !== "function"
  ) {
    return;
  }
  const existingPayload =
    eventIntent.safePayload &&
    typeof eventIntent.safePayload === "object" &&
    !Array.isArray(eventIntent.safePayload)
      ? (eventIntent.safePayload as Record<string, unknown>)
      : null;
  if (!existingPayload || existingPayload.dispatchedAt) return;
  try {
    await db.notificationEventIntent.update({
      where: { id: eventIntent.id },
      data: {
        safePayload: {
          ...existingPayload,
          dispatchedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
  } catch {
    // Non-fatal: partial mock DBs in unit tests may omit update on DOMAIN_EVENT.
  }
}

export async function dispatchAdminAlertsForEvent(
  input: AdminAlertEventInput,
  options?: {
    providerOverride?: NotificationProvider | null;
    db?: typeof prisma;
  },
): Promise<AdminAlertDispatchResult> {
  const db = options?.db ?? prisma;
  const adminPath = input.adminPath ?? getAdminAlertAdminPath(input.eventType);
  const eventIntent = await recordAdminAlertIntentInTx(db, {
    ...input,
    adminPath,
  });
  const eventOperationId =
    eventIntent?.operationId ??
    buildAdminAlertEventOperationId(input.eventType, input.aggregateReference);
  const recipients = await loadConfiguredActiveRecipients(db, input.eventType);
  if (recipients.length === 0) {
    await markDomainAlertEventDispatched(db, eventIntent);
    return {
      eventOperationId,
      adminPath,
      activeRecipientCount: 0,
      sentCount: 0,
      acceptedCount: 0,
      failedCount: 0,
      cancelledByPolicyCount: 0,
      deduplicatedCount: 0,
    };
  }

  const provider =
    options && "providerOverride" in options
      ? (options.providerOverride ?? null)
      : resolveProductionEmailProvider();

  let acceptedCount = 0;
  let failedCount = 0;
  let cancelledByPolicyCount = 0;
  let deduplicatedCount = 0;

  for (const recipient of recipients) {
    const email = recipient.email.trim().toLowerCase();
    const roleScope: AdminAlertRoleScope = recipient.roleScope ?? "ALL";
    const deliveryOperationId = buildAdminAlertDeliveryOperationId(
      input.eventType,
      input.aggregateReference,
      email,
    );
    const existingIntent = await db.notificationEventIntent.findUnique({
      where: { operationId: deliveryOperationId },
    });
    const existingPayload =
      existingIntent?.safePayload &&
      typeof existingIntent.safePayload === "object" &&
      !Array.isArray(existingIntent.safePayload)
        ? (existingIntent.safePayload as Partial<SafeDeliveryPayload>)
        : null;

    if (
      existingPayload?.deliveryStatus &&
      NON_RETRYABLE_DELIVERY_STATUSES.has(existingPayload.deliveryStatus)
    ) {
      deduplicatedCount += 1;
      continue;
    }

    let emailLogId =
      typeof existingPayload?.emailLogId === "string"
        ? existingPayload.emailLogId
        : null;

    if (!existingIntent || !emailLogId) {
      const rendered = renderAdminAlertEmail({
        eventType: input.eventType,
        aggregateReference: input.aggregateReference,
        title: input.title,
        summary: input.summary,
        adminPath,
      });
      const created = await db.$transaction(async (tx) => {
        const recheck = await tx.notificationEventIntent.findUnique({
          where: { operationId: deliveryOperationId },
        });
        if (recheck) return { existing: recheck, createdEmailLogId: null };
        const log = await tx.emailLog.create({
          data: {
            recipient: email,
            subject: rendered.subject,
            templateType: resolveTemplateType(input.eventType),
            status: "PENDING",
            relatedOrderId: input.relatedOrderId ?? null,
          },
          select: { id: true },
        });
        const initialPayload: SafeDeliveryPayload = {
          kind: "RECIPIENT_DELIVERY",
          eventType: input.eventType,
          aggregateReference: sanitizeSafeText(input.aggregateReference, 120),
          adminPath,
          title: sanitizeSafeText(input.title, 140),
          summary: sanitizeSafeText(input.summary, 240),
          recipientDigest: normalizeEmailDigest(email),
          roleScope,
          emailLogId: log.id,
          deliveryStatus: "PENDING",
          eligibilityStatus: "ELIGIBLE",
          retryCount: 0,
          nextAttemptAt: null,
          providerMessageReference: null,
          lastFailureCode: null,
          sentAt: null,
        };
        await tx.notificationEventIntent.create({
          data: {
            sourceAuthority: "ADMIN_ALERT",
            eventType: input.eventType,
            aggregateReference: sanitizeSafeText(input.aggregateReference, 120),
            operationId: deliveryOperationId,
            safePayload: initialPayload as unknown as Prisma.InputJsonValue,
          },
        });
        return { existing: null, createdEmailLogId: log.id };
      });
      if (created.existing) {
        const p = created.existing.safePayload as Partial<SafeDeliveryPayload> | null;
        if (
          p?.deliveryStatus &&
          NON_RETRYABLE_DELIVERY_STATUSES.has(p.deliveryStatus)
        ) {
          deduplicatedCount += 1;
          continue;
        }
        emailLogId = typeof p?.emailLogId === "string" ? p.emailLogId : null;
      } else {
        emailLogId = created.createdEmailLogId;
      }
    }

    if (!emailLogId) {
      failedCount += 1;
      continue;
    }

    const attempt = await attemptSingleRecipientDelivery({
      db,
      provider,
      deliveryOperationId,
      emailLogId,
      recipientEmail: email,
      eventType: input.eventType,
      aggregateReference: input.aggregateReference,
      adminPath,
      title: input.title,
      summary: input.summary,
      priorRetryCount: existingPayload?.retryCount ?? 0,
      priorDeliveryStatus: existingPayload?.deliveryStatus ?? "PENDING",
      dispatchedRoleScope: existingPayload?.roleScope ?? roleScope,
    });
    if (attempt.delivered) acceptedCount += 1;
    else if (attempt.cancelledByPolicy) cancelledByPolicyCount += 1;
    else failedCount += 1;
  }

  await markDomainAlertEventDispatched(db, eventIntent);

  return {
    eventOperationId,
    adminPath,
    activeRecipientCount: recipients.length,
    sentCount: acceptedCount,
    acceptedCount,
    failedCount,
    cancelledByPolicyCount,
    deduplicatedCount,
  };
}

export async function hasPendingAdminAlertWork(
  db: typeof prisma = prisma,
): Promise<boolean> {
  const deliveryRetry = await db.notificationEventIntent.findFirst({
    where: {
      sourceAuthority: "ADMIN_ALERT",
      operationId: { startsWith: "admin-alert-delivery:" },
      OR: [
        { safePayload: { path: ["deliveryStatus"], equals: "PENDING" } },
        { safePayload: { path: ["deliveryStatus"], equals: "FAILED" } },
      ],
    },
    select: { id: true },
  });
  if (deliveryRetry) return true;
  const recentDomain = await db.notificationEventIntent.findMany({
    where: {
      sourceAuthority: "ADMIN_ALERT",
      operationId: { startsWith: "admin-alert:" },
    },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: { safePayload: true },
  });
  return recentDomain.some((row) => {
    const p =
      row.safePayload &&
      typeof row.safePayload === "object" &&
      !Array.isArray(row.safePayload)
        ? (row.safePayload as { kind?: unknown; dispatchedAt?: unknown })
        : null;
    return p?.kind === "DOMAIN_EVENT" && p.dispatchedAt == null;
  });
}

export async function retryPendingAdminAlertDeliveries(options?: {
  limit?: number;
  now?: Date;
  providerOverride?: NotificationProvider | null;
  db?: typeof prisma;
}): Promise<{
  checked: number;
  sent: number;
  failed: number;
  cancelledByPolicy: number;
}> {
  const db = options?.db ?? prisma;
  const now = options?.now ?? new Date();
  const limit = Math.min(Math.max(options?.limit ?? 25, 1), 100);
  const provider =
    options && "providerOverride" in options
      ? (options.providerOverride ?? null)
      : resolveProductionEmailProvider();

  let checked = 0;
  let sent = 0;
  let failed = 0;
  let cancelledByPolicy = 0;

  // Sweep any committed DOMAIN_EVENT intents that did not complete post-commit
  // recipient fan-out (e.g., nested transactions or process crash after commit).
  const candidateDomainEvents = await db.notificationEventIntent.findMany({
    where: {
      sourceAuthority: "ADMIN_ALERT",
      operationId: { startsWith: "admin-alert:" },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit * 4, 200),
  });
  for (const domainIntent of candidateDomainEvents) {
    if (checked >= limit) break;
    const p =
      domainIntent.safePayload &&
      typeof domainIntent.safePayload === "object" &&
      !Array.isArray(domainIntent.safePayload)
        ? (domainIntent.safePayload as {
            kind?: unknown;
            eventType?: unknown;
            aggregateReference?: unknown;
            adminPath?: unknown;
            title?: unknown;
            summary?: unknown;
            metadata?: unknown;
            dispatchedAt?: unknown;
          })
        : null;
    if (
      !p ||
      p.kind !== "DOMAIN_EVENT" ||
      p.dispatchedAt != null ||
      typeof p.eventType !== "string" ||
      typeof p.aggregateReference !== "string" ||
      !ADMIN_ALERT_EVENT_TYPES.includes(p.eventType as AdminAlertEventType)
    ) {
      continue;
    }
    const dispatched = await dispatchAdminAlertsForEvent(
      {
        eventType: p.eventType as AdminAlertEventType,
        aggregateReference: p.aggregateReference,
        adminPath: typeof p.adminPath === "string" ? p.adminPath : undefined,
        title: typeof p.title === "string" ? p.title : domainIntent.eventType,
        summary:
          typeof p.summary === "string"
            ? p.summary
            : domainIntent.aggregateReference,
        metadata:
          p.metadata &&
          typeof p.metadata === "object" &&
          !Array.isArray(p.metadata)
            ? (p.metadata as Record<string, unknown>)
            : undefined,
      },
      { providerOverride: provider, db },
    );
    checked +=
      dispatched.acceptedCount +
      dispatched.failedCount +
      dispatched.cancelledByPolicyCount;
    sent += dispatched.acceptedCount;
    failed += dispatched.failedCount;
    cancelledByPolicy += dispatched.cancelledByPolicyCount;
  }

  const intents = await db.notificationEventIntent.findMany({
    where: {
      sourceAuthority: "ADMIN_ALERT",
      operationId: { startsWith: "admin-alert-delivery:" },
      OR: [
        {
          safePayload: {
            path: ["deliveryStatus"],
            equals: "FAILED",
          },
        },
        {
          safePayload: {
            path: ["deliveryStatus"],
            equals: "PENDING",
          },
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit * 4,
  });

  for (const intent of intents) {
    if (checked >= limit) break;
    const payload =
      intent.safePayload &&
      typeof intent.safePayload === "object" &&
      !Array.isArray(intent.safePayload)
        ? (intent.safePayload as Partial<SafeDeliveryPayload>)
        : null;
    if (
      !payload ||
      payload.kind !== "RECIPIENT_DELIVERY" ||
      !payload.deliveryStatus ||
      NON_RETRYABLE_DELIVERY_STATUSES.has(payload.deliveryStatus) ||
      !payload.emailLogId ||
      !payload.eventType
    ) {
      continue;
    }
    if (payload.nextAttemptAt && new Date(payload.nextAttemptAt) > now) {
      continue;
    }

    const log = await db.emailLog.findUnique({
      where: { id: payload.emailLogId },
      select: { id: true, recipient: true, status: true },
    });
    if (!log || log.status === "SENT") continue;

    checked += 1;
    const attempt = await attemptSingleRecipientDelivery({
      db,
      provider,
      deliveryOperationId: intent.operationId,
      emailLogId: log.id,
      recipientEmail: log.recipient,
      eventType: payload.eventType,
      aggregateReference: payload.aggregateReference ?? intent.aggregateReference,
      adminPath: payload.adminPath ?? getAdminAlertAdminPath(payload.eventType),
      title: payload.title ?? intent.eventType,
      summary: payload.summary ?? intent.aggregateReference,
      priorRetryCount: payload.retryCount ?? 0,
      priorDeliveryStatus: payload.deliveryStatus,
      dispatchedRoleScope: payload.roleScope ?? null,
    });
    if (attempt.delivered) sent += 1;
    else if (attempt.cancelledByPolicy) cancelledByPolicy += 1;
    else failed += 1;
  }

  return { checked, sent, failed, cancelledByPolicy };
}

export async function applyResendWebhookEventToAdminAlerts(
  input: Readonly<{
    emailId: string;
    receiptType: "ACCEPTED" | "DELIVERED" | "DEFERRED" | "BOUNCED" | "COMPLAINED";
    providerReceiptId: string;
    occurredAt?: Date;
    db?: typeof prisma;
  }>,
): Promise<{ updated: number }> {
  const db = input.db ?? prisma;
  const now = input.occurredAt ?? new Date();
  const matched = await db.notificationEventIntent.findMany({
    where: {
      sourceAuthority: "ADMIN_ALERT",
      operationId: { startsWith: "admin-alert-delivery:" },
      safePayload: {
        path: ["providerMessageReference"],
        equals: input.emailId,
      },
    },
  });

  if (matched.length === 0) return { updated: 0 };

  const statusByReceipt: Record<
    typeof input.receiptType,
    { deliveryStatus: AdminAlertDeliveryStatus; inboxStatus: SafeDeliveryPayload["inboxDeliveryStatus"] }
  > = {
    ACCEPTED: {
      deliveryStatus: "PROVIDER_ACCEPTED",
      inboxStatus: "UNKNOWN_PENDING_PROVIDER_RECEIPT",
    },
    DELIVERED: {
      deliveryStatus: "DELIVERED",
      inboxStatus: "DELIVERED",
    },
    DEFERRED: {
      deliveryStatus: "PROVIDER_ACCEPTED",
      inboxStatus: "DEFERRED",
    },
    BOUNCED: {
      deliveryStatus: "BOUNCED",
      inboxStatus: "BOUNCED",
    },
    COMPLAINED: {
      deliveryStatus: "COMPLAINED",
      inboxStatus: "COMPLAINED",
    },
  };

  const target = statusByReceipt[input.receiptType];
  const terminal = new Set(["DELIVERED", "BOUNCED", "COMPLAINED", "CANCELLED_BY_POLICY"]);
  let updated = 0;

  for (const intent of matched) {
    const existing =
      intent.safePayload &&
      typeof intent.safePayload === "object" &&
      !Array.isArray(intent.safePayload)
        ? (intent.safePayload as Partial<SafeDeliveryPayload>)
        : {};
    if (
      existing.deliveryStatus &&
      terminal.has(existing.deliveryStatus) &&
      existing.deliveryStatus !== target.deliveryStatus
    ) {
      continue;
    }

    const nextPayload: SafeDeliveryPayload = {
      ...(existing as SafeDeliveryPayload),
      deliveryStatus: target.deliveryStatus,
      inboxDeliveryStatus: target.inboxStatus,
      providerReceiptId: input.providerReceiptId,
      ...(input.receiptType === "DELIVERED"
        ? { deliveredAt: now.toISOString() }
        : {}),
      ...(input.receiptType === "BOUNCED" || input.receiptType === "COMPLAINED"
        ? { lastFailureCode: `RESEND_${input.receiptType}` }
        : {}),
    };

    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.notificationEventIntent.update({
        where: { id: intent.id },
        data: { safePayload: nextPayload as unknown as Prisma.InputJsonValue },
      }),
    ];
    if (
      (input.receiptType === "BOUNCED" || input.receiptType === "COMPLAINED") &&
      typeof existing.emailLogId === "string"
    ) {
      ops.push(
        db.emailLog.update({
          where: { id: existing.emailLogId },
          data: {
            status: "FAILED",
            errorMessage: `RESEND_${input.receiptType}`,
          },
        }),
      );
    }
    await db.$transaction(ops);
    updated += 1;
  }

  return { updated };
}

export async function emitAdminAlertNonBlocking(
  input: AdminAlertEventInput,
  options?: { providerOverride?: NotificationProvider | null; db?: typeof prisma },
): Promise<AdminAlertDispatchResult | null> {
  try {
    return await dispatchAdminAlertsForEvent(input, options);
  } catch {
    return null;
  }
}

export type AdminAlertOverviewItem = Readonly<{
  id: string;
  operationId: string;
  eventType: string;
  eventLabel: string;
  aggregateReference: string;
  title: string;
  summary: string;
  adminPath: string;
  createdAt: string;
  metadata: Record<string, string | number | boolean | null>;
}>;

export type AdminAlertDeliveryOverviewItem = Readonly<{
  id: string;
  operationId: string;
  eventType: string;
  eventLabel: string;
  aggregateReference: string;
  deliveryStatus: AdminAlertDeliveryStatus;
  inboxDeliveryStatus: string | null;
  eligibilityReason: string | null;
  retryCount: number;
  lastFailureCode: string | null;
  providerMessageReference: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}>;

const OVERVIEW_ALLOWED_FILTER_STATUSES = new Set<string>([
  "PENDING",
  "PROVIDER_ACCEPTED",
  "DELIVERED",
  "BOUNCED",
  "COMPLAINED",
  "FAILED",
  "CANCELLED_BY_POLICY",
  "SENT",
]);

export async function listAdminAlertOverview(options?: {
  eventType?: string | null;
  deliveryStatus?: string | null;
  limit?: number;
  db?: typeof prisma;
}) {
  const db = options?.db ?? prisma;
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 150);

  const countDeliveryStatus = (status: string) =>
    db.notificationEventIntent.count({
      where: {
        sourceAuthority: "ADMIN_ALERT",
        operationId: { startsWith: "admin-alert-delivery:" },
        safePayload: { path: ["deliveryStatus"], equals: status },
      },
    });

  const [
    setting,
    domainIntents,
    deliveryIntents,
    pendingCount,
    failedCount,
    providerAcceptedCount,
    legacySentCount,
    deliveredCount,
    bouncedCount,
    complainedCount,
    cancelledByPolicyCount,
  ] = await Promise.all([
    db.systemSetting.findUnique({
      where: { key: "notifications.admin_alert_recipients" },
      select: { value: true },
    }),
    db.notificationEventIntent.findMany({
      where: {
        sourceAuthority: "ADMIN_ALERT",
        operationId: { startsWith: "admin-alert:" },
        ...(options?.eventType ? { eventType: options.eventType } : {}),
      },
      orderBy: [{ createdAt: "desc" }],
      take: limit,
    }),
    db.notificationEventIntent.findMany({
      where: {
        sourceAuthority: "ADMIN_ALERT",
        operationId: { startsWith: "admin-alert-delivery:" },
        ...(options?.eventType ? { eventType: options.eventType } : {}),
        ...(options?.deliveryStatus &&
        OVERVIEW_ALLOWED_FILTER_STATUSES.has(options.deliveryStatus)
          ? {
              safePayload: {
                path: ["deliveryStatus"],
                equals: options.deliveryStatus,
              },
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }],
      take: limit,
    }),
    countDeliveryStatus("PENDING"),
    countDeliveryStatus("FAILED"),
    countDeliveryStatus("PROVIDER_ACCEPTED"),
    countDeliveryStatus("SENT"),
    countDeliveryStatus("DELIVERED"),
    countDeliveryStatus("BOUNCED"),
    countDeliveryStatus("COMPLAINED"),
    countDeliveryStatus("CANCELLED_BY_POLICY"),
  ]);

  const parsedRecipients = setting ? parseAdminAlertRecipients(setting.value) ?? [] : [];

  const events: AdminAlertOverviewItem[] = domainIntents.map((intent) => {
    const p =
      intent.safePayload && typeof intent.safePayload === "object" && !Array.isArray(intent.safePayload)
        ? (intent.safePayload as Record<string, unknown>)
        : {};
    const ev = intent.eventType as AdminAlertEventType;
    return {
      id: intent.id,
      operationId: intent.operationId,
      eventType: intent.eventType,
      eventLabel: getAdminAlertEventLabel(ev) ?? intent.eventType,
      aggregateReference: intent.aggregateReference,
      title: typeof p.title === "string" ? p.title : intent.eventType,
      summary: typeof p.summary === "string" ? p.summary : intent.aggregateReference,
      adminPath:
        typeof p.adminPath === "string" && p.adminPath.startsWith("/")
          ? p.adminPath
          : getAdminAlertAdminPath(ev) ?? "/admin/orders",
      createdAt: intent.createdAt.toISOString(),
      metadata:
        p.metadata && typeof p.metadata === "object" && !Array.isArray(p.metadata)
          ? (p.metadata as Record<string, string | number | boolean | null>)
          : {},
    };
  });

  const deliveries: AdminAlertDeliveryOverviewItem[] = deliveryIntents.map((intent) => {
    const p =
      intent.safePayload && typeof intent.safePayload === "object" && !Array.isArray(intent.safePayload)
        ? (intent.safePayload as Partial<SafeDeliveryPayload>)
        : {};
    const ev = intent.eventType as AdminAlertEventType;
    return {
      id: intent.id,
      operationId: intent.operationId,
      eventType: intent.eventType,
      eventLabel: getAdminAlertEventLabel(ev) ?? intent.eventType,
      aggregateReference: intent.aggregateReference,
      deliveryStatus: (p.deliveryStatus ?? "PENDING") as AdminAlertDeliveryStatus,
      inboxDeliveryStatus: typeof p.inboxDeliveryStatus === "string" ? p.inboxDeliveryStatus : null,
      eligibilityReason: typeof p.eligibilityReason === "string" ? p.eligibilityReason : null,
      retryCount: typeof p.retryCount === "number" ? p.retryCount : 0,
      lastFailureCode: typeof p.lastFailureCode === "string" ? p.lastFailureCode : null,
      providerMessageReference:
        typeof p.providerMessageReference === "string" ? p.providerMessageReference : null,
      sentAt: typeof p.sentAt === "string" ? p.sentAt : null,
      deliveredAt: typeof p.deliveredAt === "string" ? p.deliveredAt : null,
      createdAt: intent.createdAt.toISOString(),
    };
  });

  const acceptedTotal = providerAcceptedCount + legacySentCount;

  return {
    recipients: parsedRecipients,
    events,
    deliveries,
    counts: {
      pending: pendingCount,
      failed: failedCount,
      sent: acceptedTotal + deliveredCount,
      providerAccepted: acceptedTotal,
      delivered: deliveredCount,
      bounced: bouncedCount + complainedCount,
      cancelledByPolicy: cancelledByPolicyCount,
      activeAdminRecipients: parsedRecipients.filter(
        (r) => r.active && (!r.roleScope || r.roleScope === "ALL" || r.roleScope === "ADMIN"),
      ).length,
      activeSuperAdminRecipients: parsedRecipients.filter(
        (r) => r.active && (!r.roleScope || r.roleScope === "ALL" || r.roleScope === "SUPER_ADMIN"),
      ).length,
    },
  };
}
