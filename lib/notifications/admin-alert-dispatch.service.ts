import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { resolveNotificationProductionComposition } from "./composition-root";
import type { NotificationProvider, ProviderSendResult } from "./providers";
import {
  activeRecipientsForAdminAlertEvent,
  getAdminAlertAdminPath,
  getAdminAlertEventLabel,
  isValidConfiguredNotificationEmail,
  parseAdminAlertRecipients,
  type AdminAlertEventType,
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
  readonly sentCount: number;
  readonly failedCount: number;
  readonly deduplicatedCount: number;
}

type SafeDeliveryPayload = {
  kind: "RECIPIENT_DELIVERY";
  eventType: AdminAlertEventType;
  aggregateReference: string;
  adminPath: string;
  title: string;
  summary: string;
  recipientDigest: string;
  emailLogId: string;
  deliveryStatus: "PENDING" | "SENT" | "FAILED";
  retryCount: number;
  nextAttemptAt: string | null;
  providerMessageReference: string | null;
  lastFailureCode: string | null;
  sentAt: string | null;
};

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
      } satisfies Prisma.InputJsonValue,
    },
  });
}

async function loadConfiguredActiveRecipients(
  db: typeof prisma,
  eventType: AdminAlertEventType,
) {
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
}): Promise<{ delivered: boolean }> {
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
      emailLogId: input.emailLogId,
      deliveryStatus: "SENT",
      retryCount: input.priorRetryCount,
      nextAttemptAt: null,
      providerMessageReference: result.providerMessageReference,
      lastFailureCode: null,
      sentAt: now.toISOString(),
    };
    await input.db.$transaction([
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
    ]);
    return { delivered: true };
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
    emailLogId: input.emailLogId,
    deliveryStatus: "FAILED",
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
  return { delivered: false };
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
    return {
      eventOperationId,
      adminPath,
      activeRecipientCount: 0,
      sentCount: 0,
      failedCount: 0,
      deduplicatedCount: 0,
    };
  }

  const provider =
    options && "providerOverride" in options
      ? (options.providerOverride ?? null)
      : resolveProductionEmailProvider();

  let sentCount = 0;
  let failedCount = 0;
  let deduplicatedCount = 0;

  for (const recipient of recipients) {
    const email = recipient.email.trim().toLowerCase();
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

    if (existingPayload?.deliveryStatus === "SENT") {
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
          emailLogId: log.id,
          deliveryStatus: "PENDING",
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
        if (p?.deliveryStatus === "SENT") {
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
    });
    if (attempt.delivered) sentCount += 1;
    else failedCount += 1;
  }

  return {
    eventOperationId,
    adminPath,
    activeRecipientCount: recipients.length,
    sentCount,
    failedCount,
    deduplicatedCount,
  };
}

export async function retryPendingAdminAlertDeliveries(options?: {
  limit?: number;
  now?: Date;
  providerOverride?: NotificationProvider | null;
  db?: typeof prisma;
}): Promise<{ checked: number; sent: number; failed: number }> {
  const db = options?.db ?? prisma;
  const now = options?.now ?? new Date();
  const limit = Math.min(Math.max(options?.limit ?? 25, 1), 100);
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

  const provider =
    options && "providerOverride" in options
      ? (options.providerOverride ?? null)
      : resolveProductionEmailProvider();

  let checked = 0;
  let sent = 0;
  let failed = 0;

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
      payload.deliveryStatus === "SENT" ||
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
    if (!isValidConfiguredNotificationEmail(log.recipient)) continue;

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
    });
    if (attempt.delivered) sent += 1;
    else failed += 1;
  }

  return { checked, sent, failed };
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
