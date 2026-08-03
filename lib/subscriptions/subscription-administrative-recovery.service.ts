/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma generation is deferred to Phase 26.5. */
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { resolveAndAssertSubscriptionOperation } from "@/lib/subscriptions/composition-root";
import { createPrismaSubscriptionCancellationRepository, createPrismaSubscriptionEntitlementRefundRepository, createPrismaSubscriptionProviderSynchronizationRepository } from "@/lib/subscriptions/prisma-subscription-lifecycle.repository";
import { onVerifiedSubscriptionPaymentSucceededInProduction } from "@/lib/subscriptions/subscription-payment-success-hook.service";
import { applySubscriptionCancellation, synchronizeProviderCancellation } from "@/lib/subscriptions/subscription-cancellation.service";
import { applySubscriptionEntitlementRefundAdjustment } from "@/lib/subscriptions/subscription-entitlement-refund.service";
import { synchronizeSubscriptionProviderAuthority } from "@/lib/subscriptions/subscription-provider-synchronization.service";
import { SubscriptionError } from "@/lib/subscriptions/errors";
import { createPrismaSubscriptionRefundRepository, requestSubscriptionRefund } from "@/lib/subscriptions/subscription-refund.service";

export type SubscriptionAdministrativeRecoveryOperation =
  | "retry-activation" | "retry-settlement" | "retry-renewal" | "retry-provider-sync"
  | "retry-cancellation" | "retry-refund" | "retry-entitlement-reconciliation" | "rescan";

const db = prisma as any;

async function contractPayment(reference: string): Promise<{ id: string; invoiceReference: string } | null> {
  const invoice = await db.subscriptionInvoice.findFirst({ where: { contract: { publicReference: reference }, payment: { status: "SUCCEEDED" } }, include: { payment: true }, orderBy: { billingCycle: { cycleNumber: "desc" } } });
  return invoice?.payment ? { id: invoice.payment.id, invoiceReference: invoice.publicReference } : null;
}

async function openRecoveryCase(reference: string, operationId: string, reason: string) {
  const contract = await db.subscriptionContract.findUnique({ where: { publicReference: reference }, select: { id: true } });
  if (!contract) throw new SubscriptionError("SUBSCRIPTION_ACCESS_DENIED", "Subscription contract was not found.");
  await db.subscriptionReconciliationCase.upsert({ where: { caseKey: `subscription-recovery:${contract.id}:${reason}` }, create: { publicReference: `subrec_${operationId.replace(/[^A-Za-z0-9_-]/g, "").slice(-36)}`, caseKey: `subscription-recovery:${contract.id}:${reason}`, contractId: contract.id, reason: "APPLICATION_FAILURE", priority: "HIGH", safeSummary: "Subscription recovery requires canonical reconciliation.", safeEvidence: { operationId, reason } }, update: { lastObservedAt: new Date(), safeEvidence: { operationId, reason } } });
}

function safeRecoveryOutcome(result: unknown): string {
  if (!result || typeof result !== "object" || Array.isArray(result)) return "RETRIED";
  const outcome = (result as Record<string, unknown>).outcome;
  return typeof outcome === "string" && /^[A-Z_]{1,80}$/.test(outcome) ? outcome : "RETRIED";
}

async function recordAdministrativeRecoveryReceipt(reference: string, operation: SubscriptionAdministrativeRecoveryOperation, operationId: string, result: unknown) {
  const contract = await db.subscriptionContract.findUnique({ where: { publicReference: reference }, select: { id: true, publicReference: true } });
  if (!contract) return;
  const receiptFingerprint = createHash("sha256").update(operationId, "utf8").digest("hex").slice(0, 36);
  await db.subscriptionOperationReceipt.upsert({
    where: { operationId },
    create: {
      publicReference: `subop_${receiptFingerprint}`,
      contractId: contract.id,
      operationId,
      operationType: `ADMIN_${operation.toUpperCase().replaceAll("-", "_")}`,
      requestHash: `admin-recovery:${operation}:${contract.publicReference}`,
      outcome: safeRecoveryOutcome(result),
      safeEvidence: { operation, contractReference: contract.publicReference },
      completedAt: new Date(),
    },
    update: {},
  });
}

/**
 * Recovery deliberately replays the same services as provider and processor
 * paths. It exposes no manual status, payment, grant, token or ledger write.
 */
export async function runSubscriptionAdministrativeRecoveryInProduction(input: Readonly<{ contractReference: string; operation: SubscriptionAdministrativeRecoveryOperation; operationId: string }>) {
  if (!input.operationId.trim()) throw new SubscriptionError("SUBSCRIPTION_INVALID_INPUT", "An administrative operation ID is required.");
  const composition = resolveAndAssertSubscriptionOperation("ADMIN_RECOVERY");
  let result: unknown;
  switch (input.operation) {
    case "retry-activation":
    case "retry-settlement": {
      const payment = await contractPayment(input.contractReference);
      if (!payment) { await openRecoveryCase(input.contractReference, input.operationId, "PAID_INVOICE_MISSING"); result = Object.freeze({ outcome: "RECONCILIATION_REQUIRED" as const }); break; }
      await onVerifiedSubscriptionPaymentSucceededInProduction(payment.id);
      result = Object.freeze({ outcome: "RETRIED" as const, invoiceReference: payment.invoiceReference });
      break;
    }
    case "retry-renewal": {
      const payment = await contractPayment(input.contractReference);
      if (!payment) { await openRecoveryCase(input.contractReference, input.operationId, "RENEWAL_EVENT_WITHOUT_PREPARED_CYCLE"); result = Object.freeze({ outcome: "RECONCILIATION_REQUIRED" as const }); break; }
      await onVerifiedSubscriptionPaymentSucceededInProduction(payment.id);
      result = Object.freeze({ outcome: "RETRIED" as const, invoiceReference: payment.invoiceReference });
      break;
    }
    case "retry-provider-sync": {
      const authority = await db.subscriptionPaymentAuthority.findFirst({ where: { contract: { publicReference: input.contractReference } }, select: { publicReference: true } });
      if (!authority) { await openRecoveryCase(input.contractReference, input.operationId, "PROVIDER_AUTHORITY_MISSING"); result = Object.freeze({ outcome: "RECONCILIATION_REQUIRED" as const }); break; }
      result = await synchronizeSubscriptionProviderAuthority(createPrismaSubscriptionProviderSynchronizationRepository(), composition.recurringProvider as any, { authorityReference: authority.publicReference, operationId: input.operationId });
      break;
    }
    case "retry-cancellation": {
      const cancellation = await synchronizeProviderCancellation(createPrismaSubscriptionCancellationRepository(), composition.recurringProvider as any, { contractReference: input.contractReference, operationId: input.operationId });
      const effective = await applySubscriptionCancellation(createPrismaSubscriptionCancellationRepository(), { contractReference: input.contractReference, operationId: `${input.operationId}:effective` });
      result = Object.freeze({ outcome: cancellation.outcome === "RECONCILIATION_REQUIRED" ? "RECONCILIATION_REQUIRED" as const : effective.outcome, cancellation, effective });
      break;
    }
    case "retry-entitlement-reconciliation": {
      const invoice = await db.subscriptionInvoice.findFirst({ where: { contract: { publicReference: input.contractReference }, status: "REFUNDED" }, select: { id: true } });
      if (!invoice) { await openRecoveryCase(input.contractReference, input.operationId, "REFUND_ENTITLEMENT_EVIDENCE_MISSING"); result = Object.freeze({ outcome: "RECONCILIATION_REQUIRED" as const }); break; }
      result = await applySubscriptionEntitlementRefundAdjustment(createPrismaSubscriptionEntitlementRefundRepository(), { invoiceId: invoice.id, refundReference: `recovery:${input.operationId}`, operationId: input.operationId });
      break;
    }
    case "retry-refund": {
      // This composes Phase 15's request/replay path and subscription
      // adjustment evidence. It deliberately never completes a provider refund.
      const invoice = await db.subscriptionInvoice.findFirst({ where: { contract: { publicReference: input.contractReference }, status: "PAID" }, select: { publicReference: true, payerUserId: true } });
      if (!invoice) { await openRecoveryCase(input.contractReference, input.operationId, "REFUND_REQUIRES_PAID_INVOICE"); result = Object.freeze({ outcome: "RECONCILIATION_REQUIRED" as const }); break; }
      result = await requestSubscriptionRefund(createPrismaSubscriptionRefundRepository(), { invoiceReference: invoice.publicReference, payerUserId: invoice.payerUserId, reason: "PROVIDER_RECONCILIATION", operationId: input.operationId });
      break;
    }
    case "rescan":
      await openRecoveryCase(input.contractReference, input.operationId, "ADMIN_RESCAN_REQUESTED");
      result = Object.freeze({ outcome: "RECONCILIATION_REQUIRED" as const });
      break;
  }
  await recordAdministrativeRecoveryReceipt(input.contractReference, input.operation, input.operationId, result);
  return result;
}
