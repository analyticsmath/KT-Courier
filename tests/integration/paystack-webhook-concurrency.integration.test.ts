import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  claimPaystackWebhookEventsBatch,
  ingestPaystackWebhook,
} from "@/lib/services/paystack-webhook-application.service";
import { createHash, createHmac, randomBytes } from "node:crypto";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeReal = hasDatabase ? describe : describe.skip;

describeReal("Phase 1: Real PostgreSQL Webhook Concurrency & Durability Integration", () => {
  const hex64 = (s: string) => createHash("sha256").update(s).digest("hex");
  const testNonce = randomBytes(8).toString("hex");
  const trackedPublicRefs: string[] = [];

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
    // Mark all test rows REJECTED so they never interfere with future workers.
    if (trackedPublicRefs.length > 0) {
      await prisma.paymentWebhookEvent.updateMany({
        where: { publicReference: { in: trackedPublicRefs } },
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
});
