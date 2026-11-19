import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { createNotificationAuthority } from "./authority";
import { applyResendWebhookEventToAdminAlerts } from "./admin-alert-dispatch.service";

const RESEND_WEBHOOK_MAX_AGE_SECONDS = 300;
const LEASE_DURATION_MS = 30_000;
const MAX_UNMATCHED_ATTEMPTS = 5;

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
      | "WEBHOOK_PAYLOAD_INVALID"
      | "WEBHOOK_CONFLICTING_REPLAY"
      | "WEBHOOK_IN_PROGRESS",
    readonly httpStatus: 401 | 409 | 422 | 503,
    message: string,
  ) {
    super(message);
    this.name = "ResendWebhookError";
  }
}

export function computeDeterministicPayloadHash(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
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

export type ResendWebhookReceiptType = (typeof EVENT_TO_RECEIPT_TYPE)[keyof typeof EVENT_TO_RECEIPT_TYPE];

export type ResendWebhookSafeEvidence = {
  svixId: string;
  emailId: string;
  webhookEventType: string;
  receiptType: ResendWebhookReceiptType;
  occurredAt: string;
  payloadHash: string;
  leaseToken?: string | null;
  leaseExpiresAt?: string | null;
  attemptCount: number;
  nextAttemptAt?: string | null;
  customerDeliveriesUpdated: number;
  adminAlertsUpdated: number;
  appliedDeliveryIds?: string[];
  completedAt?: string | null;
  terminalReason?: string | null;
};

export async function processResendWebhook(input: Readonly<{
  rawBody: string;
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
  secret?: string;
  nowMs?: number;
  db?: typeof prisma;
  maxPollWaitMs?: number;
}>): Promise<{
  replayed: boolean;
  svixId: string;
  emailId: string;
  receiptType: ResendWebhookReceiptType;
  customerDeliveriesUpdated: number;
  adminAlertsUpdated: number;
  status?: "FULLY_APPLIED" | "UNMATCHED_PENDING" | "RECONCILIATION_REQUIRED";
}> {
  const db = input.db ?? prisma;
  const nowMs = input.nowMs ?? Date.now();
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
  const payloadHash = computeDeterministicPayloadHash(input.rawBody);
  const dedupePublicRef = `resend-wh:${svixId}`;

  const initialLeaseToken = randomUUID();
  const initialLeaseExpiresAt = new Date(nowMs + LEASE_DURATION_MS).toISOString();

  let acquiredLease = false;
  let currentEvidence: ResendWebhookSafeEvidence;

  try {
    currentEvidence = {
      svixId,
      emailId,
      webhookEventType: parsed.data.type,
      receiptType,
      occurredAt: occurredAt.toISOString(),
      payloadHash,
      leaseToken: initialLeaseToken,
      leaseExpiresAt: initialLeaseExpiresAt,
      attemptCount: 1,
      nextAttemptAt: null,
      customerDeliveriesUpdated: 0,
      adminAlertsUpdated: 0,
      appliedDeliveryIds: [],
    };

    await db.notificationAuditEvent.create({
      data: {
        publicReference: dedupePublicRef,
        eventType: "RESEND_WEBHOOK_PROCESSING",
        entityReference: emailId,
        safeEvidence: currentEvidence as unknown as Prisma.InputJsonValue,
      },
    });
    acquiredLease = true;
  } catch (err) {
    if ((err as { code?: string })?.code !== "P2002") {
      throw err;
    }
  }

  if (!acquiredLease) {
    const existing = await resolveExistingInboxRecord({
      db,
      publicReference: dedupePublicRef,
      incomingPayloadHash: payloadHash,
      incomingEventType: parsed.data.type,
      nowMs,
      maxPollWaitMs: input.maxPollWaitMs,
    });

    if (existing.kind === "COMPLETED") {
      return {
        replayed: true,
        svixId,
        emailId,
        receiptType,
        customerDeliveriesUpdated: 0,
        adminAlertsUpdated: 0,
        status: "FULLY_APPLIED",
      };
    }

    if (existing.kind === "RECONCILIATION_REQUIRED") {
      return {
        replayed: true,
        svixId,
        emailId,
        receiptType,
        customerDeliveriesUpdated: 0,
        adminAlertsUpdated: 0,
        status: "RECONCILIATION_REQUIRED",
      };
    }

    currentEvidence = existing.evidence;
  }

  try {
    return await executeProjections({
      db,
      svixId,
      emailId,
      receiptType,
      eventType: parsed.data.type,
      occurredAt,
      dedupePublicRef,
      evidence: currentEvidence!,
      nowMs,
    });
  } catch (err) {
    try {
      await db.notificationAuditEvent.updateMany({
        where: {
          publicReference: dedupePublicRef,
          eventType: "RESEND_WEBHOOK_PROCESSING",
        },
        data: {
          safeEvidence: {
            ...currentEvidence!,
            leaseToken: null,
            leaseExpiresAt: null,
            lastError: err instanceof Error ? err.message : String(err),
          } as unknown as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Ignore secondary update error during error cleanup
    }
    throw err;
  }
}

async function resolveExistingInboxRecord(input: {
  db: typeof prisma;
  publicReference: string;
  incomingPayloadHash: string;
  incomingEventType: string;
  nowMs: number;
  maxPollWaitMs?: number;
}): Promise<
  | { kind: "COMPLETED" }
  | { kind: "RECONCILIATION_REQUIRED" }
  | { kind: "LEASE_ACQUIRED"; evidence: ResendWebhookSafeEvidence }
> {
  const { db, publicReference, incomingPayloadHash, incomingEventType, nowMs } = input;
  const pollLimitMs = input.maxPollWaitMs ?? 1500;
  const startTime = Date.now();

  while (true) {
    const row = await db.notificationAuditEvent.findUnique({
      where: { publicReference },
    });
    if (!row) {
      throw new ResendWebhookError(
        "WEBHOOK_IN_PROGRESS",
        503,
        "Concurrent webhook record creation; please retry.",
      );
    }

    const evidence = (row.safeEvidence as Partial<ResendWebhookSafeEvidence>) ?? {};

    // Validate payload consistency (conflicting body or type for same svixId is rejected)
    if (evidence.payloadHash && evidence.payloadHash !== incomingPayloadHash) {
      throw new ResendWebhookError(
        "WEBHOOK_CONFLICTING_REPLAY",
        422,
        "Conflicting payload body hash for existing svixId.",
      );
    }
    if (evidence.webhookEventType && evidence.webhookEventType !== incomingEventType) {
      throw new ResendWebhookError(
        "WEBHOOK_CONFLICTING_REPLAY",
        422,
        "Conflicting event type for existing svixId.",
      );
    }

    if (
      row.eventType === "RESEND_WEBHOOK_FULLY_APPLIED" ||
      (row.eventType === "RESEND_WEBHOOK_RECEIVED" &&
        evidence.completedAt)
    ) {
      return { kind: "COMPLETED" };
    }

    if (row.eventType === "RESEND_WEBHOOK_RECONCILIATION_REQUIRED") {
      return { kind: "RECONCILIATION_REQUIRED" };
    }

    if (row.eventType === "RESEND_WEBHOOK_UNMATCHED_PENDING") {
      const newLeaseToken = randomUUID();
      const newLeaseExpiresAt = new Date(nowMs + LEASE_DURATION_MS).toISOString();
      const nextEvidence: ResendWebhookSafeEvidence = {
        ...(evidence as ResendWebhookSafeEvidence),
        leaseToken: newLeaseToken,
        leaseExpiresAt: newLeaseExpiresAt,
        attemptCount: (evidence.attemptCount ?? 1) + 1,
      };

      const cas = await db.notificationAuditEvent.updateMany({
        where: {
          publicReference,
          eventType: "RESEND_WEBHOOK_UNMATCHED_PENDING",
        },
        data: {
          eventType: "RESEND_WEBHOOK_PROCESSING",
          safeEvidence: nextEvidence as unknown as Prisma.InputJsonValue,
        },
      });

      if (cas.count === 1) {
        return { kind: "LEASE_ACQUIRED", evidence: nextEvidence };
      }
      // CAS lost, re-evaluate next iteration
    } else if (
      row.eventType === "RESEND_WEBHOOK_PROCESSING" ||
      row.eventType === "RESEND_WEBHOOK_RECEIVED"
    ) {
      const leaseExpiresAtMs = evidence.leaseExpiresAt
        ? new Date(evidence.leaseExpiresAt).getTime()
        : 0;
      const leaseActive = leaseExpiresAtMs > nowMs;

      if (!leaseActive) {
        // Lease expired; take over processing
        const newLeaseToken = randomUUID();
        const newLeaseExpiresAt = new Date(nowMs + LEASE_DURATION_MS).toISOString();
        const nextEvidence: ResendWebhookSafeEvidence = {
          ...(evidence as ResendWebhookSafeEvidence),
          leaseToken: newLeaseToken,
          leaseExpiresAt: newLeaseExpiresAt,
          attemptCount: (evidence.attemptCount ?? 1) + 1,
        };

        const cas = await db.notificationAuditEvent.updateMany({
          where: {
            publicReference,
            eventType: row.eventType,
          },
          data: {
            eventType: "RESEND_WEBHOOK_PROCESSING",
            safeEvidence: nextEvidence as unknown as Prisma.InputJsonValue,
          },
        });

        if (cas.count === 1) {
          return { kind: "LEASE_ACQUIRED", evidence: nextEvidence };
        }
      } else {
        // Active lease held by another worker; poll briefly for completion
        if (Date.now() - startTime >= pollLimitMs) {
          throw new ResendWebhookError(
            "WEBHOOK_IN_PROGRESS",
            503,
            "Webhook event is currently processing by another worker.",
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    } else {
      // Any unknown status: treat as in-progress
      throw new ResendWebhookError(
        "WEBHOOK_IN_PROGRESS",
        503,
        "Webhook event status unknown; please retry.",
      );
    }
  }
}

async function executeProjections(input: {
  db: typeof prisma;
  svixId: string;
  emailId: string;
  receiptType: ResendWebhookReceiptType;
  eventType: string;
  occurredAt: Date;
  dedupePublicRef: string;
  evidence: ResendWebhookSafeEvidence;
  nowMs: number;
}): Promise<{
  replayed: boolean;
  svixId: string;
  emailId: string;
  receiptType: ResendWebhookReceiptType;
  customerDeliveriesUpdated: number;
  adminAlertsUpdated: number;
  status: "FULLY_APPLIED" | "UNMATCHED_PENDING" | "RECONCILIATION_REQUIRED";
}> {
  const { db, svixId, emailId, receiptType, eventType, occurredAt, dedupePublicRef, nowMs } = input;
  let evidence = input.evidence;

  // 1. Discover matching customer email deliveries
  const deliveries = await db.notificationDelivery.findMany({
    where: {
      channel: "EMAIL",
      provider: "RESEND_EMAIL",
      providerMessageReference: emailId,
    },
    select: { id: true },
  });

  // 2. Discover matching admin alerts
  const matchedIntents = await db.notificationEventIntent.findMany({
    where: {
      sourceAuthority: "ADMIN_ALERT",
      operationId: { startsWith: "admin-alert-delivery:" },
      safePayload: {
        path: ["providerMessageReference"],
        equals: emailId,
      },
    },
    select: { id: true },
  });

  // Check if unmatched (neither customer delivery nor admin alert found)
  if (deliveries.length === 0 && matchedIntents.length === 0) {
    const attemptCount = evidence.attemptCount ?? 1;

    if (attemptCount >= MAX_UNMATCHED_ATTEMPTS) {
      // Reached maximum attempts: escalate to reconciliation queue
      await db.notificationReconciliationCase.upsert({
        where: { publicReference: `rec:resend-unmatched:${svixId}` },
        update: {
          lastObservedAt: new Date(nowMs),
          safeSummary: `Resend webhook ${svixId} for email ${emailId} unmatched after ${attemptCount} attempts.`,
        },
        create: {
          publicReference: `rec:resend-unmatched:${svixId}`,
          sourceReceiptId: svixId,
          reason: "DELIVERY_STALLED",
          status: "OPEN",
          safeSummary: `Resend webhook ${svixId} for email ${emailId} unmatched after ${attemptCount} attempts.`,
          safeEvidence: {
            svixId,
            emailId,
            webhookEventType: eventType,
            receiptType,
            attemptCount,
          },
        },
      });

      evidence = {
        ...evidence,
        leaseToken: null,
        leaseExpiresAt: null,
        terminalReason: "MAX_UNMATCHED_ATTEMPTS_EXCEEDED",
      };

      await db.notificationAuditEvent.updateMany({
        where: {
          publicReference: dedupePublicRef,
          eventType: "RESEND_WEBHOOK_PROCESSING",
        },
        data: {
          eventType: "RESEND_WEBHOOK_RECONCILIATION_REQUIRED",
          safeEvidence: evidence as unknown as Prisma.InputJsonValue,
        },
      });

      return {
        replayed: false,
        svixId,
        emailId,
        receiptType,
        customerDeliveriesUpdated: 0,
        adminAlertsUpdated: 0,
        status: "RECONCILIATION_REQUIRED",
      };
    }

    // Schedule bounded retry
    const backoffSeconds = Math.min(300, 15 * Math.pow(2, attemptCount - 1));
    const nextAttemptAt = new Date(nowMs + backoffSeconds * 1000).toISOString();

    evidence = {
      ...evidence,
      attemptCount,
      nextAttemptAt,
      leaseToken: null,
      leaseExpiresAt: null,
    };

    await db.notificationAuditEvent.updateMany({
      where: {
        publicReference: dedupePublicRef,
        eventType: "RESEND_WEBHOOK_PROCESSING",
      },
      data: {
        eventType: "RESEND_WEBHOOK_UNMATCHED_PENDING",
        safeEvidence: evidence as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      replayed: false,
      svixId,
      emailId,
      receiptType,
      customerDeliveriesUpdated: 0,
      adminAlertsUpdated: 0,
      status: "UNMATCHED_PENDING",
    };
  }

  // 3. Apply customer deliveries idempotently
  let customerDeliveriesUpdated = 0;
  const appliedDeliveryIds: string[] = evidence.appliedDeliveryIds ? [...evidence.appliedDeliveryIds] : [];

  if (deliveries.length > 0) {
    const authority = createNotificationAuthority(db, new Map());
    for (const delivery of deliveries) {
      if (appliedDeliveryIds.includes(delivery.id)) {
        continue;
      }
      await authority.delivery.ingestProviderReceipt({
        provider: "RESEND_EMAIL",
        providerReceiptId: `${svixId}:${delivery.id}`,
        deliveryId: delivery.id,
        type: receiptType,
        safePayload: {
          webhookEventType: eventType,
          occurredAt: occurredAt.toISOString(),
        },
      });
      appliedDeliveryIds.push(delivery.id);
      customerDeliveriesUpdated += 1;
    }

    if (customerDeliveriesUpdated > 0) {
      await db.notificationAuditEvent.updateMany({
        where: {
          publicReference: dedupePublicRef,
          eventType: "RESEND_WEBHOOK_PROCESSING",
        },
        data: {
          safeEvidence: {
            ...evidence,
            appliedDeliveryIds,
            customerDeliveriesUpdated,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }

  // 4. Apply admin alert updates idempotently
  const adminRes = await applyResendWebhookEventToAdminAlerts({
    emailId,
    receiptType,
    providerReceiptId: svixId,
    occurredAt,
    db,
  });
  const adminAlertsUpdated = adminRes.updated;

  // 5. Mark fully applied atomically only AFTER all projections succeeded
  const completedAt = new Date(nowMs).toISOString();
  const finalEvidence: ResendWebhookSafeEvidence = {
    ...evidence,
    customerDeliveriesUpdated,
    adminAlertsUpdated,
    appliedDeliveryIds,
    completedAt,
    leaseToken: null,
    leaseExpiresAt: null,
    nextAttemptAt: null,
  };

  await db.notificationAuditEvent.updateMany({
    where: {
      publicReference: dedupePublicRef,
      eventType: "RESEND_WEBHOOK_PROCESSING",
    },
    data: {
      eventType: "RESEND_WEBHOOK_FULLY_APPLIED",
      safeEvidence: finalEvidence as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    replayed: false,
    svixId,
    emailId,
    receiptType,
    customerDeliveriesUpdated,
    adminAlertsUpdated,
    status: "FULLY_APPLIED",
  };
}

export async function recoverPendingResendWebhooks(options?: {
  limit?: number;
  db?: typeof prisma;
  maxAttempts?: number;
  now?: Date;
}): Promise<{ examined: number; reconciled: number; failed: number }> {
  const db = options?.db ?? prisma;
  const now = options?.now ?? new Date();
  const limit = Math.max(1, Math.min(options?.limit ?? 50, 200));

  // Find candidate audit events: UNMATCHED_PENDING or stale PROCESSING
  const candidates = await db.notificationAuditEvent.findMany({
    where: {
      eventType: {
        in: ["RESEND_WEBHOOK_UNMATCHED_PENDING", "RESEND_WEBHOOK_PROCESSING"],
      },
    },
    orderBy: { createdAt: "asc" },
    take: limit * 2,
  });

  let examined = 0;
  let reconciled = 0;
  let failed = 0;

  for (const candidate of candidates) {
    if (examined >= limit) break;
    const evidence = (candidate.safeEvidence as Partial<ResendWebhookSafeEvidence>) ?? {};

    // Check if not yet due
    if (evidence.nextAttemptAt && new Date(evidence.nextAttemptAt) > now) {
      continue;
    }

    // For PROCESSING events, check if lease has expired
    if (candidate.eventType === "RESEND_WEBHOOK_PROCESSING") {
      const leaseExpiresAtMs = evidence.leaseExpiresAt
        ? new Date(evidence.leaseExpiresAt).getTime()
        : 0;
      if (leaseExpiresAtMs > now.getTime()) {
        continue; // Active lease
      }
    }

    examined += 1;

    // Acquire lease
    const newLeaseToken = randomUUID();
    const newLeaseExpiresAt = new Date(now.getTime() + LEASE_DURATION_MS).toISOString();
    const nextEvidence: ResendWebhookSafeEvidence = {
      ...(evidence as ResendWebhookSafeEvidence),
      leaseToken: newLeaseToken,
      leaseExpiresAt: newLeaseExpiresAt,
      attemptCount: (evidence.attemptCount ?? 1) + 1,
    };

    const cas = await db.notificationAuditEvent.updateMany({
      where: {
        publicReference: candidate.publicReference,
        eventType: candidate.eventType,
      },
      data: {
        eventType: "RESEND_WEBHOOK_PROCESSING",
        safeEvidence: nextEvidence as unknown as Prisma.InputJsonValue,
      },
    });

    if (cas.count === 0) {
      continue; // Won by another worker
    }

    try {
      const outcome = await executeProjections({
        db,
        svixId: evidence.svixId ?? candidate.publicReference.replace(/^resend-wh:/, ""),
        emailId: candidate.entityReference ?? evidence.emailId ?? "",
        receiptType: (evidence.receiptType as ResendWebhookReceiptType) ?? "DELIVERED",
        eventType: evidence.webhookEventType ?? "email.delivered",
        occurredAt: evidence.occurredAt ? new Date(evidence.occurredAt) : now,
        dedupePublicRef: candidate.publicReference,
        evidence: nextEvidence,
        nowMs: now.getTime(),
      });

      if (outcome.status === "FULLY_APPLIED") {
        reconciled += 1;
      } else if (outcome.status === "RECONCILIATION_REQUIRED") {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return { examined, reconciled, failed };
}

export async function hasPendingResendWebhooksWork(
  db: typeof prisma = prisma,
): Promise<boolean> {
  const row = await db.notificationAuditEvent.findFirst({
    where: {
      eventType: {
        in: ["RESEND_WEBHOOK_UNMATCHED_PENDING", "RESEND_WEBHOOK_PROCESSING"],
      },
    },
    select: { id: true },
  });
  return Boolean(row);
}

