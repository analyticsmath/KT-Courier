import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { PaymentReconciliationReasonCode } from "@/lib/payments/types";
import { reconciliationPriority, reconciliationSummary } from "@/lib/payments/providers/payfast/payfast-reconciliation-policy";

export type OpenReconciliationInput = Readonly<{
  paymentId: string;
  attemptId?: string | null;
  webhookEventId?: string | null;
  reason: PaymentReconciliationReasonCode;
  safeEvidence?: Readonly<Record<string, string | number | boolean | null>>;
}>;

function publicReference(): string {
  return `prc_${randomBytes(18).toString("base64url")}`;
}

function caseKey(input: OpenReconciliationInput): string {
  return `payfast:${input.paymentId}:${input.attemptId ?? "payment"}:${input.reason}`;
}

async function writeReconciliationHistory(
  tx: Prisma.TransactionClient,
  input: OpenReconciliationInput,
  reconciliationCase: { publicReference: string },
  reasonCode: "PAYFAST_RECONCILIATION_OPENED" | "PAYFAST_RECONCILIATION_REOPENED",
): Promise<void> {
  const payment = await tx.payment.findUnique({ where: { id: input.paymentId }, select: { status: true } });
  if (!payment) return;
  await tx.paymentStatusHistory.create({
    data: {
      paymentId: input.paymentId,
      attemptId: input.attemptId ?? null,
      fromStatus: payment.status,
      toStatus: payment.status,
      reasonCode,
      actorType: "SYSTEM",
      metadata: {
        reconciliationCaseReference: reconciliationCase.publicReference,
        reconciliationReason: input.reason,
        webhookEventReference: typeof input.safeEvidence?.eventReference === "string" ? input.safeEvidence.eventReference : null,
      },
    },
  });
}

export async function openPaymentReconciliationCaseWithinTransaction(
  tx: Prisma.TransactionClient,
  input: OpenReconciliationInput,
) {
  const now = new Date();
  const key = caseKey(input);
  const existing = await tx.paymentReconciliationCase.findUnique({ where: { caseKey: key } });
  if (existing) {
    const wasResolved = existing.status === "CLOSED" || existing.status === "RESOLVED";
    const updated = await tx.paymentReconciliationCase.update({
      where: { id: existing.id },
      data: {
        status: wasResolved ? "OPEN" : existing.status,
        lastObservedAt: now,
        observationCount: { increment: 1 },
        summary: reconciliationSummary(input.reason),
        resolvedAt: null,
        resolutionCode: null,
      },
    });
    if (wasResolved) await writeReconciliationHistory(tx, input, updated, "PAYFAST_RECONCILIATION_REOPENED");
    return updated;
  }
  const created = await tx.paymentReconciliationCase.create({
    data: {
      publicReference: publicReference(),
      caseKey: key,
      paymentId: input.paymentId,
      attemptId: input.attemptId ?? null,
      webhookEventId: input.webhookEventId ?? null,
      provider: "PAYFAST",
      reason: input.reason,
      status: "OPEN",
      priority: reconciliationPriority(input.reason),
      summary: reconciliationSummary(input.reason),
      safeEvidence: input.safeEvidence as Prisma.InputJsonValue | undefined,
      openedAt: now,
      lastObservedAt: now,
    },
  });
  await writeReconciliationHistory(tx, input, created, "PAYFAST_RECONCILIATION_OPENED");
  return created;
}

export async function openPaymentReconciliationCase(input: OpenReconciliationInput) {
  return prisma.$transaction(
    (tx) => openPaymentReconciliationCaseWithinTransaction(tx, input),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function resolvePaymentReconciliationCasesWithinTransaction(
  tx: Prisma.TransactionClient,
  paymentId: string,
  attemptId: string,
  resolutionCode: "VERIFIED_COMPLETE" | "VERIFIED_FAILED",
): Promise<void> {
  const [cases, payment] = await Promise.all([
    tx.paymentReconciliationCase.findMany({
      where: { paymentId, attemptId, status: { in: ["OPEN", "MONITORING"] } },
      select: { publicReference: true, reason: true },
    }),
    tx.payment.findUnique({ where: { id: paymentId }, select: { status: true } }),
  ]);
  await tx.paymentReconciliationCase.updateMany({
    where: { paymentId, attemptId, status: { in: ["OPEN", "MONITORING"] } },
    data: { status: "RESOLVED", resolvedAt: new Date(), resolutionCode },
  });
  if (payment && cases.length > 0) {
    await tx.paymentStatusHistory.createMany({
      data: cases.map((entry) => ({
        paymentId,
        attemptId,
        fromStatus: payment.status,
        toStatus: payment.status,
        reasonCode: "PAYFAST_RECONCILIATION_RESOLVED",
        actorType: "SYSTEM" as const,
        metadata: {
          reconciliationCaseReference: entry.publicReference,
          reconciliationReason: entry.reason,
          resolutionCode,
        },
      })),
    });
  }
}
