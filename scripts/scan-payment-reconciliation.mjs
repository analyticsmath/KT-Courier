import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const threshold = new Date(Date.now() - 30 * 60_000);
const activeCredentialVersion = process.env.PAYFAST_CREDENTIAL_VERSION?.trim() || null;
const reference = () => `prc_${randomBytes(18).toString("base64url")}`;

async function openCase(tx, input) {
  const key = `payfast:${input.paymentId}:${input.attemptId ?? "payment"}:${input.reason}`;
  const existing = await tx.paymentReconciliationCase.findUnique({ where: { caseKey: key }, select: { status: true } });
  const reconciliationCase = await tx.paymentReconciliationCase.upsert({
    where: { caseKey: key },
    create: { publicReference: reference(), caseKey: key, paymentId: input.paymentId, attemptId: input.attemptId, webhookEventId: input.webhookEventId, provider: "PAYFAST", reason: input.reason, status: "OPEN", priority: input.priority, summary: input.summary, safeEvidence: input.safeEvidence, openedAt: new Date(), lastObservedAt: new Date() },
    update: { status: "OPEN", resolvedAt: null, resolutionCode: null, lastObservedAt: new Date(), observationCount: { increment: 1 }, summary: input.summary },
  });
  if (!existing || existing.status === "RESOLVED" || existing.status === "CLOSED") {
    const payment = await tx.payment.findUnique({ where: { id: input.paymentId }, select: { status: true } });
    if (payment) await tx.paymentStatusHistory.create({ data: { paymentId: input.paymentId, attemptId: input.attemptId, fromStatus: payment.status, toStatus: payment.status, reasonCode: existing ? "PAYFAST_RECONCILIATION_REOPENED" : "PAYFAST_RECONCILIATION_OPENED", actorType: "SYSTEM", metadata: { reconciliationCaseReference: reconciliationCase.publicReference, reconciliationReason: input.reason } } });
  }
  await tx.payment.update({ where: { id: input.paymentId }, data: { reconciliationStatus: "REQUIRED" } });
}

async function main() {
  const [staleAttempts, credentialMismatches, unappliedEvents, repeatedTemporaryFailures, unlinkedSuccesses, orphanJournals, conflictingReferences] = await Promise.all([
    prisma.paymentAttempt.findMany({ where: { provider: "PAYFAST", updatedAt: { lt: threshold }, OR: [{ status: "UNKNOWN" }, { status: "PROCESSING", webhookEvents: { none: { providerDataVerified: true } } }, { status: "REQUIRES_ACTION", expiresAt: { lt: new Date() } }] }, select: { id: true, paymentId: true, status: true, publicReference: true, providerCredentialVersion: true } }),
    activeCredentialVersion
      ? prisma.paymentAttempt.findMany({ where: { provider: "PAYFAST", providerCredentialVersion: { not: activeCredentialVersion }, status: { in: ["RESERVED", "REQUESTING", "REQUIRES_ACTION", "PROCESSING", "UNKNOWN"] } }, select: { id: true, paymentId: true, publicReference: true } })
      : Promise.resolve([]),
    prisma.paymentWebhookEvent.findMany({ where: { providerDataVerified: true, appliedAt: null, receivedAt: { lt: threshold } }, select: { id: true, paymentId: true, attemptId: true, publicReference: true } }),
    prisma.paymentWebhookEvent.findMany({ where: { processingStatus: "TEMPORARY_FAILURE", paymentId: { not: null }, receivedAt: { lt: threshold } }, select: { id: true, paymentId: true, attemptId: true, publicReference: true } }),
    prisma.payment.findMany({ where: { status: "SUCCEEDED", OR: [{ successLedgerJournalId: null }, { successWebhookEventId: null }] }, select: { id: true, successfulAttemptId: true, publicReference: true } }),
    prisma.ledgerJournal.findMany({ where: { type: "EXTERNAL_PAYMENT_RECEIPT", successfulForPayment: null }, select: { id: true, correlationId: true, reference: true } }),
    prisma.$queryRaw`SELECT e."id", e."paymentId", e."attemptId", e."publicReference" FROM "PaymentWebhookEvent" e JOIN "PaymentAttempt" a ON a."id" = e."attemptId" WHERE e."providerDataVerified" AND a."providerReference" IS NOT NULL AND e."providerPaymentId" <> a."providerReference"`,
  ]);
  await prisma.$transaction(async (tx) => {
    for (const attempt of staleAttempts) await openCase(tx, { paymentId: attempt.paymentId, attemptId: attempt.id, webhookEventId: null, reason: attempt.providerCredentialVersion ? "STALE_PROCESSING_ATTEMPT" : "CREDENTIAL_VERSION_MISMATCH", priority: "MEDIUM", summary: `Payfast ${attempt.status} attempt is stale.`, safeEvidence: { attemptReference: attempt.publicReference, observedStatus: attempt.status } });
    for (const attempt of credentialMismatches) await openCase(tx, { paymentId: attempt.paymentId, attemptId: attempt.id, webhookEventId: null, reason: "CREDENTIAL_VERSION_MISMATCH", priority: "HIGH", summary: "Payfast attempt credential version does not match the active credential set.", safeEvidence: { attemptReference: attempt.publicReference } });
    for (const event of unappliedEvents) if (event.paymentId) await openCase(tx, { paymentId: event.paymentId, attemptId: event.attemptId, webhookEventId: event.id, reason: "APPLICATION_FAILURE_AFTER_VERIFICATION", priority: "HIGH", summary: "Verified Payfast event has not been applied.", safeEvidence: { eventReference: event.publicReference } });
    for (const event of repeatedTemporaryFailures) if (event.paymentId) await openCase(tx, { paymentId: event.paymentId, attemptId: event.attemptId, webhookEventId: event.id, reason: "PROVIDER_CONFIRMATION_UNAVAILABLE", priority: "HIGH", summary: "Payfast confirmation has remained temporarily unavailable beyond the retry window.", safeEvidence: { eventReference: event.publicReference } });
    for (const payment of unlinkedSuccesses) await openCase(tx, { paymentId: payment.id, attemptId: payment.successfulAttemptId, webhookEventId: null, reason: "APPLICATION_FAILURE_AFTER_VERIFICATION", priority: "CRITICAL", summary: "Successful payment is missing a canonical evidence link.", safeEvidence: { paymentReference: payment.publicReference } });
    for (const row of conflictingReferences) if (row.paymentId) await openCase(tx, { paymentId: row.paymentId, attemptId: row.attemptId, webhookEventId: row.id, reason: "PROVIDER_REFERENCE_CONFLICT", priority: "CRITICAL", summary: "Verified Payfast provider reference conflicts with the attempt.", safeEvidence: { eventReference: row.publicReference } });
    for (const journal of orphanJournals) {
      const payment = journal.correlationId ? await tx.payment.findUnique({ where: { publicReference: journal.correlationId }, select: { id: true, successfulAttemptId: true } }) : null;
      if (payment) await openCase(tx, { paymentId: payment.id, attemptId: payment.successfulAttemptId, webhookEventId: null, reason: "APPLICATION_FAILURE_AFTER_VERIFICATION", priority: "CRITICAL", summary: "Payment receipt journal is not linked to its payment.", safeEvidence: { ledgerJournalReference: journal.reference } });
    }
  }, { isolationLevel: "Serializable" });
  console.log(`Reconciliation scan observed ${staleAttempts.length + credentialMismatches.length + unappliedEvents.length + repeatedTemporaryFailures.length + unlinkedSuccesses.length + orphanJournals.length + conflictingReferences.length} anomaly candidates.`);
}

try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : "Payment reconciliation scan failed."); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
