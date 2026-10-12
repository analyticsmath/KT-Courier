import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { ensureLedgerAccount, ensureWalletForOwner } from "@/lib/services/wallet-account.service";
import { ensureStoreEarningPayableAccount } from "@/lib/services/store-earning-account.service";
import { ensureWithdrawalAccounts } from "@/lib/services/withdrawal-account.service";
import { postLedgerJournal } from "@/lib/services/ledger-posting.service";
import type { StoreSettlementSnapshot } from "@/lib/store-earnings/store-settlement-snapshot";
import { requireDisposableStoreSettlementDatabase } from "./disposable-store-settlement-guard";

/** Synthetic source facts only; actual receipt/accrual/release journals exercise the canonical services. */
export async function createDisposableStoreSettlement(options: { storeId?: string; amount?: string } = {}) {
  requireDisposableStoreSettlementDatabase();
  const tag = `store-evidence-${randomUUID()}`;
  const hash = createHash("sha256").update(tag).digest("hex");
  const amount = options.amount ?? "100.25";
  let store = options.storeId ? await prisma.store.findUnique({ where: { id: options.storeId } }) : null;
  if (options.storeId && !store) throw new Error("Disposable store settlement owner is absent.");
  if (!store) {
    const owner = await prisma.user.create({ data: { email: `${tag}-owner@example.test`, role: "STORE", status: "ACTIVE", emailVerifiedAt: new Date() } });
    store = await prisma.store.create({ data: { ownerUserId: owner.id, name: "Disposable earning store", slug: tag, status: "ACTIVE" } });
  }
  if (store.status !== "ACTIVE") throw new Error("Disposable store settlement requires an active synthetic store.");
  const ownerUserId = store.ownerUserId;
  if (!ownerUserId) throw new Error("Disposable store settlement requires its canonical owner.");
  const customer = await prisma.user.create({ data: { email: `${tag}-customer@example.test`, name: "PRIVATE_STORE_EARNING_CUSTOMER", role: "CUSTOMER", status: "ACTIVE" } });
  const cart = await prisma.marketplaceCart.create({ data: { publicReference: `MPC-${hash.slice(0, 24).toUpperCase()}`, ownerType: "CUSTOMER", customerUserId: customer.id, currency: "ZAR", status: "ACTIVE" } });
  const checkout = await prisma.marketplaceCheckout.create({ data: { publicReference: `MCHK-${hash.slice(0, 24).toUpperCase()}`, cartId: cart.id, customerUserId: customer.id, status: "READY_FOR_REVIEW", acceptedFingerprint: hash, merchandiseSubtotal: amount, deliveryFeeTotal: "0.00", grandTotal: amount, currency: "ZAR" } });
  const platform = await ensureWalletForOwner({ ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" });
  const cash = await ensureLedgerAccount({ walletId: platform.id, code: "PLATFORM-CASH-CLEARING-ZAR", purpose: "CASH_CLEARING", category: "ASSET", currency: "ZAR" });
  await ensureLedgerAccount({ walletId: platform.id, code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR", purpose: "HELD", category: "LIABILITY", currency: "ZAR" });
  const held = await prisma.ledgerAccount.findFirstOrThrow({ where: { purpose: "HELD", category: "LIABILITY", currency: "ZAR", status: "ACTIVE", allowNegative: false, wallet: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" } } });
  const paymentReference = `PAY-${hash.toUpperCase().slice(0, 32)}`;
  const receipt = await postLedgerJournal({ idempotencyKey: `${tag}:receipt`, sourceReference: `fixture:${tag}:receipt`, correlationId: paymentReference, type: "EXTERNAL_PAYMENT_RECEIPT", currency: "ZAR", actor: { kind: "SYSTEM" }, memo: "Synthetic isolated store earning receipt", metadata: { fixture: "disposable-store-settlement" }, entries: [{ accountId: cash.id, direction: "DEBIT", amount, lineCode: "CASH_CLEARING" }, { accountId: held.id, direction: "CREDIT", amount, lineCode: "CUSTOMER_FUNDS_HELD" }] });
  const payment = await prisma.payment.create({ data: { publicReference: paymentReference, subjectType: "MARKETPLACE_CHECKOUT", marketplaceCheckoutId: checkout.id, userId: customer.id, provider: "PAYSTACK", status: "PROCESSING", amount, currency: "ZAR", creationIdempotencyKey: `${tag}:payment`, creationRequestHash: hash, metadata: { fixture: "disposable-store-settlement" } } });
  const attempt = await prisma.paymentAttempt.create({ data: { paymentId: payment.id, publicReference: `pat_${hash.toUpperCase().slice(0, 32)}`, attemptNumber: 1, provider: "PAYSTACK", providerEnvironment: "SANDBOX", idempotencyKey: `${tag}:attempt`, requestHash: hash, merchantReference: `${tag}:merchant`, status: "SUCCEEDED", amount, currency: "ZAR" } });
  const authoritativeAt = new Date("2026-10-01T12:00:00.000Z");
  const webhook = await prisma.paymentWebhookEvent.create({ data: { publicReference: `pwe_${hash.toUpperCase().slice(0, 32)}`, provider: "PAYSTACK", environment: "SANDBOX", eventFingerprint: hash, merchantReference: attempt.merchantReference, providerStatus: "success", normalizedStatus: "COMPLETE", processingStatus: "APPLIED", paymentId: payment.id, attemptId: attempt.id, ledgerJournalId: receipt.id, sourceAddressVerified: true, signatureVerified: true, merchantVerified: true, amountVerified: true, providerDataVerified: true, verifiedAt: authoritativeAt, appliedAt: authoritativeAt, safePayloadSnapshot: { fixture: "synthetic source facts; provider verification is not exercised" } } });
  await prisma.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED", successfulAttemptId: attempt.id, successWebhookEventId: webhook.id, successLedgerJournalId: receipt.id, succeededAt: authoritativeAt, providerConfirmedAt: authoritativeAt, version: { increment: 1 } } });
  const order = await prisma.marketplaceOrder.create({ data: { publicReference: `MPO-${hash.slice(0, 24).toUpperCase()}`, checkoutId: checkout.id, paymentId: payment.id, customerUserId: customer.id, merchandiseSubtotal: amount, modifierSubtotal: "0.00", deliveryFeeTotal: "0.00", grandTotal: amount, currency: "ZAR", status: "CONFIRMED", commercialFingerprint: hash } });
  const group = await prisma.marketplaceCheckoutStoreGroup.create({ data: { checkoutId: checkout.id, storeId: store.id, fulfilmentMode: "COURIER_DELIVERY" } });
  const storeOrder = await prisma.marketplaceStoreOrder.create({ data: { publicReference: `MSO-${hash.slice(0, 24).toUpperCase()}`, marketplaceOrderId: order.id, checkoutStoreGroupId: group.id, storeId: store.id, merchandiseSubtotal: amount, modifierSubtotal: "0.00", deliveryFee: "0.00", groupTotal: amount, status: "PENDING_SETTLEMENT" } });
  const wallet = await ensureWalletForOwner({ ownerType: "STORE", ownerId: store.id, currency: "ZAR" });
  const withdrawalAccounts = await ensureWithdrawalAccounts({ walletId: wallet.id, ownerType: "STORE" });
  const withdrawable = await prisma.ledgerAccount.findUniqueOrThrow({ where: { id: withdrawalAccounts.sourceAccountId } });
  const accounts = await ensureStoreEarningPayableAccount(store.id);
  const snapshot: StoreSettlementSnapshot = { subjectType: "MARKETPLACE_ORDER", subjectId: storeOrder.id, subjectPublicReference: storeOrder.publicReference, storeId: store.id, storePublicReference: store.slug, walletId: wallet.id, paymentId: payment.id, paymentPublicReference: payment.publicReference, settlementReference: `SSET-${hash.slice(0, 24).toUpperCase()}`, settlementVersion: "disposable-v1", calculationVersion: "disposable-v1", authoritativeAt: authoritativeAt.toISOString(), sellerSettlementBasisAmount: amount, attributedCommissionAmount: "0.00", netStoreEarningAmount: amount, currency: "ZAR", commissionCharges: [] };
  return { tag, store, ownerUserId, customer, payment, receipt, held, accounts, withdrawable, order, storeOrder, snapshot };
}
