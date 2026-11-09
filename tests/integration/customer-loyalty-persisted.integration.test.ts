import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { ensureLedgerAccount, ensureWalletForOwner } from "@/lib/services/wallet-account.service";
import { postLedgerJournal } from "@/lib/services/ledger-posting.service";
import { reconcileCompletedParcelLoyalty } from "@/lib/rewards/customer-parcel-loyalty.service";
import { runCustomerParcelLoyaltyBatch } from "@/lib/rewards/customer-loyalty-batch";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";

describe("verified customer parcel loyalty PostgreSQL evidence and idempotency", () => {
  const ids = { userId: "", payments: [] as string[], orders: [] as string[] };
  let assetAccountId = "";
  let heldAccountId = "";

  beforeAll(async () => {
    requireDisposableStoreSettlementDatabase();
    const suffix = randomUUID();
    const user = await prisma.user.create({
      data: { email: "loyalty-verified-" + suffix + "@example.test", role: "CUSTOMER", status: "ACTIVE" },
    });
    ids.userId = user.id;
    const wallet = await ensureWalletForOwner({
      ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR",
    });
    const asset = await ensureLedgerAccount({
      walletId: wallet.id, code: "PLATFORM-CASH-CLEARING-ZAR",
      purpose: "CASH_CLEARING", category: "ASSET", currency: "ZAR",
    });
    const held = await ensureLedgerAccount({
      walletId: wallet.id, code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR",
      purpose: "HELD", category: "LIABILITY", currency: "ZAR",
    });
    assetAccountId = asset.id;
    heldAccountId = held.id;
  });

  async function verifiedParcel(amount: string, vat: string, signatureVerified = true, initialStatus: "PENDING" | "DELIVERED" = "DELIVERED") {
    const suffix = randomUUID();
    const order = await prisma.order.create({
      data: {
        orderNumber: "LOY-ORDER-" + suffix,
        source: "CUSTOMER", status: initialStatus, deliveryType: "PARCEL_DOCUMENT",
        customerId: ids.userId, pricingTaxAmount: new Prisma.Decimal(vat),
        priceEstimate: new Prisma.Decimal(amount),
      },
    });
    ids.orders.push(order.id);
    const journal = await postLedgerJournal({
      idempotencyKey: "loyalty-test-" + suffix,
      type: "EXTERNAL_PAYMENT_RECEIPT",
      currency: "ZAR",
      sourceReference: "LOYALTY_TEST:" + suffix.replaceAll("-", "_").toUpperCase(),
      correlationId: "LOY-PAY-" + suffix,
      actor: { kind: "SYSTEM" },
      entries: [
        { accountId: assetAccountId, direction: "DEBIT", amount, lineCode: "PROVIDER-ASSET" },
        { accountId: heldAccountId, direction: "CREDIT", amount, lineCode: "CUSTOMER-FUNDS-HELD" },
      ],
    });
    const payment = await prisma.payment.create({
      data: {
        publicReference: "LOY-PAY-" + suffix, userId: ids.userId, orderId: order.id,
        subjectType: "COURIER_ORDER", provider: "PAYSTACK",
        status: "PENDING", purpose: "ORDER", amount: new Prisma.Decimal(amount),
        currency: "ZAR", creationIdempotencyKey: "loyalty-pm-" + suffix,
        creationRequestHash: "a".repeat(64),
      },
    });
    ids.payments.push(payment.id);
    const attempt = await prisma.paymentAttempt.create({
      data: {
        paymentId: payment.id, attemptNumber: 1, provider: "PAYSTACK",
        idempotencyKey: "loyalty-attempt-" + suffix, requestHash: "b".repeat(64),
        merchantReference: "loyalty-merchant-" + suffix, status: "SUCCEEDED",
        amount: new Prisma.Decimal(amount), currency: "ZAR", providerEnvironment: "SANDBOX",
      },
    });
    const webhook = await prisma.paymentWebhookEvent.create({
      data: {
        publicReference: "pwe_" + suffix, provider: "PAYSTACK",
        environment: "SANDBOX", eventFingerprint: createHash("sha256").update(suffix).digest("hex"),
        merchantReference: attempt.merchantReference, providerStatus: "success",
        normalizedStatus: "COMPLETE", processingStatus: signatureVerified ? "APPLIED" : "RECEIVED",
        paymentId: payment.id, attemptId: attempt.id,
        sourceAddressVerified: signatureVerified, signatureVerified, merchantVerified: true, amountVerified: true,
        providerDataVerified: true, verifiedAt: signatureVerified ? new Date() : null, appliedAt: signatureVerified ? new Date() : null,
        ledgerJournalId: journal.id,
      },
    });
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "SUCCEEDED", successfulAttemptId: attempt.id, successWebhookEventId: webhook.id, successLedgerJournalId: journal.id, providerConfirmedAt: new Date(), succeededAt: new Date(), version: { increment: 1 } },
    });
    return { paymentId: payment.id, orderId: order.id };
  }

  // Payment webhook events, payment receipt journals and their audit trails
  // are deliberately immutable even in a disposable database. Never weaken
  // production triggers to clean a test fixture; discard the isolated DB.
  afterAll(async () => { await prisma.$disconnect(); });

  it("awards only verified completed external spend exactly once and reverses cancelled orders with debt", async () => {
    const good = await verifiedParcel("102.99", "2.00");
    const first = await reconcileCompletedParcelLoyalty(ids.userId, good.paymentId);
    expect(first).toMatchObject({ status: "AWARDED", recognizedPoints: "100", availablePoints: "100", revision: 1 });
    const duplicate = await Promise.all([
      reconcileCompletedParcelLoyalty(ids.userId, good.paymentId),
      reconcileCompletedParcelLoyalty(ids.userId, good.paymentId),
    ]);
    expect(duplicate.every(item => item.status === "REPLAYED" && item.availablePoints === "100")).toBe(true);
    expect(await prisma.customerLoyaltyMovement.count({ where: { paymentId: good.paymentId } })).toBe(1);

    // The payment table enforces that refund projections are derived from actual
    // refund evidence and journals. Never bypass that trigger to make tests pass.
    // Cancellation after an earlier hypothetical future point redemption
    // demonstrates why reversal debt must not create a negative spendable amount.
    await prisma.customerLoyaltyAccount.update({
      where: { userId: ids.userId }, data: { availablePoints: 5n },
    });
    await prisma.order.update({
      where: { id: good.orderId }, data: { status: "CANCELLED" },
    });
    expect(await reconcileCompletedParcelLoyalty(ids.userId, good.paymentId)).toMatchObject({
      status: "REVERSED", recognizedPoints: "0", availablePoints: "0", debtPoints: "95", revision: 2,
    });
    const later = await verifiedParcel("80.00", "0.00");
    expect(await reconcileCompletedParcelLoyalty(ids.userId, later.paymentId)).toMatchObject({
      status: "AWARDED", recognizedPoints: "80", availablePoints: "0", debtPoints: "15", revision: 1,
    });
    const last = await verifiedParcel("50.00", "0.00");
    expect(await reconcileCompletedParcelLoyalty(ids.userId, last.paymentId)).toMatchObject({
      status: "AWARDED", recognizedPoints: "50", availablePoints: "35", debtPoints: "0", revision: 1,
    });
    const state = await prisma.customerLoyaltyAccount.findUniqueOrThrow({ where: { userId: ids.userId } });
    expect(state).toMatchObject({
      availablePoints: 35n, debtPoints: 0n,
      lifetimeEarnedPoints: 230n, lifetimeReversedPoints: 100n,
    });
    expect(await prisma.customerLoyaltyMovement.count({ where: { userId: ids.userId } })).toBe(4);
  });

  it("does not earn before delivery completion, then awards on later verified completion", async () => {
    const waiting = await verifiedParcel("20.00", "0.00", true, "PENDING");
    expect(await reconcileCompletedParcelLoyalty(ids.userId, waiting.paymentId)).toMatchObject({
      status: "NOT_ELIGIBLE", recognizedPoints: "0",
    });
    expect(await prisma.customerLoyaltyEarning.findUnique({ where: { paymentId: waiting.paymentId } })).toBeNull();
    await prisma.order.update({ where: { id: waiting.orderId }, data: { status: "DELIVERED" } });
    expect(await reconcileCompletedParcelLoyalty(ids.userId, waiting.paymentId)).toMatchObject({
      status: "AWARDED", recognizedPoints: "20", revision: 1,
    });
    expect(await prisma.customerLoyaltyMovement.count({ where: { paymentId: waiting.paymentId } })).toBe(1);
  });

  it("enforces debt-spendability exclusivity at the database boundary", async () => {
    const before = await prisma.customerLoyaltyAccount.findUniqueOrThrow({ where: { userId: ids.userId } });
    await expect(prisma.customerLoyaltyAccount.update({
      where: { userId: ids.userId },
      data: { availablePoints: 1n, debtPoints: 1n },
    })).rejects.toThrow();
    const after = await prisma.customerLoyaltyAccount.findUniqueOrThrow({ where: { userId: ids.userId } });
    expect(after.availablePoints).toBe(before.availablePoints);
    expect(after.debtPoints).toBe(before.debtPoints);
  });

  it("requires an explicit authorized batch, skips dry-run and reverses after a later cancellation", async () => {
    const fresh = await verifiedParcel("35.99", "0.00");
    const preview = await runCustomerParcelLoyaltyBatch({ mode: "DRY_RUN", batchSize: 100 });
    expect(preview.itemsExamined).toBeGreaterThanOrEqual(1);
    expect(preview.itemsCompleted).toBe(0);
    expect(await prisma.customerLoyaltyEarning.findUnique({ where: { paymentId: fresh.paymentId } })).toBeNull();

    const applied = await runCustomerParcelLoyaltyBatch({ mode: "APPLY", batchSize: 100 });
    expect(applied.itemsCompleted).toBeGreaterThanOrEqual(1);
    expect((await prisma.customerLoyaltyEarning.findUniqueOrThrow({
      where: { paymentId: fresh.paymentId },
    })).recognizedPoints).toBe(35n);
    expect(await prisma.customerLoyaltyMovement.count({ where: { paymentId: fresh.paymentId } })).toBe(1);

    await prisma.order.update({ where: { id: fresh.orderId }, data: { status: "CANCELLED" } });
    const reversed = await runCustomerParcelLoyaltyBatch({ mode: "APPLY", batchSize: 100 });
    expect(reversed.itemsReconciled).toBeGreaterThanOrEqual(1);
    expect((await prisma.customerLoyaltyEarning.findUniqueOrThrow({
      where: { paymentId: fresh.paymentId },
    })).recognizedPoints).toBe(0n);
    expect(await prisma.customerLoyaltyMovement.count({ where: { paymentId: fresh.paymentId } })).toBe(2);
  });

  it("denies awards for unverified provider evidence and wrong account ownership", async () => {
    const forged = await verifiedParcel("50.00", "0.00", false);
    await expect(reconcileCompletedParcelLoyalty(ids.userId, forged.paymentId))
      .rejects.toThrow(/verified payment/i);
    expect(await prisma.customerLoyaltyMovement.count({ where: { paymentId: forged.paymentId } })).toBe(0);
    const rightful = await verifiedParcel("12.00", "0.00");
    await expect(reconcileCompletedParcelLoyalty("another-customer", rightful.paymentId)).rejects.toThrow();
    expect(await prisma.customerLoyaltyMovement.count({ where: { paymentId: rightful.paymentId } })).toBe(0);
  });
});
