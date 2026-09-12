import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import {
  claimPaystackWebhookEventsBatch,
  ingestPaystackWebhook,
  applyPaystackWebhookEventsBatch,
  processClaimedPaystackWebhookEvent,
  type ClaimedWebhookEvent,
} from "@/lib/services/paystack-webhook-application.service";
import type { PaystackClient } from "@/lib/payments/providers/paystack/paystack-client";
import { openPaymentDispute } from "@/lib/services/payment-dispute.service";
import { createWithdrawalRequest } from "@/lib/services/withdrawal-request.service";
import { approveWithdrawal } from "@/lib/services/withdrawal-finance-review.service";
import {
  startWithdrawalPayout,
  completeManualWithdrawalPayout,
} from "@/lib/services/withdrawal-payout.service";
import { createPayableOrder } from "./payment-fixtures";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeReal = hasDatabase ? describe : describe.skip;

describeReal("Phase 1: Real PostgreSQL Webhook Concurrency & Durability Integration", () => {
  const hex64 = (s: string) => createHash("sha256").update(s).digest("hex");
  const testNonce = randomBytes(8).toString("hex");
  const trackedPublicRefs: string[] = [];

  const drainPendingEvents = async () => {
    await prisma.paymentWebhookEvent.updateMany({
      where: { processingStatus: { in: ["RECEIVED", "PROCESSING"] } },
      data: { processingStatus: "REJECTED", rejectionCode: "TEST_CLEANUP" },
    });
  };

  beforeAll(async () => {
    await drainPendingEvents();
  });

  afterEach(async () => {
    await drainPendingEvents();
  });

  const createTestEvent = async (overrides?: {
    processingStatus?: "RECEIVED" | "PROCESSING" | "REJECTED";
    leaseToken?: string | null;
    leaseExpiresAt?: Date | null;
    nextAttemptAt?: Date | null;
    receivedAt?: Date;
    suffix?: string;
  }) => {
    const idStr = `${testNonce}_${overrides?.suffix ?? randomBytes(6).toString("hex")}`;
    const pubRef = `pwe_concur_${idStr}`;
    trackedPublicRefs.push(pubRef);

    return prisma.paymentWebhookEvent.create({
      data: {
        publicReference: pubRef,
        provider: "PAYSTACK",
        providerPaymentId: `pay_${idStr}`,
        merchantReference: `merch_ref_${idStr}`,
        eventFingerprint: hex64(`fp_${idStr}`),
        environment: "SANDBOX",
        providerStatus: "success",
        normalizedStatus: "COMPLETE",
        processingStatus: overrides?.processingStatus ?? "RECEIVED",
        leaseToken: overrides?.leaseToken ?? null,
        leaseExpiresAt: overrides?.leaseExpiresAt ?? null,
        nextAttemptAt: overrides?.nextAttemptAt ?? null,
        receivedAt: overrides?.receivedAt ?? new Date(),
      },
    });
  };

  afterAll(async () => {
    // PaymentWebhookEvent is append-only with immutability triggers (cannot DELETE).
    // Mark non-terminal test rows REJECTED so they never interfere with future workers.
    if (trackedPublicRefs.length > 0) {
      await prisma.paymentWebhookEvent.updateMany({
        where: {
          publicReference: { in: trackedPublicRefs },
          processingStatus: { in: ["RECEIVED", "PROCESSING"] },
        },
        data: { processingStatus: "REJECTED", rejectionCode: "TEST_CLEANUP" },
      });
    }
  });

  it("1. real inbox rows are created and two concurrent claimers run with zero overlap", async () => {
    // Seed 10 real inbox rows in PostgreSQL with very early receivedAt to prioritize them
    const baseTime = new Date(20000000);
    const seededRows = [];
    for (let i = 0; i < 10; i++) {
      const row = await createTestEvent({
        processingStatus: "RECEIVED",
        receivedAt: new Date(baseTime.getTime() + i * 1000),
        suffix: `batch1_${i}`,
      });
      seededRows.push(row);
    }
    expect(seededRows).toHaveLength(10);

    // Run two concurrent claimers simultaneously
    const [claimedA, claimedB] = await Promise.all([
      claimPaystackWebhookEventsBatch({ batchSize: 5 }),
      claimPaystackWebhookEventsBatch({ batchSize: 5 }),
    ]);

    expect(claimedA.length).toBeGreaterThanOrEqual(1);
    expect(claimedB.length).toBeGreaterThanOrEqual(1);

    // Proves claimed sets do not overlap
    const idsA = claimedA.map((r) => r.id);
    const idsB = claimedB.map((r) => r.id);
    const setA = new Set(idsA);
    const overlap = idsB.filter((id) => setA.has(id));
    expect(overlap).toHaveLength(0);

    // Proves each row has at most one active lease
    const tokenA = claimedA[0].leaseToken;
    const tokenB = claimedB[0].leaseToken;
    expect(tokenA).not.toBe(tokenB);

    // Verify lease integrity in real database
    const dbRowsA = await prisma.paymentWebhookEvent.findMany({
      where: { id: { in: idsA } },
      select: { id: true, leaseToken: true, processingStatus: true, leaseExpiresAt: true },
    });
    for (const row of dbRowsA) {
      expect(row.leaseToken).toBe(tokenA);
      expect(row.processingStatus).toBe("PROCESSING");
      expect(row.leaseExpiresAt!.getTime()).toBeGreaterThan(Date.now());
    }

    const dbRowsB = await prisma.paymentWebhookEvent.findMany({
      where: { id: { in: idsB } },
      select: { id: true, leaseToken: true, processingStatus: true, leaseExpiresAt: true },
    });
    for (const row of dbRowsB) {
      expect(row.leaseToken).toBe(tokenB);
      expect(row.processingStatus).toBe("PROCESSING");
      expect(row.leaseExpiresAt!.getTime()).toBeGreaterThan(Date.now());
    }
  });

  it("2. expired leases are reclaimable; non-expired leases are not", async () => {
    const expiredToken = `expired_token_${randomBytes(4).toString("hex")}`;
    const activeToken = `active_token_${randomBytes(4).toString("hex")}`;

    // Earliest timestamp to guarantee top queue priority
    const priorityTime = new Date(10000000);

    // Expired row: lease expired 30 seconds ago, top priority in queue
    const expiredRow = await createTestEvent({
      processingStatus: "PROCESSING",
      leaseToken: expiredToken,
      leaseExpiresAt: new Date(Date.now() - 30_000),
      receivedAt: priorityTime,
      suffix: `exp_${randomBytes(4).toString("hex")}`,
    });

    // Non-expired row: lease valid for another 10 minutes, same top priority
    const activeRow = await createTestEvent({
      processingStatus: "PROCESSING",
      leaseToken: activeToken,
      leaseExpiresAt: new Date(Date.now() + 600_000),
      receivedAt: priorityTime,
      suffix: `act_${randomBytes(4).toString("hex")}`,
    });

    // Run claim batch
    const claimed = await claimPaystackWebhookEventsBatch({ batchSize: 20 });
    const claimedIds = claimed.map((r) => r.id);

    // Expired lease was reclaimed
    expect(claimedIds).toContain(expiredRow.id);

    // Non-expired lease was NOT reclaimed (skipped)
    expect(claimedIds).not.toContain(activeRow.id);

    // Verify the expired row now has a new lease token in DB
    const reloadedExpired = await prisma.paymentWebhookEvent.findUnique({
      where: { id: expiredRow.id },
      select: { leaseToken: true, leaseExpiresAt: true, processingStatus: true },
    });
    expect(reloadedExpired?.leaseToken).not.toBe(expiredToken);
    expect(reloadedExpired?.processingStatus).toBe("PROCESSING");
    expect(reloadedExpired?.leaseExpiresAt!.getTime()).toBeGreaterThan(Date.now());

    // Verify the active row still has its original lease token in DB
    const reloadedActive = await prisma.paymentWebhookEvent.findUnique({
      where: { id: activeRow.id },
      select: { leaseToken: true, processingStatus: true },
    });
    expect(reloadedActive?.leaseToken).toBe(activeToken);
    expect(reloadedActive?.processingStatus).toBe("PROCESSING");
  });

  it("3. nextAttemptAt backoff is strictly respected", async () => {
    const futureAttemptAt = new Date(Date.now() + 900_000); // 15 mins in future
    const pastAttemptAt = new Date(Date.now() - 60_000); // 1 min in past
    const priorityTime = new Date(15000000);

    // Row in future backoff: must not be claimed
    const backedOffRow = await createTestEvent({
      processingStatus: "RECEIVED",
      nextAttemptAt: futureAttemptAt,
      receivedAt: priorityTime,
      suffix: `backoff_${randomBytes(4).toString("hex")}`,
    });

    // Row with past nextAttemptAt: must be claimable
    const readyRow = await createTestEvent({
      processingStatus: "RECEIVED",
      nextAttemptAt: pastAttemptAt,
      receivedAt: priorityTime,
      suffix: `ready_${randomBytes(4).toString("hex")}`,
    });

    const claimed = await claimPaystackWebhookEventsBatch({ batchSize: 20 });
    const claimedIds = claimed.map((r) => r.id);

    // Ready row is claimed
    expect(claimedIds).toContain(readyRow.id);

    // Backed-off row is strictly skipped
    expect(claimedIds).not.toContain(backedOffRow.id);

    // Now advance nextAttemptAt to past
    await prisma.paymentWebhookEvent.update({
      where: { id: backedOffRow.id },
      data: { nextAttemptAt: new Date(Date.now() - 1000) },
    });

    // Second claim should now successfully claim the backed-off row
    const reclaimed = await claimPaystackWebhookEventsBatch({ batchSize: 20 });
    const reclaimedIds = reclaimed.map((r) => r.id);
    expect(reclaimedIds).toContain(backedOffRow.id);
  });

  it("4. duplicate invocation cannot duplicate the financial side effect", async () => {
    const rawBody = JSON.stringify({
      event: "charge.success",
      data: {
        id: Math.floor(Math.random() * 10000000) + 1000000,
        reference: `merch_ref_${testNonce}_dup_001`,
        status: "success",
        amount: 50000,
        currency: "ZAR",
      },
    });

    const initialJournalCount = await prisma.ledgerJournal.count();
    const secretKey = "sk_test_mock_for_concurrency_proof";
    const signature = createHmac("sha512", secretKey).update(rawBody).digest("hex");

    // First HTTP ingestion
    const res1 = await ingestPaystackWebhook({
      rawBody,
      signature,
      secretKey,
    });
    trackedPublicRefs.push(res1.eventPublicReference);

    expect(res1.received).toBe(true);
    expect(res1.duplicate).toBe(false);

    // Second duplicate ingestion with identical payload
    const res2 = await ingestPaystackWebhook({
      rawBody,
      signature,
      secretKey,
    });

    expect(res2.received).toBe(true);
    expect(res2.duplicate).toBe(true);
    expect(res2.eventPublicReference).toBe(res1.eventPublicReference);

    // Proves idempotent single row storage in PostgreSQL
    const eventCount = await prisma.paymentWebhookEvent.count({
      where: { publicReference: res1.eventPublicReference },
    });
    expect(eventCount).toBe(1);

    // Proves financial conservation: zero ledger journals created on duplicate
    const finalJournalCount = await prisma.ledgerJournal.count();
    expect(finalJournalCount).toBe(initialJournalCount);
  });

  // ─── Test Suite Fixture Helpers ──────────────────────────────────────────────

  const ensurePlatformAccounts = async () => {
    const platformWallet = await prisma.wallet.upsert({
      where: { ownerType_ownerId_currency: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" } },
      update: {},
      create: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" },
    });

    const cashAccount = await prisma.ledgerAccount.upsert({
      where: { code: "PLATFORM-CASH-CLEARING-ZAR" },
      update: { currentBalance: new Prisma.Decimal("500000.00") },
      create: {
        walletId: platformWallet.id,
        code: "PLATFORM-CASH-CLEARING-ZAR",
        purpose: "CASH_CLEARING",
        category: "ASSET",
        currency: "ZAR",
        allowNegative: false,
        status: "ACTIVE",
        currentBalance: new Prisma.Decimal("500000.00"),
      },
    });

    const platformHeld = await prisma.ledgerAccount.upsert({
      where: { code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR" },
      update: { currentBalance: new Prisma.Decimal("500000.00") },
      create: {
        walletId: platformWallet.id,
        code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR",
        purpose: "HELD",
        category: "LIABILITY",
        currency: "ZAR",
        allowNegative: false,
        status: "ACTIVE",
        currentBalance: new Prisma.Decimal("500000.00"),
      },
    });

    await prisma.withdrawalPolicy.upsert({
      where: { ownerType_currency: { ownerType: "STORE", currency: "ZAR" } },
      update: { enabled: true },
      create: {
        ownerType: "STORE",
        currency: "ZAR",
        enabled: true,
        minimumAmount: new Prisma.Decimal("10.00"),
        maximumAmount: new Prisma.Decimal("50000.00"),
        dailyMaximumAmount: new Prisma.Decimal("100000.00"),
        version: 1,
      },
    });

    return { platformWallet, cashAccount, platformHeld };
  };

  const createStoreWithReleasedEarning = async (tag: string, amountStr = "1000.00") => {
    const { platformHeld } = await ensurePlatformAccounts();
    const amountDec = new Prisma.Decimal(amountStr);
    const randSuffix = randomBytes(4).toString("hex").toUpperCase();
    const randHex = randSuffix.toLowerCase();

    const ownerUser = await prisma.user.create({
      data: {
        email: `owner_${tag}_${randHex}@example.test`,
        role: "STORE",
        status: "ACTIVE",
        name: `Store Owner ${tag}`,
      },
    });

    const approverUser = await prisma.user.create({
      data: {
        email: `approver_${tag}_${randHex}@example.test`,
        role: "ADMIN",
        status: "ACTIVE",
        name: `Finance Approver ${tag}`,
      },
    });

    const processorUser = await prisma.user.create({
      data: {
        email: `processor_${tag}_${randHex}@example.test`,
        role: "ADMIN",
        status: "ACTIVE",
        name: `Finance Processor ${tag}`,
      },
    });

    const store = await prisma.store.create({
      data: {
        ownerUserId: ownerUser.id,
        name: `Store ${tag} ${randSuffix}`,
        slug: `store-${tag.toLowerCase().slice(0, 15)}-${randHex}`,
        status: "ACTIVE",
      },
    });

    const storeWallet = await prisma.wallet.create({
      data: {
        ownerType: "STORE",
        ownerId: store.id,
        currency: "ZAR",
        status: "ACTIVE",
      },
    });

    const payableAccount = await prisma.ledgerAccount.create({
      data: {
        walletId: storeWallet.id,
        code: `ST-PAY-${randSuffix}`,
        purpose: "STORE_EARNINGS_PAYABLE",
        category: "LIABILITY",
        currency: "ZAR",
        allowNegative: false,
        status: "ACTIVE",
        currentBalance: new Prisma.Decimal("0.00"),
      },
    });

    const withdrawableAccount = await prisma.ledgerAccount.create({
      data: {
        walletId: storeWallet.id,
        code: `OWN-WD-${randSuffix}`,
        purpose: "OWNER_WITHDRAWABLE",
        category: "LIABILITY",
        currency: "ZAR",
        allowNegative: false,
        status: "ACTIVE",
        currentBalance: amountDec,
      },
    });

    const heldAccount = await prisma.ledgerAccount.create({
      data: {
        walletId: storeWallet.id,
        code: `ST-WD-HELD-${randSuffix}`,
        purpose: "WITHDRAWAL_HELD",
        category: "LIABILITY",
        currency: "ZAR",
        allowNegative: false,
        status: "ACTIVE",
        currentBalance: new Prisma.Decimal("0.00"),
      },
    });

    const payoutDest = await prisma.payoutDestination.create({
      data: {
        publicReference: `dest_${tag}_${randHex}`,
        walletId: storeWallet.id,
        ownerType: "STORE",
        ownerId: store.id,
        method: "MANUAL_EXTERNAL",
        providerCode: "MANUAL_FINANCE",
        externalReference: `manual-finance:${randHex}`,
        maskedLabel: "****5678",
        status: "ACTIVE",
        currency: "ZAR",
      },
    });

    // Create payment through paystack webhook execution so it has coherent triggers
    const { user: customerUser, order } = await createPayableOrder(randomUUID());
    const paymentRef = `pay_${tag}_${randomBytes(8).toString("hex")}`;
    const attemptRef = `pat_${tag}_${randomBytes(8).toString("hex")}`;
    const secretKey = "sk_test_mock_for_concurrency_proof";

    const payment = await prisma.payment.create({
      data: {
        publicReference: paymentRef,
        userId: customerUser.id,
        orderId: order.id,
        subjectType: "COURIER_ORDER",
        status: "CREATED",
        amount: amountDec,
        currency: "ZAR",
        creationIdempotencyKey: `idem_pay_${tag}_${randHex}`,
        creationRequestHash: hex64(`hash_${tag}_${randHex}`),
        provider: "PAYSTACK",
      },
    });

    await prisma.paymentAttempt.create({
      data: {
        publicReference: attemptRef,
        paymentId: payment.id,
        attemptNumber: 1,
        provider: "PAYSTACK",
        providerEnvironment: "SANDBOX",
        providerCredentialVersion: "test-v1",
        idempotencyKey: `idem_att_${tag}_${randHex}`,
        requestHash: hex64(`att_hash_${tag}_${randHex}`),
        merchantReference: attemptRef,
        status: "PROCESSING",
        amount: amountDec,
        currency: "ZAR",
      },
    });

    const amountSubunits = Math.round(Number(amountStr) * 100);
    const rawBody = JSON.stringify({
      event: "charge.success",
      data: {
        id: Math.floor(Math.random() * 10000000) + 1000000,
        reference: attemptRef,
        status: "success",
        amount: amountSubunits,
        currency: "ZAR",
      },
    });
    const signature = createHmac("sha512", secretKey).update(rawBody).digest("hex");
    const ingestRes = await ingestPaystackWebhook({ rawBody, signature, secretKey });
    trackedPublicRefs.push(ingestRes.eventPublicReference);

    const claimedEvent = await prisma.paymentWebhookEvent.findUniqueOrThrow({
      where: { publicReference: ingestRes.eventPublicReference },
    });
    await processClaimedPaystackWebhookEvent(
      { ...claimedEvent, leaseToken: `lease_${tag}_${randHex}` } as unknown as ClaimedWebhookEvent,
      {
        clientOverride: {
          verifyTransaction: async (ref: string) => ({
            status: true,
            message: "Verification successful",
            data: { id: 12345678, status: "success", reference: ref, amount: amountSubunits, currency: "ZAR" },
          }),
        } as unknown as PaystackClient,
        secretKey,
      }
    );

    // Accrual & Release journals for StoreEarning
    const accrualJournal = await prisma.ledgerJournal.create({
      data: {
        reference: `jnl_acc_${tag}_${randHex}`,
        type: "STORE_EARNING_ACCRUAL",
        currency: "ZAR",
        idempotencyKey: `idem_acc_${tag}_${randHex}`,
        requestHash: hex64(`acc_hash_${tag}_${randHex}`),
        policyVersion: "v1",
        totalDebits: amountDec,
        totalCredits: amountDec,
        entries: {
          create: [
            { sequence: 1, accountId: platformHeld.id, direction: "DEBIT", amount: amountDec, lineCode: "PLATFORM_HELD_DEBIT" },
            { sequence: 2, accountId: payableAccount.id, direction: "CREDIT", amount: amountDec, lineCode: "STORE_PAYABLE_CREDIT" },
          ],
        },
      },
    });

    const releaseJournal = await prisma.ledgerJournal.create({
      data: {
        reference: `jnl_rel_${tag}_${randHex}`,
        type: "STORE_EARNING_RELEASE",
        currency: "ZAR",
        idempotencyKey: `idem_rel_${tag}_${randHex}`,
        requestHash: hex64(`rel_hash_${tag}_${randHex}`),
        policyVersion: "v1",
        totalDebits: amountDec,
        totalCredits: amountDec,
        entries: {
          create: [
            { sequence: 1, accountId: payableAccount.id, direction: "DEBIT", amount: amountDec, lineCode: "STORE_PAYABLE_DEBIT" },
            { sequence: 2, accountId: withdrawableAccount.id, direction: "CREDIT", amount: amountDec, lineCode: "STORE_WITHDRAWABLE_CREDIT" },
          ],
        },
      },
    });

    const storeEarning = await prisma.storeEarning.create({
      data: {
        publicReference: `ste_${tag}_${randHex}`,
        storeId: store.id,
        storePublicReference: store.slug,
        walletId: storeWallet.id,
        payableAccountId: payableAccount.id,
        subjectType: "MARKETPLACE_ORDER",
        subjectId: `ord_${tag}_${randHex}`,
        subjectPublicReference: `ord_ref_${tag}_${randHex}`,
        paymentId: payment.id,
        paymentPublicReference: payment.publicReference,
        settlementReference: `stl_${tag}_${randHex}`,
        settlementVersion: "v1",
        calculationVersion: "v1",
        authoritativeAt: new Date(),
        settlementBasisAmount: amountDec,
        attributedCommissionAmount: new Prisma.Decimal("0.00"),
        amount: amountDec,
        currency: "ZAR",
        status: "RELEASED",
        creationIdempotencyKey: `idem_ste_${tag}_${randHex}`,
        creationRequestHash: hex64(`ste_hash_${tag}_${randHex}`),
        calculationHash: hex64(`calc_hash_${tag}_${randHex}`),
        accrualLedgerJournalId: accrualJournal.id,
        releaseLedgerJournalId: releaseJournal.id,
        releasedAmount: amountDec,
        releasedAt: new Date(),
      },
    });

    return {
      ownerUser,
      approverUser,
      processorUser,
      store,
      storeWallet,
      payoutDest,
      payment,
      storeEarning,
      withdrawableAccount,
      heldAccount,
    };
  };

  // ─── Test Suite A: Concurrent Webhook Application Race ──────────────────────

  it("5. Test Suite A: concurrent webhook workers race to apply charge.success, yielding exactly 1 APPLIED and 1 journal", async () => {
    await ensurePlatformAccounts();
    const tag = `${testNonce}_suite_a`;
    const { user: customerUser, order } = await createPayableOrder(randomUUID());
    const paymentRef = `pay_${tag}_${randomBytes(8).toString("hex")}`;
    const attemptRef = `pat_${tag}_${randomBytes(8).toString("hex")}`;
    const secretKey = "sk_test_mock_for_concurrency_race";

    const payment = await prisma.payment.create({
      data: {
        publicReference: paymentRef,
        userId: customerUser.id,
        orderId: order.id,
        subjectType: "COURIER_ORDER",
        status: "CREATED",
        amount: new Prisma.Decimal("250.00"),
        currency: "ZAR",
        creationIdempotencyKey: `idem_pay_${tag}`,
        creationRequestHash: hex64(`hash_${tag}`),
        provider: "PAYSTACK",
      },
    });

    const attempt = await prisma.paymentAttempt.create({
      data: {
        publicReference: attemptRef,
        paymentId: payment.id,
        attemptNumber: 1,
        provider: "PAYSTACK",
        providerEnvironment: "SANDBOX",
        providerCredentialVersion: "test-v1",
        idempotencyKey: `idem_att_${tag}`,
        requestHash: hex64(`att_hash_${tag}`),
        merchantReference: attemptRef,
        status: "PROCESSING",
        amount: new Prisma.Decimal("250.00"),
        currency: "ZAR",
      },
    });

    const rawBody = JSON.stringify({
      event: "charge.success",
      data: {
        id: Math.floor(Math.random() * 10000000) + 1000000,
        reference: attemptRef,
        status: "success",
        amount: 25000,
        currency: "ZAR",
      },
    });
    const signature = createHmac("sha512", secretKey).update(rawBody).digest("hex");

    // Ingest canonical webhook payload via ingestPaystackWebhook
    const ingestRes = await ingestPaystackWebhook({ rawBody, signature, secretKey });
    trackedPublicRefs.push(ingestRes.eventPublicReference);
    expect(ingestRes.received).toBe(true);
    expect(ingestRes.duplicate).toBe(false);

    const mockClient = {
      verifyTransaction: async (ref: string) => ({
        status: true,
        message: "Verification successful",
        data: { id: 12345678, status: "success", reference: ref, amount: 25000, currency: "ZAR" },
      }),
    } as unknown as PaystackClient;

    // Fire concurrent applyPaystackWebhookEventsBatch across 4 parallel workers
    const workerPromises = [1, 2, 3, 4].map(() =>
      applyPaystackWebhookEventsBatch({
        batchSize: 10,
        clientOverride: mockClient,
        secretKey,
      })
    );

    const results = await Promise.all(workerPromises);

    // Exactly one worker committed the APPLIED outcome
    const totalCompleted = results.reduce((sum, r) => sum + r.itemsCompleted, 0);
    expect(totalCompleted).toBe(1);

    // One single payment reaches terminal SUCCEEDED
    const finalPayment = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(finalPayment.status).toBe("SUCCEEDED");
    expect(finalPayment.reconciliationStatus).toBe("RESOLVED");

    const finalAttempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(finalAttempt.status).toBe("SUCCEEDED");

    // Exactly one set of ledger journals is posted
    const journals = await prisma.ledgerJournal.findMany({ where: { correlationId: paymentRef } });
    expect(journals).toHaveLength(1);
    expect(journals[0].type).toBe("EXTERNAL_PAYMENT_RECEIPT");

    // Replay / Reclaim assertions:
    // 1. Re-running batch produces zero new journals or items examined
    const rerunBatch = await applyPaystackWebhookEventsBatch({
      batchSize: 10,
      clientOverride: mockClient,
      secretKey,
    });
    expect(rerunBatch.itemsCompleted).toBe(0);

    // 2. Re-ingesting webhook payload returns duplicate: true
    const replayIngest = await ingestPaystackWebhook({ rawBody, signature, secretKey });
    expect(replayIngest.duplicate).toBe(true);

    // 3. Final ledger journals count remains strictly 1 (zero duplicate journals or double-spend)
    const afterReplayJournals = await prisma.ledgerJournal.findMany({ where: { correlationId: paymentRef } });
    expect(afterReplayJournals).toHaveLength(1);
  });

  // ─── Test Suite B: Dispute vs Payout Settlement Races ───────────────────────

  it("6. Test Suite B1: concurrent dispute vs manual payout on in-flight withdrawal serializes cleanly to RECOVERY_RECEIVABLE", async () => {
    const tag = `${testNonce}_race_inflight`;
    const fixture = await createStoreWithReleasedEarning(tag, "1000.00");

    // 1. Create withdrawal request for R1,000 against the released earning
    const withdrawal = await createWithdrawalRequest({
      actorUserId: fixture.ownerUser.id,
      amount: "1000.00",
      payoutDestinationPublicReference: fixture.payoutDest.publicReference,
      operationId: `op_wd_${tag}`,
    });

    // 2. Approve withdrawal
    await approveWithdrawal({
      actorUserId: fixture.approverUser.id,
      publicReference: withdrawal.publicReference,
      operationId: `op_app_${tag}`,
    });

    // 3. Start payout, placing it in PROCESSING status (in-flight at provider)
    const payoutAttempt = await startWithdrawalPayout({
      actorUserId: fixture.processorUser.id,
      publicReference: withdrawal.publicReference,
      operationId: `op_start_${tag}`,
    });
    expect(payoutAttempt.status).toBe("PROCESSING");

    // Verify allocation exists in RESERVED status
    const initialAllocs = await prisma.withdrawalEarningAllocation.findMany({
      where: { withdrawalRequestId: withdrawal.id },
    });
    expect(initialAllocs).toHaveLength(1);
    expect(initialAllocs[0].status).toBe("RESERVED");

    // 4. Concurrently trigger completeManualWithdrawalPayout and openPaymentDispute
    const externalPayoutRef = `manual-bank:ext_payout_${tag}`;
    const disputeId = `disp_prov_${tag}`;

    const [payoutResult, disputeResult] = await Promise.allSettled([
      completeManualWithdrawalPayout({
        actorUserId: fixture.processorUser.id,
        withdrawalPublicReference: withdrawal.publicReference,
        payoutAttemptPublicReference: payoutAttempt.publicReference,
        externalPayoutReference: externalPayoutRef,
        operationId: `op_complete_${tag}`,
        safeEvidenceReference: "bank-stmt-evidence-001",
      }),
      openPaymentDispute({
        paymentId: fixture.payment.id,
        providerDisputeId: disputeId,
        amount: "600.00",
        currency: "ZAR",
        reason: "FRAUDULENT",
        actorType: "PROVIDER",
        safeEvidence: { reason: "chargeback" },
      }),
    ]);

    // Both operations must resolve cleanly (zero deadlock, zero unhandled errors)
    expect(payoutResult.status).toBe("fulfilled");
    expect(disputeResult.status).toBe("fulfilled");

    // Terminal States:
    // Withdrawal must be PAID
    const finalWithdrawal = await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: withdrawal.id } });
    expect(finalWithdrawal.status).toBe("PAID");

    // Allocation must be SETTLED
    const finalAlloc = await prisma.withdrawalEarningAllocation.findUniqueOrThrow({ where: { id: initialAllocs[0].id } });
    expect(finalAlloc.status).toBe("SETTLED");

    // Dispute must be OPEN
    const finalDispute = await prisma.paymentDispute.findUniqueOrThrow({
      where: { providerDisputeId: disputeId },
      include: { allocations: true },
    });
    expect(finalDispute.status).toBe("OPEN");

    // Dispute allocation must be in RECOVERY_RECEIVABLE state
    expect(finalDispute.allocations).toHaveLength(1);
    const dispAlloc = finalDispute.allocations[0];
    expect(dispAlloc.holdingState).toBe("RECOVERY_RECEIVABLE");
    expect(dispAlloc.allocatedAmount.toString()).toBe("600");
    expect(dispAlloc.recoveryReceivableAmount.toString()).toBe("600");

    // Conservation check: Exactly 1 payout journal for withdrawal, exactly 1 receivable journal for dispute
    const payoutJournal = await prisma.ledgerJournal.findUniqueOrThrow({
      where: { id: finalWithdrawal.payoutLedgerJournalId! },
    });
    expect(payoutJournal.type).toBe("WITHDRAWAL_PAYOUT");
    expect(payoutJournal.totalDebits.toString()).toBe(payoutJournal.totalCredits.toString());

    // Verify all dispute journals are balanced (debits === credits)
    const disputeJournals = await prisma.ledgerJournal.findMany({
      where: {
        OR: [
          { correlationId: finalDispute.publicReference },
          { sourceReference: { contains: finalDispute.publicReference } },
        ],
      },
    });
    expect(disputeJournals.length).toBeGreaterThanOrEqual(1);
    for (const j of [payoutJournal, ...disputeJournals]) {
      expect(j.totalDebits.toString()).toBe(j.totalCredits.toString());
    }
  });

  it("7. Test Suite B2: dispute intercepts pre-provider approved withdrawal, cancelling withdrawal and holding dispute funds", async () => {
    const tag = `${testNonce}_race_preprov`;
    const fixture = await createStoreWithReleasedEarning(tag, "1000.00");

    // 1. Create withdrawal request for R1,000
    const withdrawal = await createWithdrawalRequest({
      actorUserId: fixture.ownerUser.id,
      amount: "1000.00",
      payoutDestinationPublicReference: fixture.payoutDest.publicReference,
      operationId: `op_wd_${tag}`,
    });

    // 2. Approve withdrawal (pre-provider, no attempt started yet)
    await approveWithdrawal({
      actorUserId: fixture.approverUser.id,
      publicReference: withdrawal.publicReference,
      operationId: `op_app_${tag}`,
    });

    // 3. Race: openPaymentDispute vs startWithdrawalPayout
    const disputeId = `disp_preprov_${tag}`;
    const [disputeRes, startRes] = await Promise.allSettled([
      openPaymentDispute({
        paymentId: fixture.payment.id,
        providerDisputeId: disputeId,
        amount: "700.00",
        currency: "ZAR",
        reason: "FRAUDULENT",
        actorType: "PROVIDER",
        safeEvidence: { reason: "chargeback" },
      }),
      startWithdrawalPayout({
        actorUserId: fixture.processorUser.id,
        publicReference: withdrawal.publicReference,
        operationId: `op_start_${tag}`,
      }),
    ]);

    // Dispute must always succeed cleanly
    expect(disputeRes.status).toBe("fulfilled");

    // If dispute won the lock:
    // - Withdrawal is CANCELLED (cancellationReasonCode: DISPUTE_INTERCEPTED)
    // - Allocations are CANCELLED
    // - startWithdrawalPayout failed cleanly with WITHDRAWAL_INVALID_STATE
    // - Disputed R700 is held as RELEASED_HOLD in DISPUTE_HELD
    // If startWithdrawalPayout won the lock:
    // - Withdrawal moved to PROCESSING, dispute recorded IN_FLIGHT_HOLD
    const finalWithdrawal = await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: withdrawal.id } });
    const finalDispute = await prisma.paymentDispute.findUniqueOrThrow({
      where: { providerDisputeId: disputeId },
      include: { allocations: true },
    });

    expect(finalDispute.status).toBe("OPEN");
    expect(finalDispute.allocations).toHaveLength(1);

    if (finalWithdrawal.status === "CANCELLED") {
      expect(startRes.status).toBe("rejected");
      expect(finalWithdrawal.cancellationReasonCode).toBe("DISPUTE_INTERCEPTED");
      expect(finalDispute.allocations[0].holdingState).toBe("RELEASED_HOLD");
      expect(finalDispute.allocations[0].heldAmount.toString()).toBe("700");
    } else {
      expect(finalWithdrawal.status).toBe("PROCESSING");
      expect(finalDispute.allocations[0].holdingState).toBe("IN_FLIGHT_HOLD");
    }

    // Zero deadlock, zero unhandled errors, ledger balanced
    const journals = await prisma.ledgerJournal.findMany({
      where: {
        OR: [
          { reference: { contains: withdrawal.publicReference } },
          { reference: { contains: finalDispute.publicReference } },
        ],
      },
    });
    for (const j of journals) {
      expect(j.totalDebits.toString()).toBe(j.totalCredits.toString());
    }
  });
});
