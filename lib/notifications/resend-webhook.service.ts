import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { createNotificationAuthority } from "./authority";
import { applyResendWebhookEventToAdminAlerts } from "./admin-alert-dispatch.service";

const RESEND_WEBHOOK_MAX_AGE_SECONDS = 300;

const ResendWebhookEventSchema = z.object({
  type: z.enum([
    "email.sent",
    "email.delivered",
    "email.delivery_delayed",
    "email.bounced",
    "email.complained",
  ]),
  created_at: z.string().optional(),
  data: z.object({
    email_id: z.string().trim().min(1).max(200),
  }),
});

export class ResendWebhookError extends Error {
  constructor(
    readonly code:
      | "WEBHOOK_SECRET_NOT_CONFIGURED"
      | "WEBHOOK_SIGNATURE_INVALID"
      | "WEBHOOK_TIMESTAMP_EXPIRED"
      | "WEBHOOK_PAYLOAD_INVALID",
    readonly httpStatus: 401 | 422 | 503,
    message: string,
  ) {
    super(message);
    this.name = "ResendWebhookError";
  }
}

export function verifyResendSvixSignature(input: Readonly<{
  rawBody: string;
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
  secret?: string;
  nowMs?: number;
}>): { svixId: string; occurredAt: Date } {
  const secret = (input.secret ?? process.env.RESEND_WEBHOOK_SECRET ?? "").trim();
  if (!secret) {
    throw new ResendWebhookError(
      "WEBHOOK_SECRET_NOT_CONFIGURED",
      503,
      "Resend webhook verification secret is not configured.",
    );
  }

  const svixId = input.svixId?.trim() ?? "";
  const tsRaw = input.svixTimestamp?.trim() ?? "";
  const sigHeader = input.svixSignature?.trim() ?? "";
  if (!svixId || !tsRaw || !sigHeader || !/^\d{10,13}$/.test(tsRaw)) {
    throw new ResendWebhookError(
      "WEBHOOK_SIGNATURE_INVALID",
      401,
      "Missing or malformed Resend signature headers.",
    );
  }

  const tsSeconds = Number.parseInt(tsRaw, 10);
  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (
    !Number.isSafeInteger(tsSeconds) ||
    Math.abs(nowSeconds - tsSeconds) > RESEND_WEBHOOK_MAX_AGE_SECONDS
  ) {
    throw new ResendWebhookError(
      "WEBHOOK_TIMESTAMP_EXPIRED",
      401,
      "Webhook timestamp is outside the allowed replay window.",
    );
  }

  const rawKey = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const keyBytes = Buffer.from(rawKey, "base64");
  if (keyBytes.length === 0) {
    throw new ResendWebhookError(
      "WEBHOOK_SECRET_NOT_CONFIGURED",
      503,
      "Resend webhook signing secret format is invalid.",
    );
  }

  const signedContent = `${svixId}.${tsRaw}.${input.rawBody}`;
  const expectedSig = createHmac("sha256", keyBytes)
    .update(signedContent)
    .digest("base64");
  const expectedBuf = Buffer.from(expectedSig, "utf8");

  const candidates = sigHeader
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1,"))
    .map((part) => part.slice(3));

  const valid = candidates.some((candidate) => {
    const candidateBuf = Buffer.from(candidate, "utf8");
    return (
      candidateBuf.length === expectedBuf.length &&
      timingSafeEqual(candidateBuf, expectedBuf)
    );
  });
  if (!valid) {
    throw new ResendWebhookError(
      "WEBHOOK_SIGNATURE_INVALID",
      401,
      "Invalid Resend webhook signature.",
    );
  }

  return {
    svixId,
    occurredAt: new Date(tsSeconds * 1000),
  };
}

const EVENT_TO_RECEIPT_TYPE = {
  "email.sent": "ACCEPTED",
  "email.delivered": "DELIVERED",
  "email.delivery_delayed": "DEFERRED",
  "email.bounced": "BOUNCED",
  "email.complained": "COMPLAINED",
} as const;

export async function processResendWebhook(input: Readonly<{
  rawBody: string;
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
  secret?: string;
  nowMs?: number;
  db?: typeof prisma;
}>): Promise<{
  replayed: boolean;
  svixId: string;
  emailId: string;
  receiptType: "ACCEPTED" | "DELIVERED" | "DEFERRED" | "BOUNCED" | "COMPLAINED";
  customerDeliveriesUpdated: number;
  adminAlertsUpdated: number;
}> {
  const db = input.db ?? prisma;
  const { svixId, occurredAt } = verifyResendSvixSignature(input);

  let json: unknown;
  try {
    json = JSON.parse(input.rawBody);
  } catch {
    throw new ResendWebhookError(
      "WEBHOOK_PAYLOAD_INVALID",
      422,
      "Malformed JSON payload.",
    );
  }

  const parsed = ResendWebhookEventSchema.safeParse(json);
  if (!parsed.success) {
    throw new ResendWebhookError(
      "WEBHOOK_PAYLOAD_INVALID",
      422,
      "Unsupported or invalid Resend webhook event payload.",
    );
  }

  const emailId = parsed.data.data.email_id;
  const receiptType = EVENT_TO_RECEIPT_TYPE[parsed.data.type];
  const dedupePublicRef = `resend-wh:${svixId}`;

  const existingReceipt = await db.notificationAuditEvent.findUnique({
    where: { publicReference: dedupePublicRef },
    select: { id: true },
  });
  if (existingReceipt) {
    return {
      replayed: true,
      svixId,
      emailId,
      receiptType,
      customerDeliveriesUpdated: 0,
      adminAlertsUpdated: 0,
    };
  }

  try {
    await db.notificationAuditEvent.create({
      data: {
        publicReference: dedupePublicRef,
        eventType: "RESEND_WEBHOOK_RECEIVED",
        entityReference: emailId,
        safeEvidence: {
          webhookEventType: parsed.data.type,
          receiptType,
          emailId,
          occurredAt: occurredAt.toISOString(),
        },
      },
    });
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      return {
        replayed: true,
        svixId,
        emailId,
        receiptType,
        customerDeliveriesUpdated: 0,
        adminAlertsUpdated: 0,
      };
    }
    throw err;
  }

  let customerDeliveriesUpdated = 0;
  const deliveries = await db.notificationDelivery.findMany({
    where: {
      channel: "EMAIL",
      provider: "RESEND_EMAIL",
      providerMessageReference: emailId,
    },
    select: { id: true },
  });

  if (deliveries.length > 0) {
    const authority = createNotificationAuthority(db, new Map());
    for (const delivery of deliveries) {
      await authority.delivery.ingestProviderReceipt({
        provider: "RESEND_EMAIL",
        providerReceiptId: `${svixId}:${delivery.id}`,
        deliveryId: delivery.id,
        type: receiptType,
        safePayload: {
          webhookEventType: parsed.data.type,
          occurredAt: occurredAt.toISOString(),
        },
      });
      customerDeliveriesUpdated += 1;
    }
  }

  const adminRes = await applyResendWebhookEventToAdminAlerts({
    emailId,
    receiptType,
    providerReceiptId: svixId,
    occurredAt,
    db,
  });

  return {
    replayed: false,
    svixId,
    emailId,
    receiptType,
    customerDeliveriesUpdated,
    adminAlertsUpdated: adminRes.updated,
  };
}
