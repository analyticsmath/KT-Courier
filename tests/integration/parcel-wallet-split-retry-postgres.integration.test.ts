import { createHmac, randomInt, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { LedgerMoney } from "@/lib/ledger/money";
import { prepareOrderPayment } from "@/lib/services/payment-preparation.service";
import { createProviderCheckoutSession } from "@/lib/services/payment-provider-session.service";
import { PaymentProviderRegistry } from "@/lib/payments/providers/payment-provider-registry";
import type { PaymentProviderAdapter } from "@/lib/payments/providers/payment-provider-adapter";
import {
  PAYSTACK_ALLOWED_CUSTOMER_ACTION_HOSTS,
  PAYSTACK_CAPABILITIES,
} from "@/lib/payments/providers/paystack/paystack-adapter";
import {
  applyPaystackWebhookEventsBatch,
  ingestPaystackWebhook,
} from "@/lib/services/paystack-webhook-application.service";
import type { PaystackClient } from "@/lib/payments/providers/paystack/paystack-client";
import {
  buildCanonicalOrderPaymentPreparationIntent,
  ensurePlatformCustomerFundsHeldAccountInTx,
  ensureWalletAvailableAccountInTx,
  getWalletSpendableBalance,
  releaseParcelOrderWalletReservation,
} from "@/lib/services/wallet-spending.service";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";
import { getCourierPaymentReadiness } from "@/lib/services/courier-payment-readiness.service";
import { createPayableOrder } from "./payment-fixtures";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeReal = hasDatabase ? describe : describe.skip;

function stubPaystackAdapter(
  behavior: "REDIRECT" | "TIMEOUT" | "DECLINE",
  calls: { count: number },
): PaymentProviderRegistry {
  const adapter: PaymentProviderAdapter = {
    code: "PAYSTACK",
    capabilities: PAYSTACK_CAPABILITIES,
    customerActionHosts: PAYSTACK_ALLOWED_CUSTOMER_ACTION_HOSTS,
    checkoutAudit: Object.freeze({
      environment: "SANDBOX",
      protocolVersion: "paystack-v1",
      configurationFingerprint: "cfg_stub_paystack_split_test",
      credentialVersion: "test-v1",
    }),
    async createCheckoutSession(input) {
      calls.count += 1;
      if (behavior === "TIMEOUT") {
        const err = new Error("Provider call timed out.");
        err.name = "AbortError";
        throw err;
      }
      if (behavior === "DECLINE") {
        return Object.freeze({
          status: "FAILED" as const,
          providerReference: `ps_declined_${input.merchantReference}`,
          providerStatusCode: "declined",
          definitive: true,
        });
      }
      return Object.freeze({
        status: "REQUIRES_ACTION" as const,
        providerReference: `ps_ref_${input.merchantReference}`,
        providerStatusCode: "pending",
        definitive: false,
        customerAction: Object.freeze({
          type: "REDIRECT_GET" as const,
          url: `https://checkout.paystack.com/${encodeURIComponent(input.merchantReference)}`,
          expiresAt: null,
        }),
      });
    },
    async getPaymentStatus() {
      throw new Error("Not used in session test");
    },
  };
  return new PaymentProviderRegistry({ adapters: [adapter] });
}

async function ensurePlatformAccountsAndFundCustomerWallet(userId: string, amountStr: string) {
  await prisma.$transaction(
    async (tx) => {
      const platformWallet = await tx.wallet.upsert({
        where: {
          ownerType_ownerId_currency: {
            ownerType: "PLATFORM",
            ownerId: "platform",
            currency: "ZAR",
          },
        },
        update: { status: "ACTIVE" },
        create: {
          ownerType: "PLATFORM",
          ownerId: "platform",
          currency: "ZAR",
          status: "ACTIVE",
        },
      });
      const cashClearing = await tx.ledgerAccount.upsert({
        where: { code: "PLATFORM-CASH-CLEARING-ZAR" },
        update: { status: "ACTIVE" },
        create: {
          walletId: platformWallet.id,
          code: "PLATFORM-CASH-CLEARING-ZAR",
          purpose: "CASH_CLEARING",
          category: "ASSET",
          currency: "ZAR",
          allowNegative: false,
          status: "ACTIVE",
        },
      });
      await ensurePlatformCustomerFundsHeldAccountInTx(tx);
      const customerAvailable = await ensureWalletAvailableAccountInTx(tx, {
        ownerType: "CUSTOMER",
        ownerId: userId,
      });

      const fundKey = `test-wallet-seed:${userId}:${randomUUID()}`;
      await postLedgerJournalWithinTransaction(tx, {
        idempotencyKey: fundKey,
        type: "ACCOUNT_TRANSFER",
        currency: "ZAR",
        sourceReference: `SEED_WALLET:${fundKey}`,
        correlationId: userId,
        memo: "Seed disposable customer wallet balance for split-payment integration test",
        actor: { kind: "SYSTEM" },
        entries: [
          {
            accountId: cashClearing.id,
            direction: "DEBIT",
            amount: amountStr,
            lineCode: "SEED_CASH_DEBIT",
          },
          {
            accountId: customerAvailable.id,
            direction: "CREDIT",
            amount: amountStr,
            lineCode: "SEED_CUSTOMER_WALLET_CREDIT",
          },
        ],
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

describeReal("§5.1 Parcel partial-wallet retry, concurrency, webhook, and reserve recovery (PostgreSQL)", { timeout: 60_000 }, () => {
  beforeAll(async () => {
    process.env.PAYMENT_APP_ORIGIN ??= "https://app.kt-courier.test";
    await prisma.$queryRaw`SELECT 1`;
  });

  it("1. creates partial wallet+card payment, replays sequentially (including normalized wallet format), and rejects changed walletAmount/actor/foreign-order", async () => {
    const tag = randomUUID();
    const { user, order } = await createPayableOrder(randomUUID());
    const { user: otherUser, order: otherOrder } = await createPayableOrder(randomUUID());
    await ensurePlatformAccountsAndFundCustomerWallet(user.id, "80.00");
    await ensurePlatformAccountsAndFundCustomerWallet(otherUser.id, "80.00");

    const idempotencyKey = `prep:split:${tag}`;
    const first = await prepareOrderPayment(
      { id: user.id, email: user.email },
      { orderId: order.id, idempotencyKey, walletAmount: "40.00" },
    );

    expect(first).toMatchObject({
      order: {
        id: order.id,
        reference: order.orderNumber,
      },
      amount: "75.00",
      currency: "ZAR",
      status: "CREATED",
    });

    // Stored creationRequestHash equals the canonical coordinator hash
    const dbPayment = await prisma.payment.findUniqueOrThrow({ where: { id: first.id } });
    const expectedIntent = buildCanonicalOrderPaymentPreparationIntent(
      {
        subjectType: "ORDER",
        subjectId: order.id,
        payerUserId: user.id,
        currency: "ZAR",
        amount: LedgerMoney.parse("115.00"),
      },
      "40.00",
    );
    expect(dbPayment.creationRequestHash).toBe(expectedIntent.requestHash);

    // Sequential retry with identical key and payload returns exact same payment
    const second = await prepareOrderPayment(
      { id: user.id, email: user.email },
      { orderId: order.id, idempotencyKey, walletAmount: "40.00" },
    );
    expect(second).toEqual(first);

    // Sequential retry with normalized wallet string ("40") also matches canonical minor units
    const third = await prepareOrderPayment(
      { id: user.id, email: user.email },
      { orderId: order.id, idempotencyKey, walletAmount: "40" },
    );
    expect(third).toEqual(first);

    // Same key with changed walletAmount rejects with PAYMENT_IDEMPOTENCY_CONFLICT
    await expect(
      prepareOrderPayment(
        { id: user.id, email: user.email },
        { orderId: order.id, idempotencyKey, walletAmount: "50.00" },
      ),
    ).rejects.toMatchObject({ code: "PAYMENT_IDEMPOTENCY_CONFLICT" });

    // Same key reused by different actor on their own order rejects with PAYMENT_IDEMPOTENCY_CONFLICT
    await expect(
      prepareOrderPayment(
        { id: otherUser.id, email: otherUser.email },
        { orderId: otherOrder.id, idempotencyKey, walletAmount: "40.00" },
      ),
    ).rejects.toMatchObject({ code: "PAYMENT_IDEMPOTENCY_CONFLICT" });

    // Foreign-order denial: otherUser attempting to prepare payment on user's order
    await expect(
      prepareOrderPayment(
        { id: otherUser.id, email: otherUser.email },
        { orderId: order.id, idempotencyKey: `prep:foreign:${tag}`, walletAmount: "40.00" },
      ),
    ).rejects.toMatchObject({ code: "PAYMENT_PAYER_NOT_AUTHORIZED" });

    // Exactly one Payment and one wallet reservation journal exist for this order
    expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(1);
    expect(
      await prisma.ledgerJournal.count({
        where: { idempotencyKey: `wallet-reserve:${idempotencyKey}` },
      }),
    ).toBe(1);
    const spendable = await getWalletSpendableBalance(prisma, {
      ownerType: "CUSTOMER",
      ownerId: user.id,
    });
    expect(spendable.availableAmount).toBe("40.00");
  });

  it("2. converges two concurrent same-key split-wallet requests and rejects different-key concurrent request on the same order", async () => {
    const tag = randomUUID();
    const { user, order } = await createPayableOrder(randomUUID());
    await ensurePlatformAccountsAndFundCustomerWallet(user.id, "60.00");

    const sameKey = `prep:conc:same:${tag}`;
    const [resA, resB] = await Promise.all([
      prepareOrderPayment(
        { id: user.id, email: user.email },
        { orderId: order.id, idempotencyKey: sameKey, walletAmount: "40.00" },
      ),
      prepareOrderPayment(
        { id: user.id, email: user.email },
        { orderId: order.id, idempotencyKey: sameKey, walletAmount: "40.00" },
      ),
    ]);
    expect(resA.id).toBe(resB.id);
    expect(resA.publicReference).toBe(resB.publicReference);
    expect(resA.amount).toBe("75.00");
    expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(1);
    expect(
      (await getWalletSpendableBalance(prisma, { ownerType: "CUSTOMER", ownerId: user.id }))
        .availableAmount,
    ).toBe("20.00");

    // Different-key concurrent race on a second order (two-tab race)
    const { order: order2 } = await createPayableOrder(randomUUID());
    await prisma.order.update({ where: { id: order2.id }, data: { customerId: user.id } });
    await ensurePlatformAccountsAndFundCustomerWallet(user.id, "80.00"); // now 100.00 available
    const outcomes = await Promise.allSettled([
      prepareOrderPayment(
        { id: user.id, email: user.email },
        { orderId: order2.id, idempotencyKey: `prep:tab1:${tag}`, walletAmount: "45.00" },
      ),
      prepareOrderPayment(
        { id: user.id, email: user.email },
        { orderId: order2.id, idempotencyKey: `prep:tab2:${tag}`, walletAmount: "45.00" },
      ),
    ]);
    const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
    const rejected = outcomes.filter((o) => o.status === "rejected") as PromiseRejectedResult[];
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ code: "PAYMENT_IDEMPOTENCY_CONFLICT" });
    expect(await prisma.payment.count({ where: { orderId: order2.id } })).toBe(1);
    expect(
      (await getWalletSpendableBalance(prisma, { ownerType: "CUSTOMER", ownerId: user.id }))
        .availableAmount,
    ).toBe("55.00");
  });

  it("3. prevents double wallet reservation on concurrent wallet reserve collision across two orders", async () => {
    const tag = randomUUID();
    const { user, order: order1 } = await createPayableOrder(randomUUID());
    const base2 = await createPayableOrder(randomUUID());
    const order2 = await prisma.order.update({
      where: { id: base2.order.id },
      data: { customerId: user.id },
    });

    // Fund exactly R50.00 so only one of the two R50.00 reservations can win
    await ensurePlatformAccountsAndFundCustomerWallet(user.id, "50.00");

    const outcomes = await Promise.allSettled([
      prepareOrderPayment(
        { id: user.id, email: user.email },
        { orderId: order1.id, idempotencyKey: `prep:col1:${tag}`, walletAmount: "50.00" },
      ),
      prepareOrderPayment(
        { id: user.id, email: user.email },
        { orderId: order2.id, idempotencyKey: `prep:col2:${tag}`, walletAmount: "50.00" },
      ),
    ]);

    const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
    const rejected = outcomes.filter((o) => o.status === "rejected") as PromiseRejectedResult[];
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ code: "PAYMENT_WALLET_INSUFFICIENT_FUNDS" });

    const balance = await getWalletSpendableBalance(prisma, {
      ownerType: "CUSTOMER",
      ownerId: user.id,
    });
    expect(balance.availableAmount).toBe("0.00");
  });

  it("4. holds wallet reservation on unknown gateway result, replays same session key, and blocks duplicate charge or premature release", async () => {
    const tag = randomUUID();
    const { user, order } = await createPayableOrder(randomUUID());
    await ensurePlatformAccountsAndFundCustomerWallet(user.id, "50.00");

    const prepared = await prepareOrderPayment(
      { id: user.id, email: user.email },
      { orderId: order.id, idempotencyKey: `prep:unk:${tag}`, walletAmount: "40.00" },
    );
    expect(prepared.amount).toBe("75.00");

    const calls = { count: 0 };
    const sessionKey = `sess:unk:${tag}`;
    const session = await createProviderCheckoutSession(
      { id: user.id },
      { paymentId: prepared.id, provider: "PAYSTACK", idempotencyKey: sessionKey },
      { registry: stubPaystackAdapter("TIMEOUT", calls) },
    );
    expect(calls.count).toBe(1);
    expect(session.paymentStatus).toBe("PROCESSING");
    expect(session.attempt.status).toBe("UNKNOWN");
    expect(session.attempt.amount).toBe("75.00");

    // Replaying the same session key returns the existing UNKNOWN attempt without calling Paystack again
    const replayedSession = await createProviderCheckoutSession(
      { id: user.id },
      { paymentId: prepared.id, provider: "PAYSTACK", idempotencyKey: sessionKey },
      { registry: stubPaystackAdapter("REDIRECT", calls) },
    );
    expect(calls.count).toBe(1);
    expect(replayedSession.replayed).toBe(true);
    expect(replayedSession.attempt.id).toBe(session.attempt.id);

    // Starting a new session with a different key is blocked while UNKNOWN is unresolved
    await expect(
      createProviderCheckoutSession(
        { id: user.id },
        { paymentId: prepared.id, provider: "PAYSTACK", idempotencyKey: `sess:unk2:${tag}` },
        { registry: stubPaystackAdapter("REDIRECT", calls) },
      ),
    ).rejects.toMatchObject({ code: "PAYMENT_STATE_TRANSITION_INVALID" });
    expect(calls.count).toBe(1);

    // Releasing the wallet reservation while provider outcome is UNKNOWN is blocked
    await expect(
      releaseParcelOrderWalletReservation({
        orderId: order.id,
        reason: "Premature release attempt during unknown provider status",
        actorUserId: user.id,
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_PROVIDER_OUTCOME_UNKNOWN" });

    // Wallet reserve remains intact (available = 10.00)
    expect(
      (await getWalletSpendableBalance(prisma, { ownerType: "CUSTOMER", ownerId: user.id }))
        .availableAmount,
    ).toBe("10.00");
  });

  it("5. completes split wallet+card on signed webhook, consumes reserve once, confirms order once, and is idempotent under webhook replay", async () => {
    const tag = randomUUID();
    const { user, order } = await createPayableOrder(randomUUID());
    await ensurePlatformAccountsAndFundCustomerWallet(user.id, "50.00");

    const prepared = await prepareOrderPayment(
      { id: user.id, email: user.email },
      { orderId: order.id, idempotencyKey: `prep:wh:${tag}`, walletAmount: "40.00" },
    );
    expect(prepared.amount).toBe("75.00");

    const calls = { count: 0 };
    const session = await createProviderCheckoutSession(
      { id: user.id },
      { paymentId: prepared.id, provider: "PAYSTACK", idempotencyKey: `sess:wh:${tag}` },
      { registry: stubPaystackAdapter("REDIRECT", calls) },
    );
    expect(calls.count).toBe(1);
    expect(session.attempt.status).toBe("REQUIRES_ACTION");
    expect(session.attempt.amount).toBe("75.00");

    const attemptRow = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: session.attempt.id },
    });

    const secretKey = "sk_test_split_webhook_disposable_only";
    const providerId = randomInt(100_000_000, 999_999_999);
    const rawBody = JSON.stringify({
      event: "charge.success",
      data: {
        id: providerId,
        reference: attemptRow.merchantReference,
        status: "success",
        amount: 7500, // R75.00 remainder externally charged
        currency: "ZAR",
      },
    });
    const signature = createHmac("sha512", secretKey).update(rawBody).digest("hex");

    const ingest1 = await ingestPaystackWebhook({ rawBody, signature, secretKey });
    expect(ingest1.received).toBe(true);
    expect(ingest1.duplicate).toBe(false);

    const mockClient = {
      verifyTransaction: async (ref: string) => ({
        status: true,
        message: "Verification successful",
        data: {
          id: providerId,
          reference: ref,
          status: "success",
          amount: 7500,
          currency: "ZAR",
        },
      }),
    } as unknown as PaystackClient;

    await applyPaystackWebhookEventsBatch({
      batchSize: 50,
      secretKey,
      clientOverride: mockClient,
    });

    // Replay webhook ingestion and batch application
    const ingest2 = await ingestPaystackWebhook({ rawBody, signature, secretKey });
    expect(ingest2.duplicate).toBe(true);
    await applyPaystackWebhookEventsBatch({
      batchSize: 50,
      secretKey,
      clientOverride: mockClient,
    });

    // Replaying prepareOrderPayment after payment succeeded returns the idempotent receipt
    const replayedPrep = await prepareOrderPayment(
      { id: user.id, email: user.email },
      { orderId: order.id, idempotencyKey: `prep:wh:${tag}`, walletAmount: "40.00" },
    );
    expect(replayedPrep.id).toBe(prepared.id);
    expect(replayedPrep.status).toBe("SUCCEEDED");

    const finalPayment = await prisma.payment.findUniqueOrThrow({ where: { id: prepared.id } });
    expect(finalPayment.status).toBe("SUCCEEDED");
    expect(finalPayment.amount.toFixed(2)).toBe("75.00");

    // 1 provider receipt journal (R75.00) + 1 wallet consumption journal (R40.00)
    const receiptJournals = await prisma.ledgerJournal.findMany({
      where: { correlationId: prepared.publicReference, type: "EXTERNAL_PAYMENT_RECEIPT" },
    });
    expect(receiptJournals).toHaveLength(1);
    expect(receiptJournals[0].totalDebits.toFixed(2)).toBe("75.00");
    expect(receiptJournals[0].totalCredits.toFixed(2)).toBe("75.00");

    const consumeJournals = await prisma.ledgerJournal.findMany({
      where: { idempotencyKey: `wallet-consume:paystack:wallet-consume:${prepared.publicReference}` },
    });
    expect(consumeJournals).toHaveLength(1);
    expect(consumeJournals[0].totalDebits.toFixed(2)).toBe("40.00");
    expect(consumeJournals[0].totalCredits.toFixed(2)).toBe("40.00");

    // Order is CONFIRMED and dispatchEligible
    const finalOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(finalOrder.status).toBe("CONFIRMED");
    const readiness = await getCourierPaymentReadiness(order.id);
    expect(readiness).toMatchObject({
      status: "PAID",
      dispatchEligible: true,
      paymentReference: prepared.publicReference,
      amount: "75.00",
    });
  });

  it("6. releases wallet reservation on conclusive provider failure/cancellation and preserves full-wallet and provider-only flows", async () => {
    const tag = randomUUID();
    const { user, order } = await createPayableOrder(randomUUID());
    await ensurePlatformAccountsAndFundCustomerWallet(user.id, "155.00");

    // 6a. Split-wallet payment that conclusively fails at provider -> release reserve restores balance
    const splitPayment = await prepareOrderPayment(
      { id: user.id, email: user.email },
      { orderId: order.id, idempotencyKey: `prep:rel:${tag}`, walletAmount: "40.00" },
    );
    expect(
      (await getWalletSpendableBalance(prisma, { ownerType: "CUSTOMER", ownerId: user.id }))
        .availableAmount,
    ).toBe("115.00");

    const calls = { count: 0 };
    const failedSession = await createProviderCheckoutSession(
      { id: user.id },
      { paymentId: splitPayment.id, provider: "PAYSTACK", idempotencyKey: `sess:rel:${tag}` },
      { registry: stubPaystackAdapter("DECLINE", calls) },
    );
    expect(failedSession.paymentStatus).toBe("FAILED");
    expect(failedSession.attempt.status).toBe("FAILED");

    const release1 = await releaseParcelOrderWalletReservation({
      orderId: order.id,
      reason: "Provider declined card; customer cancelled split payment",
      actorUserId: user.id,
    });
    expect(release1).toMatchObject({
      released: true,
      amount: "40.00",
      replayed: false,
    });

    // Replay of release is idempotent and does not double-credit
    const release2 = await releaseParcelOrderWalletReservation({
      orderId: order.id,
      reason: "Provider declined card; customer cancelled split payment",
      actorUserId: user.id,
    });
    expect(release2).toMatchObject({
      released: true,
      amount: "40.00",
      replayed: true,
    });
    expect(
      (await getWalletSpendableBalance(prisma, { ownerType: "CUSTOMER", ownerId: user.id }))
        .availableAmount,
    ).toBe("155.00");
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: splitPayment.id } })).status).toBe(
      "CANCELLED",
    );

    // 6b. Full-wallet parcel order (R115.00) settles immediately without Paystack and replays cleanly
    const { order: fullWalletOrder } = await createPayableOrder(randomUUID());
    await prisma.order.update({
      where: { id: fullWalletOrder.id },
      data: { customerId: user.id },
    });
    const fullKey = `prep:full:${tag}`;
    const full1 = await prepareOrderPayment(
      { id: user.id, email: user.email },
      { orderId: fullWalletOrder.id, idempotencyKey: fullKey, walletAmount: "115.00" },
    );
    expect(full1).toMatchObject({
      amount: "115.00",
      status: "SUCCEEDED",
    });
    const full2 = await prepareOrderPayment(
      { id: user.id, email: user.email },
      { orderId: fullWalletOrder.id, idempotencyKey: fullKey, walletAmount: "115.00" },
    );
    expect(full2).toEqual(full1);
    expect(
      await prisma.paymentAttempt.count({ where: { paymentId: full1.id } }),
    ).toBe(0);
    expect(
      (await getWalletSpendableBalance(prisma, { ownerType: "CUSTOMER", ownerId: user.id }))
        .availableAmount,
    ).toBe("40.00");

    // 6c. Provider-only parcel order (R115.00) creates CREATED payment without touching wallet and replays cleanly
    const { order: providerOnlyOrder } = await createPayableOrder(randomUUID());
    await prisma.order.update({
      where: { id: providerOnlyOrder.id },
      data: { customerId: user.id },
    });
    const provKey = `prep:prov:${tag}`;
    const prov1 = await prepareOrderPayment(
      { id: user.id, email: user.email },
      { orderId: providerOnlyOrder.id, idempotencyKey: provKey },
    );
    expect(prov1).toMatchObject({
      amount: "115.00",
      status: "CREATED",
    });
    const prov2 = await prepareOrderPayment(
      { id: user.id, email: user.email },
      { orderId: providerOnlyOrder.id, idempotencyKey: provKey },
    );
    expect(prov2).toEqual(prov1);
    expect(
      (await getWalletSpendableBalance(prisma, { ownerType: "CUSTOMER", ownerId: user.id }))
        .availableAmount,
    ).toBe("40.00");
  });
});
