import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/db/prisma";
import { assertDisposablePaystackAcceptance, assertDisposablePaystackEmail } from "../lib/testing/disposable-paystack-policy";
import { createRefundRequest, cancelRefundRequest } from "../lib/services/refund-request.service";
import { beginRefundReview, approveRefund } from "../lib/services/refund-finance-review.service";
import { completeRefundToCustomerWallet } from "../lib/services/refund-wallet-completion.service";
import { startProviderRefund } from "../lib/services/refund-provider-execution.service";
import { queryRefundProviderStatus } from "../lib/services/refund-reconciliation.service";
import { ensureCustomerRefundWallet } from "../lib/services/customer-wallet.service";
import { PaystackClient, type PaystackRefundInput, type PaystackRefundData } from "../lib/payments/providers/paystack/paystack-client";
import { PaystackRefundAdapter } from "../lib/refunds/providers/paystack/paystack-refund-adapter";
import { RefundProviderRegistry } from "../lib/refunds/providers/refund-provider-registry";
import { applyMarketplaceStoreOrderAdjustment } from "../lib/store-orders/store-order.service";
import { ExistingPhaseFinancialAdjustmentAuthority } from "../lib/store-orders/financial-adjustment-composition";

function journalReceipt(journal: Prisma.LedgerJournalGetPayload<{ include: { entries: true } }> | null) {
  return journal && { id: journal.id, type: journal.type, currency: journal.currency, totalDebits: journal.totalDebits.toFixed(2), totalCredits: journal.totalCredits.toFixed(2), entries: journal.entries.map(entry => ({ direction: entry.direction, amount: entry.amount.toFixed(2) })) };
}

/** CLI fixture injection only. No application route imports this module. */
async function assertNamedDisposableRefundRuntime() {
  assertDisposablePaystackAcceptance();
  const rows = await prisma.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database() AS database, current_user AS role`;
  assert.deepEqual(rows, [{ database: "kt_phase75_e2e", role: "kt_phase75_e2e" }]);
}

async function main() {
  await assertNamedDisposableRefundRuntime();
  const [checkoutReference, action, raw = "{}"] = process.argv.slice(2);
  const options = JSON.parse(raw) as { reference?: string; amount?: string; operationId?: string; outcome?: string; storeOrderReference?: string; adjustmentReference?: string };
  const checkout = await prisma.marketplaceCheckout.findUniqueOrThrow({ where: { publicReference: checkoutReference }, include: { contactSnapshot: true } });
  assertDisposablePaystackEmail(checkout.contactSnapshot?.email ?? "");
  assert.match(checkout.contactSnapshot!.email, /^e2e-paystack-(?:(wallet|finance)-\d+|store-positive-(1440|390))@ktcouriers\.local$/);
  assert.ok(checkout.customerUserId, "Wallet proof requires an authenticated synthetic owner.");
  const owner = checkout.customerUserId!;
  const payment = await prisma.payment.findFirstOrThrow({ where: { marketplaceCheckoutId: checkout.id }, include: { successfulAttempt: true, successWebhookEvent: true } });
  assert.equal(payment.status, "SUCCEEDED");
  assert.equal(payment.provider, "PAYSTACK");
  assert.equal(payment.successWebhookEvent?.processingStatus, "APPLIED");
  assert.equal(payment.successWebhookEvent?.providerDataVerified, true);
  assert.ok(payment.successLedgerJournalId);
  await ensureCustomerRefundWallet(owner);
  const approver = await prisma.user.findUniqueOrThrow({ where: { email: "superadmin@ktcouriers.local" } });
  const processor = await prisma.user.findUniqueOrThrow({ where: { email: "e2e-editorial-reviewer@ktcouriers.local" } });
  assert.equal(approver.role, "SUPER_ADMIN"); assert.equal(processor.role, "SUPER_ADMIN");
  assert.notEqual(owner, approver.id); assert.notEqual(processor.id, approver.id);
  const assertProductionReady = () => assertDisposablePaystackAcceptance();
  const providerKey = `e2e-refund-provider:${payment.id}`;
  // Exercise the real Paystack adapter's subunit parsing and outcome mapping.
  // This client has no fetch implementation and cannot touch financial rows.
  class OfflineRefundClient extends PaystackClient {
    constructor() { super({ secretKey: "sk_test_disposable_browser_no_provider" }); }
    async createRefund(input: PaystackRefundInput): Promise<PaystackRefundData> {
      assertDisposablePaystackAcceptance();
      assert.equal(input.transaction, payment.successfulAttempt!.providerReference);
      assert.ok(Number.isSafeInteger(input.amountCents) && input.amountCents! > 0);
      const existing = await prisma.systemSetting.findUnique({ where: { key: providerKey } });
      const calls = ((existing?.value as { calls?: number } | null)?.calls ?? 0) + 1;
      const providerId = Number.parseInt(createHash("sha256").update(`${payment.id}:${calls}`).digest("hex").slice(0, 12), 16);
      const facts = { calls, id: providerId, amount: input.amountCents!, status: options.outcome ?? "pending", reference: input.transaction };
      await prisma.systemSetting.upsert({ where: { key: providerKey }, create: { key: providerKey, value: facts, label: "Disposable offline refund provider facts", type: "JSON" }, update: { value: facts } });
      if (options.outcome === "network-loss") throw new TypeError("Synthetic network loss after provider acceptance.");
      return { id: facts.id, amount: facts.amount, transaction: { id: 1, reference: input.transaction }, deducted_amount: 0, currency: "ZAR", status: facts.status } as PaystackRefundData;
    }
    async getRefund(id: string): Promise<PaystackRefundData> {
      assertDisposablePaystackAcceptance();
      const row = await prisma.systemSetting.findUniqueOrThrow({ where: { key: providerKey } });
      const facts = row.value as { id: number; amount: number; reference: string; calls: number };
      assert.equal(String(facts.id), id);
      return { id: facts.id, amount: facts.amount, transaction: { id: 1, reference: facts.reference }, deducted_amount: facts.amount, currency: "ZAR", status: options.outcome ?? "processed" } as PaystackRefundData;
    }
  }
  const registry = new RefundProviderRegistry([new PaystackRefundAdapter(new OfflineRefundClient())]);
  const dependencies = { assertProductionReady, providerRegistry: registry };
  const operationId = options.operationId ?? `phase2:${checkoutReference}:${action}`;
  const selected = options.reference ? await prisma.paymentRefund.findFirstOrThrow({ where: { publicReference: options.reference, paymentId: payment.id, customerUserId: owner } }) : null;
  let result: unknown = null;
  if (action === "apply-store-adjustment") {
    assert.match(checkout.contactSnapshot!.email, /^e2e-paystack-store-positive-(1440|390)@ktcouriers\.local$/);
    assert.ok(options.storeOrderReference && options.adjustmentReference);
    const child = await prisma.marketplaceStoreOrder.findFirstOrThrow({ where: { publicReference: options.storeOrderReference, marketplaceOrder: { paymentId: payment.id, customerUserId: owner, checkoutId: checkout.id } } });
    await prisma.marketplaceStoreOrderAdjustment.findFirstOrThrow({ where: { publicReference: options.adjustmentReference, marketplaceStoreOrderId: child.id, status: "APPROVED" } });
    const storeOwner = await prisma.user.findUniqueOrThrow({ where: { email: "e2e-store@ktcouriers.local" } });
    const applied = await applyMarketplaceStoreOrderAdjustment({ storeOrderReference: child.publicReference, adjustmentReference: options.adjustmentReference, actorUserId: storeOwner.id, operationId, requestHash: createHash("sha256").update(JSON.stringify({ action, ...options })).digest("hex"), dependencies: { financialAuthority: new ExistingPhaseFinancialAdjustmentAuthority(dependencies) } });
    assert.ok("refundReference" in applied && typeof applied.refundReference === "string"); result = { publicReference: applied.refundReference };
  } else if (action === "reserve-wallet" || action === "reserve-original") {
    result = await createRefundRequest({ actorUserId: owner, paymentPublicReference: payment.publicReference, amount: options.amount ?? "25.00", method: action === "reserve-wallet" ? "CUSTOMER_WALLET" : "ORIGINAL_PAYMENT_METHOD", reasonCode: "CUSTOMER_SERVICE_RESOLUTION", operationId }, dependencies);
  } else if (action === "cancel") {
    assert.ok(selected); result = await cancelRefundRequest({ actorUserId: owner, publicReference: selected.publicReference, operationId });
  } else if (action === "approve") {
    assert.ok(selected);
    if (selected.status === "REQUESTED") await beginRefundReview({ actorUserId: approver.id, publicReference: selected.publicReference, operationId: `${operationId}:review` });
    result = await approveRefund({ actorUserId: approver.id, publicReference: selected.publicReference, operationId });
  } else if (action === "complete-wallet") {
    assert.ok(selected); result = await completeRefundToCustomerWallet({ actorUserId: processor.id, publicReference: selected.publicReference, operationId }, { assertProductionReady });
  } else if (action === "start-provider") {
    assert.ok(selected); result = await startProviderRefund({ actorUserId: processor.id, publicReference: selected.publicReference, operationId }, { assertProductionReady, registry });
  } else if (action === "query-provider") {
    assert.ok(selected); result = await queryRefundProviderStatus({ actorUserId: processor.id, refundId: selected.id, operationId }, { assertProductionReady, registry });
  } else if (action !== "snapshot") throw new Error("Unsupported disposable refund control action.");
  const fresh = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
  const refunds = await prisma.paymentRefund.findMany({ where: { paymentId: payment.id }, include: { fundingAllocations: true, reserveLedgerJournal: { include: { entries: true } }, releaseLedgerJournal: { include: { entries: true } }, completionLedgerJournal: { include: { entries: true } }, statusHistory: true, attempts: true, reconciliationCases: true }, orderBy: { createdAt: "asc" } });
  const accounts = await prisma.ledgerAccount.findMany({ where: { OR: [{ wallet: { ownerType: "CUSTOMER", ownerId: owner } }, { code: { in: ["PLATFORM-CUSTOMER-FUNDS-HELD-ZAR", "PLATFORM-CASH-CLEARING-ZAR"] } }] }, select: { purpose: true, currentBalance: true } });
  console.log(`REFUND_SNAPSHOT ${JSON.stringify({ result: result ? { reference: (result as { publicReference: string }).publicReference } : null, payment: { amount: fresh.amount.toFixed(2), reserved: fresh.totalRefundReservedAmount.toFixed(2), refunded: fresh.totalRefundedAmount.toFixed(2), status: fresh.status }, accounts: accounts.map(a => ({ purpose: a.purpose, balance: a.currentBalance.toFixed(2) })), refunds: refunds.map(r => ({ id: r.id, reference: r.publicReference, amount: r.amount.toFixed(2), status: r.status, method: r.method, funding: r.fundingAllocations.map(f => ({ amount: f.amount.toFixed(2), source: f.sourceType })), reserve: journalReceipt(r.reserveLedgerJournal), release: journalReceipt(r.releaseLedgerJournal), completion: journalReceipt(r.completionLedgerJournal), history: r.statusHistory.map(h => ({ toStatus: h.toStatus, reason: h.reasonCode, operationId: h.operationId })), attempts: r.attempts.map(a => ({ status: a.status, provider: a.provider, number: a.attemptNumber })), reconciliation: r.reconciliationCases.map(c => ({ status: c.status, reason: c.reason })) })), provider: (await prisma.systemSetting.findUnique({ where: { key: providerKey } }))?.value ?? null })}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
