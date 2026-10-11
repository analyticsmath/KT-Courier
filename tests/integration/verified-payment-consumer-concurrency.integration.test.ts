import { createHash, createHmac, randomInt, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createPayableOrder } from "./payment-fixtures";
import { ingestPaystackWebhook, applyPaystackWebhookEventsBatch } from "@/lib/services/paystack-webhook-application.service";
import type { PaystackClient } from "@/lib/payments/providers/paystack/paystack-client";
import { consumeVerifiedPaymentEvent, createPrismaVerifiedPaymentEventRepository, type VerifiedPaymentEvent } from "@/lib/payments/verified-payment-event-processor.service";
import { createPrismaMarketplaceFinalizationRepository } from "@/lib/marketplace-checkout/prisma-marketplace-finalization.repository";
import { createPrismaMarketplaceSettlementRepository } from "@/lib/marketplace-checkout/prisma-marketplace-settlement.repository";

describe("verified consumer PostgreSQL claim authority", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent");
    if (process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS !== "1" || process.env.KT_NETWORK_DISABLED !== "true" || !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/kt_launch_test" || url.username !== "kt_closure_test") throw new Error("Isolated closure database required.");
    expect(await prisma.$queryRaw`SELECT current_database() AS database, current_user AS role`).toEqual([{ database: "kt_launch_test", role: "kt_closure_test" }]);
  });

  async function verifiedEvent(): Promise<VerifiedPaymentEvent> {
    const tag = randomUUID();
    const { user, order } = await createPayableOrder(tag);
    const wallet = await prisma.wallet.upsert({ where: { ownerType_ownerId_currency: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" } }, update: {}, create: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" } });
    for (const [code, purpose, category] of [["PLATFORM-CASH-CLEARING-ZAR", "CASH_CLEARING", "ASSET"], ["PLATFORM-CUSTOMER-FUNDS-HELD-ZAR", "HELD", "LIABILITY"]] as const) {
      await prisma.ledgerAccount.upsert({ where: { code }, update: {}, create: { code, walletId: wallet.id, purpose, category, currency: "ZAR", status: "ACTIVE", allowNegative: false } });
    }
    const hash = createHash("sha256").update(tag).digest("hex");
    const payment = await prisma.payment.create({ data: { publicReference: `pay_${tag}`, userId: user.id, orderId: order.id, subjectType: "COURIER_ORDER", amount: "115.00", currency: "ZAR", provider: "PAYSTACK", creationIdempotencyKey: tag, creationRequestHash: hash } });
    const attempt = await prisma.paymentAttempt.create({ data: { publicReference: `pat_${tag}`, paymentId: payment.id, attemptNumber: 1, provider: "PAYSTACK", providerEnvironment: "SANDBOX", providerCredentialVersion: "test-v1", idempotencyKey: tag, requestHash: hash, merchantReference: `pat_${tag}`, status: "PROCESSING", amount: "115.00", currency: "ZAR" } });
    const key = "sk_test_consumer_disposable_only";
    const providerId = randomInt(1, 1_000_000_000_000);
    const rawBody = JSON.stringify({ event: "charge.success", data: { id: providerId, reference: attempt.merchantReference, status: "success", amount: 11500, currency: "ZAR" } });
    await ingestPaystackWebhook({ rawBody, signature: createHmac("sha512", key).update(rawBody).digest("hex"), secretKey: key });
    await applyPaystackWebhookEventsBatch({ batchSize: 500, secretKey: key, clientOverride: { verifyTransaction: async (reference: string) => ({ status: true, data: { id: providerId, reference, status: "success", amount: 11500, currency: "ZAR" } }) } as unknown as PaystackClient });
    const event = await prisma.paymentVerifiedEventIntent.findUniqueOrThrow({ where: { paymentId: payment.id } });
    // Wait for the application's actual dispatch to finish before clearing only
    // disposable consumer bookkeeping. Never manufacture paid evidence.
    for (let n = 0; n < 100; n++) {
      if (await prisma.paymentVerifiedEventConsumerReceipt.count({ where: { eventIntentId: event.id, status: "COMPLETED" } })) break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    expect(await prisma.paymentVerifiedEventConsumerReceipt.count({ where: { eventIntentId: event.id, status: "COMPLETED" } })).toBe(1);
    await prisma.paymentVerifiedEventConsumerReceipt.deleteMany({ where: { eventIntentId: event.id } });
    return event as VerifiedPaymentEvent;
  }

  it("serializes overlapping snapshots into one claim/effect, one receipt and one unchanged balanced journal", async () => {
    const event = await verifiedEvent();
    const before = await prisma.ledgerJournal.findMany({ where: { correlationId: (await prisma.payment.findUniqueOrThrow({ where: { id: event.paymentId } })).publicReference }, include: { entries: true } });
    expect(before).toHaveLength(1);
    expect(before[0].totalDebits.equals(before[0].totalCredits)).toBe(true);
    let arrivals = 0;
    let createAttempts = 0;
    let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const database = {
      paymentVerifiedEventConsumerReceipt: prisma.paymentVerifiedEventConsumerReceipt,
      $transaction: <T>(work: (tx: Prisma.TransactionClient) => Promise<T>, options: { isolationLevel: Prisma.TransactionIsolationLevel }) => prisma.$transaction(async tx => {
        // Establish every claimant's initial snapshot before any row lock is
        // acquired. Under SERIALIZABLE a waiting claimant cannot see the winner.
        await tx.$queryRaw`SELECT "id" FROM "PaymentVerifiedEventIntent" WHERE "id" = ${event.id}`;
        if (++arrivals === 4) release();
        await barrier;
        return work(new Proxy(tx, { get(target, key) {
          if (key !== "paymentVerifiedEventConsumerReceipt") return Reflect.get(target, key);
          return new Proxy(target.paymentVerifiedEventConsumerReceipt, { get(delegate, method) {
            if (method !== "create") return Reflect.get(delegate, method);
            return (...args: Parameters<typeof delegate.create>) => { createAttempts++; return delegate.create(...args); };
          } });
        } }));
      }, { ...options, timeout: 15000 }),
    };
    const repository = createPrismaVerifiedPaymentEventRepository(database);
    let calls = 0;
    // Courier events intentionally have no downstream money effect; use a
    // counted complete call to prove exactly one dispatcher owns the receipt.
    const counted = { ...repository, complete: async (...args: Parameters<typeof repository.complete>) => { calls++; return repository.complete(...args); } };
    const effects = { finalizeMarketplacePayment: async () => { throw new Error("Wrong subject"); }, activateSubscriptionPayment: async () => { throw new Error("Wrong subject"); }, recognizeManagedMarketingRevenue: async () => { throw new Error("Wrong subject"); } };
    const outcomes = await Promise.all(Array.from({ length: 4 }, () => consumeVerifiedPaymentEvent(counted, effects, event)));
    expect(outcomes.filter(value => value === "NO_DOWNSTREAM_EFFECT")).toHaveLength(1);
    expect(outcomes.filter(value => value === "SKIPPED")).toHaveLength(3);
    expect(calls).toBe(1);
    // Caught unique violations are still failed transactions, and under SSI
    // can surface as P2034. A loser must observe the committed receipt.
    expect(createAttempts).toBe(1);
    expect(await prisma.paymentVerifiedEventConsumerReceipt.findMany({ where: { eventIntentId: event.id } })).toMatchObject([{ status: "COMPLETED", attemptCount: 1 }]);
    expect(await consumeVerifiedPaymentEvent(createPrismaVerifiedPaymentEventRepository(), effects, event)).toBe("SKIPPED");
    expect(await prisma.ledgerJournal.findMany({ where: { id: before[0].id }, include: { entries: true } })).toEqual(before);
  }, 30000);

  it("rejects forged payment/attempt/event/subject identity before creating a receipt", async () => {
    const event = await verifiedEvent();
    const repository = createPrismaVerifiedPaymentEventRepository();
    for (const key of ["id", "publicReference", "eventIdentity", "paymentId", "successfulAttemptId", "webhookEventId", "subjectType"] as const) {
      await expect(repository.claim({ ...event, [key]: key === "subjectType" ? "MARKETPLACE_CHECKOUT" : randomUUID() })).rejects.toMatchObject({ code: "PAYMENT_VERIFIED_EVENT_IDENTITY_MISMATCH" });
    }
    expect(await prisma.paymentVerifiedEventConsumerReceipt.count({ where: { eventIntentId: event.id } })).toBe(0);
  }, 30000);

  it("keeps reused marketplace adapters on distinct real PostgreSQL transactions", async () => {
    for (const kind of ["finalization", "settlement"] as const) {
      let arrivals = 0;
      let release!: () => void;
      const barrier = new Promise<void>(resolve => { release = resolve; });
      const identities: bigint[] = [];
      const database = {
        $transaction: <T>(work: (tx: Prisma.TransactionClient) => Promise<T>, options: { isolationLevel: Prisma.TransactionIsolationLevel }) => prisma.$transaction(tx => work(new Proxy(tx, { get(target, key) {
          if (key !== "$queryRaw") return Reflect.get(target, key);
          return async (query: Prisma.Sql) => {
            const rows = await tx.$queryRaw<{ id: bigint }[]>`SELECT txid_current() AS id`;
            identities.push(rows[0].id);
            return tx.$queryRaw(query);
          };
        } })), options),
      };
      const repository = kind === "finalization" ? createPrismaMarketplaceFinalizationRepository(database) : createPrismaMarketplaceSettlementRepository(database);
      await Promise.all(Array.from({ length: 2 }, () => repository.transaction(async () => {
        if (++arrivals === 2) release();
        await barrier;
        expect(await ("lockVerifiedSuccessfulPayment" in repository ? repository.lockVerifiedSuccessfulPayment(randomUUID()) : repository.lockCanonicalSettlement(randomUUID()))).toBeNull();
      })));
      expect(identities).toHaveLength(2);
      expect(new Set(identities).size).toBe(2);
    }
  }, 30000);

  it("recovers an expired claim and fences the stale worker's completion and reconciliation", async () => {
    const event = await verifiedEvent();
    const repository = createPrismaVerifiedPaymentEventRepository();
    const first = await repository.claim(event);
    expect(first.kind).toBe("CLAIMED");
    if (first.kind !== "CLAIMED") throw new Error("Expected first owner.");
    expect(await repository.claim(event)).toEqual({ kind: "SKIPPED" });
    const before = await prisma.payment.findUniqueOrThrow({ where: { id: event.paymentId } });
    await prisma.paymentVerifiedEventConsumerReceipt.update({ where: { id: first.receiptId }, data: { updatedAt: new Date(Date.now() - 6 * 60000) } });
    const recovered = await repository.claim(event);
    expect(recovered).toMatchObject({ kind: "CLAIMED", receiptId: first.receiptId, attemptCount: 2 });
    if (recovered.kind !== "CLAIMED") throw new Error("Expected recovery owner.");
    expect(await repository.complete(first.receiptId, first.attemptCount)).toBe(false);
    expect(await repository.reconcile(event, first.receiptId, first.attemptCount, "STALE_WORKER_FAILURE")).toBe(false);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: event.paymentId } })).reconciliationStatus).toBe(before.reconciliationStatus);
    expect(await repository.complete(recovered.receiptId, recovered.attemptCount)).toBe(true);
    expect(await repository.reconcile(event, first.receiptId, first.attemptCount, "STALE_WORKER_FAILURE")).toBe(false);
    expect(await prisma.paymentVerifiedEventConsumerReceipt.findMany({ where: { eventIntentId: event.id } })).toMatchObject([{ status: "COMPLETED", attemptCount: 2, lastErrorCode: null }]);
    expect(await repository.claim(event)).toEqual({ kind: "SKIPPED" });
    expect(await prisma.ledgerJournal.count({ where: { correlationId: before.publicReference } })).toBe(1);
  }, 30000);

  it("durably reconciles a dispatch failure once without replaying financial capture", async () => {
    const event = await verifiedEvent();
    const repository = createPrismaVerifiedPaymentEventRepository();
    const failing = { ...repository, complete: async () => { throw Object.assign(new Error("Disposable completion interruption"), { code: "DISPATCH_INTERRUPTED" }); } };
    const effects = { finalizeMarketplacePayment: async () => {}, activateSubscriptionPayment: async () => {}, recognizeManagedMarketingRevenue: async () => {} };
    expect(await consumeVerifiedPaymentEvent(failing, effects, event)).toBe("RECONCILIATION_REQUIRED");
    expect(await consumeVerifiedPaymentEvent(repository, effects, event)).toBe("SKIPPED");
    expect(await prisma.paymentVerifiedEventConsumerReceipt.findMany({ where: { eventIntentId: event.id } })).toMatchObject([{ status: "RECONCILIATION_REQUIRED", attemptCount: 1, lastErrorCode: "DISPATCH_INTERRUPTED" }]);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: event.paymentId } });
    expect(payment).toMatchObject({ status: "SUCCEEDED", reconciliationStatus: "REQUIRED" });
    expect(await prisma.paymentReconciliationCase.count({ where: { paymentId: payment.id, reason: "APPLICATION_FAILURE_AFTER_VERIFICATION" } })).toBe(1);
    expect(await prisma.ledgerJournal.count({ where: { correlationId: payment.publicReference } })).toBe(1);
  }, 30000);
});
