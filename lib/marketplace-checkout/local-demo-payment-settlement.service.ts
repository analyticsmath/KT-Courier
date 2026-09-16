import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { isLocalFullFlowAllowed } from "@/lib/testing/safe-postgres-validator";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";
import { onVerifiedMarketplacePaymentSucceededInProduction } from "@/lib/marketplace-checkout/marketplace-payment-success-hook.service";

export async function settleAndFinalizeLocalDemoPayment(input: {
  paymentId: string;
  checkoutId: string;
  operationId: string;
}): Promise<void> {
  if (!isLocalFullFlowAllowed()) {
    throw new Error("Local demo deterministic payment settlement is only allowed under strict local demo conjunction.");
  }

  const now = new Date();

  // 1. Transaction to update Payment and Attempt and post balanced Ledger Journal
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const payment = await tx.payment.findUnique({
      where: { id: input.paymentId },
      select: {
        id: true,
        publicReference: true,
        marketplaceCheckoutId: true,
        status: true,
        amount: true,
        currency: true,
        latestAttemptNumber: true,
      },
    });

    if (!payment || payment.marketplaceCheckoutId !== input.checkoutId) {
      throw new Error("Payment or associated marketplace checkout not found.");
    }

    if (payment.status === "SUCCEEDED") {
      // Already settled idempotently
      return;
    }

    // Resolve platform accounts for gross cash receipt
    const accounts = await tx.ledgerAccount.findMany({
      where: {
        wallet: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" },
        code: { in: ["PLATFORM-CASH-CLEARING-ZAR", "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR"] },
        currency: "ZAR",
        status: "ACTIVE",
      },
      select: { id: true, code: true, purpose: true, category: true },
    });

    const cashAccount = accounts.find((a) => a.code === "PLATFORM-CASH-CLEARING-ZAR");
    const heldAccount = accounts.find((a) => a.code === "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR");

    if (!cashAccount || !heldAccount) {
      throw new Error("Required platform ledger accounts (CASH-CLEARING or CUSTOMER-FUNDS-HELD) not found.");
    }

    const amountStr = payment.amount.toFixed(2);
    const attemptNumber = (payment.latestAttemptNumber ?? 0) + 1;
    const attemptPublicRef = `pat_local_${randomBytes(12).toString("hex")}`;
    const merchantRef = `kt:local:${randomBytes(12).toString("hex")}`;
    const providerRef = `local_demo_${randomBytes(12).toString("hex")}`;

    // Create balanced ledger journal
    const journal = await postLedgerJournalWithinTransaction(tx, {
      idempotencyKey: `local-demo:journal:${payment.publicReference}:${input.operationId}`,
      sourceReference: `local-demo:payment:${payment.publicReference}`,
      correlationId: payment.publicReference,
      type: "EXTERNAL_PAYMENT_RECEIPT",
      currency: "ZAR",
      memo: "Local demo deterministic payment receipt; debits equal credits.",
      metadata: {
        paymentReference: payment.publicReference,
        attemptReference: attemptPublicRef,
        providerPaymentId: providerRef,
        provider: "LOCAL_DEMO",
      },
      actor: { kind: "SYSTEM" },
      entries: [
        {
          accountId: cashAccount.id,
          direction: "DEBIT",
          amount: amountStr,
          lineCode: "PAYSTACK_CASH_RECEIVED",
          memo: "Local demo gross cash receipt",
        },
        {
          accountId: heldAccount.id,
          direction: "CREDIT",
          amount: amountStr,
          lineCode: "CUSTOMER_FUNDS_HELD",
          memo: "Customer service value held pending fulfilment",
        },
      ],
    });

    // Bind payment provider to PAYSTACK before creating attempt, satisfying validate_payment_attempt_provider trigger
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        provider: "PAYSTACK",
      },
    });

    // Create successful PaymentAttempt
    const attempt = await tx.paymentAttempt.create({
      data: {
        publicReference: attemptPublicRef,
        paymentId: payment.id,
        attemptNumber,
        provider: "PAYSTACK",
        idempotencyKey: `local-demo:${input.operationId}:attempt`,
        requestHash: createHash("sha256").update(`local-demo:${input.operationId}`).digest("hex"),
        merchantReference: merchantRef,
        providerReference: providerRef,
        status: "SUCCEEDED",
        amount: payment.amount,
        currency: "ZAR",
        providerStatusCode: "success",
        startedAt: now,
        completedAt: now,
        providerConfirmedAt: now,
        version: 1,
      },
    });

    // Create durable verified PaymentWebhookEvent linking to attempt and journal
    const eventPublicRef = `pwe_local_${randomBytes(12).toString("hex")}`;
    const webhookEvent = await tx.paymentWebhookEvent.create({
      data: {
        publicReference: eventPublicRef,
        provider: "PAYSTACK",
        environment: "SANDBOX",
        eventFingerprint: createHash("sha256").update(`evt_${payment.id}_${input.operationId}`).digest("hex"),
        merchantReference: merchantRef,
        providerPaymentId: providerRef,
        providerStatus: "success",
        normalizedStatus: "COMPLETE",
        processingStatus: "APPLIED",
        paymentId: payment.id,
        attemptId: attempt.id,
        ledgerJournalId: journal.id,
        sourceAddressVerified: true,
        signatureVerified: true,
        merchantVerified: true,
        amountVerified: true,
        providerDataVerified: true,
        receivedAt: now,
        verifiedAt: now,
        appliedAt: now,
        unknownFieldCount: 0,
      },
    });

    // Update payment to SUCCEEDED with full immutable success evidence
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCEEDED",
        provider: "PAYSTACK",
        successfulAttemptId: attempt.id,
        successWebhookEventId: webhookEvent.id,
        successLedgerJournalId: journal.id,
        providerConfirmedAt: now,
        succeededAt: now,
        reconciliationStatus: "RESOLVED",
        latestAttemptNumber: attemptNumber,
        version: { increment: 1 },
      },
    });

    // Create PaymentVerifiedEventIntent outbox entry
    const eventIdentity = `event_${payment.publicReference}_${eventPublicRef}`;
    const verifiedPublicRef = `pve_local_${randomBytes(12).toString("hex")}`;
    await tx.paymentVerifiedEventIntent.create({
      data: {
        publicReference: verifiedPublicRef,
        eventIdentity,
        eventType: "PAYMENT_SUCCEEDED_VERIFIED",
        paymentId: payment.id,
        successfulAttemptId: attempt.id,
        webhookEventId: webhookEvent.id,
        paymentReference: payment.publicReference,
        subjectType: "MARKETPLACE_CHECKOUT",
        subjectReference: payment.marketplaceCheckoutId ?? payment.publicReference,
        amount: payment.amount,
        currency: "ZAR",
        provider: "PAYSTACK",
        verifiedAt: now,
        schemaVersion: 1,
      },
    });

    // Status history
    await tx.paymentStatusHistory.create({
      data: {
        paymentId: payment.id,
        attemptId: attempt.id,
        fromStatus: payment.status,
        toStatus: "SUCCEEDED",
        reasonCode: "LOCAL_DEMO_PAYMENT_SUCCEEDED",
        actorType: "SYSTEM",
        metadata: {
          ledgerJournalReference: journal.reference,
          providerReference: providerRef,
        },
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  // 2. Trigger canonical order finalization
  await onVerifiedMarketplacePaymentSucceededInProduction(input.paymentId);
}
