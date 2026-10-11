import { prisma } from "../lib/db/prisma";
import { assertDisposablePaystackAcceptance, assertDisposablePaystackEmail, disposablePaystackKey } from "../lib/testing/disposable-paystack-policy";
import type { DisposablePaystackTransaction } from "../lib/testing/disposable-paystack-provider";
import { claimPaystackWebhookEventsBatch, processClaimedPaystackWebhookEvent } from "../lib/services/paystack-webhook-application.service";
import { consumeVerifiedPaymentEvents } from "../lib/payments/verified-payment-event-processor.service";
import { openSecurityPayload } from "../lib/notifications/security-payload-vault";

// CLI only: no public endpoint, no arbitrary SQL, no direct financial success.
async function main() {
  assertDisposablePaystackAcceptance();
  const [reference, action] = process.argv.slice(2);
  if (reference === "__probe__" && action === "probe") {
    const rows = await prisma.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database() AS database, current_user AS role`;
    if (rows[0]?.database !== "kt_phase75_e2e" || rows[0]?.role !== "kt_phase75_e2e") throw new Error("Disposable PostgreSQL server identity mismatch.");
    console.log("PAYSTACK_POSTGRES_IDENTITY_VERIFIED");
    return;
  }
  const checkout = await prisma.marketplaceCheckout.findUniqueOrThrow({ where: { publicReference: reference }, include: { contactSnapshot: true } });
  assertDisposablePaystackEmail(checkout.contactSnapshot?.email ?? "");
  if (action === "guest-code") {
    if (checkout.customerUserId) throw new Error("A namespace-owned guest challenge is required.");
    const challenge = await prisma.marketplaceGuestContactVerification.findFirstOrThrow({ where: { checkoutId: checkout.id, contactSnapshotId: checkout.contactSnapshot!.id }, orderBy: { createdAt: "desc" } });
    const intent = await prisma.notificationEventIntent.findFirstOrThrow({ where: { aggregateReference: challenge.publicReference, eventType: "GUEST_CHECKOUT_EMAIL_VERIFICATION_OTP" } });
    const secure = await prisma.notificationSecurePayload.findUniqueOrThrow({ where: { eventIntentId: intent.id } });
    if (!secure.expiresAt || secure.expiresAt <= new Date()) throw new Error("Disposable guest challenge expired.");
    const { otp } = openSecurityPayload(secure.encryptedPayload, intent.operationId);
    console.log(`PAYSTACK_GUEST_CODE ${JSON.stringify({ verificationReference: challenge.publicReference, code: otp })}`);
    return;
  }
  const payment = await prisma.payment.findFirstOrThrow({ where: { marketplaceCheckoutId: checkout.id }, orderBy: { createdAt: "desc" } });
  const attempt = await prisma.paymentAttempt.findFirstOrThrow({ where: { paymentId: payment.id }, orderBy: { attemptNumber: "desc" } });
  const key = disposablePaystackKey(attempt.merchantReference);
  if (["success", "amount", "currency", "unknown", "reference"].includes(action)) {
    const row = await prisma.systemSetting.findUniqueOrThrow({ where: { key } });
    const provider = row.value as unknown as DisposablePaystackTransaction;
    await prisma.systemSetting.update({ where: { key }, data: { value: { ...provider,
      status: action === "unknown" ? "unknown" : "success",
      amount: action === "amount" ? provider.amount + 1 : provider.amount,
      currency: action === "currency" ? "USD" : provider.currency,
      reference: action === "reference" ? `${provider.reference}-foreign` : provider.reference,
    } } });
  } else if (action === "process") {
    const batches = await Promise.all([1, 2].map(async () => {
      const claimed = await claimPaystackWebhookEventsBatch({ batchSize: 10, merchantReferences: [attempt.merchantReference] });
      return Promise.all(claimed.map(event => processClaimedPaystackWebhookEvent(event)));
    }));
    await consumeVerifiedPaymentEvents({ limit: 10, subjectTypes: ["MARKETPLACE_CHECKOUT"] });
    // The existing application also dispatches after commit. Wait for that
    // durable consumer before returning; never synthesize its result.
    for (let n = 0; n < 30; n++) {
      const active = await prisma.paymentVerifiedEventConsumerReceipt.count({ where: { eventIntent: { paymentId: payment.id }, status: "PROCESSING" } });
      if (!active) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log(`PAYSTACK_WORKER ${JSON.stringify(batches)}`);
  } else if (action !== "snapshot") throw new Error("Unsupported disposable control action.");
  const fresh = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
  const events = await prisma.paymentWebhookEvent.findMany({ where: { merchantReference: attempt.merchantReference }, orderBy: { receivedAt: "asc" } });
  const journals = await prisma.ledgerJournal.findMany({ where: { correlationId: payment.publicReference, type: "EXTERNAL_PAYMENT_RECEIPT" }, include: { entries: { include: { account: { select: { code: true } } }, orderBy: { sequence: "asc" } } } });
  const orders = await prisma.marketplaceOrder.findMany({ where: { checkoutId: checkout.id }, include: { storeOrders: { include: { lines: true, settlementSnapshots: true } } } });
  const reservations = await prisma.marketplaceInventoryReservation.findMany({ where: { checkoutId: checkout.id }, include: { items: { include: { inventoryLevel: true }, orderBy: { id: "asc" } } }, orderBy: { createdAt: "asc" } });
  const intents = await prisma.paymentVerifiedEventIntent.findMany({ where: { paymentId: payment.id }, include: { deliveries: true } });
  const provider = await prisma.systemSetting.findUnique({ where: { key } });
  const safeEvents = events.map(({ publicReference, processingStatus, signatureVerified, amountVerified, merchantVerified, providerDataVerified, ledgerJournalId, attemptCount }) => ({ publicReference, processingStatus, signatureVerified, amountVerified, merchantVerified, providerDataVerified, ledgerJournalId, attemptCount }));
  console.log(`PAYSTACK_SNAPSHOT ${JSON.stringify({ checkout: { status: (await prisma.marketplaceCheckout.findUniqueOrThrow({ where: { id: checkout.id } })).status, grandTotal: checkout.grandTotal },
    payment: { id: fresh.id, reference: fresh.publicReference, status: fresh.status, amount: fresh.amount, currency: fresh.currency, successLedgerJournalId: fresh.successLedgerJournalId },
    attempt: { merchantReference: attempt.merchantReference, status: (await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status },
    provider: provider?.value, events: safeEvents, journals,
    orders: orders.map(order => ({ id: order.id, publicReference: order.publicReference, paymentId: order.paymentId, currency: order.currency, grandTotal: order.grandTotal,
      commercialFingerprint: order.commercialFingerprint, guestCapabilityBound: !order.customerUserId && Boolean(order.guestConfirmationHash) && order.guestConfirmationHash === checkout.guestAccessTokenHash,
      storeOrders: order.storeOrders })), reservations, intents })}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
