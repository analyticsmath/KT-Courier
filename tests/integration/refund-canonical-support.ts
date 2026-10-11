import { strict as assert } from "node:assert";
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { Page } from "@playwright/test";
import { expect } from "vitest";
import { prisma } from "../../lib/db/prisma";
import { assertDisposablePaystackAcceptance } from "../../lib/testing/disposable-paystack-policy";
import { PaystackClient, type PaystackRefundData, type PaystackRefundInput } from "../../lib/payments/providers/paystack/paystack-client";
import { PaystackRefundAdapter } from "../../lib/refunds/providers/paystack/paystack-refund-adapter";
import { RefundProviderRegistry } from "../../lib/refunds/providers/refund-provider-registry";
import { ensureCustomerRefundWallet } from "../../lib/services/customer-wallet.service";
import { canonicalPaidBasket } from "./marketplace-canonical-support";

export async function assertCanonicalRefundDatabase() {
  assertDisposablePaystackAcceptance();
  const rows = await prisma.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database() AS database, current_user AS role`;
  assert.deepEqual(rows, [{ database: "kt_phase75_e2e", role: "kt_phase75_e2e" }]);
}

/** Test-only provider data client. It never calls fetch or mutates financial rows. */
export class CanonicalOfflineRefundClient extends PaystackClient {
  outcome = "processed";
  calls = 0;
  queries = 0;
  readonly accepted = new Map<string, { amount: number; transaction: string }>();
  private nextId: number;
  constructor(readonly sourceReference: string) {
    super({ secretKey: "sk_test_disposable_browser_no_provider" });
    this.nextId = parseInt(createHash("sha256").update(sourceReference).digest("hex").slice(0, 12), 16);
  }
  async createRefund(input: PaystackRefundInput): Promise<PaystackRefundData> {
    assertDisposablePaystackAcceptance();
    assert.equal(input.transaction, this.sourceReference);
    assert.equal(input.currency, "ZAR"); assert.ok(Number.isSafeInteger(input.amountCents) && input.amountCents! > 0);
    this.calls++;
    const id = ++this.nextId;
    this.accepted.set(String(id), { amount: input.amountCents!, transaction: input.transaction });
    if (this.outcome === "network-loss") throw new TypeError("Synthetic transport loss after accepted provider request.");
    if (this.outcome === "rate-limit") throw new Error("Synthetic provider rate limit.");
    return this.facts(String(id));
  }
  async getRefund(id: string): Promise<PaystackRefundData> {
    assertDisposablePaystackAcceptance(); this.queries++;
    if (this.outcome === "query-loss") throw new TypeError("Synthetic query transport loss.");
    return this.facts(id);
  }
  private facts(id: string): PaystackRefundData {
    const accepted = this.accepted.get(id); assert.ok(accepted, "Only a independently accepted fixture refund may be queried.");
    return { id: this.outcome === "wrong-refund" ? Number(id) + 1 : Number(id),
      transaction: { id: 1, reference: this.outcome === "wrong-reference" ? "foreign-provider-transaction" : accepted.transaction },
      amount: accepted.amount + (this.outcome === "wrong-amount" ? 1 : 0),
      deducted_amount: this.outcome === "processed" ? accepted.amount : 0,
      currency: this.outcome === "wrong-currency" ? "USD" : "ZAR",
      status: this.outcome.startsWith("wrong-") ? "processed" : this.outcome,
    } as PaystackRefundData;
  }
}

export async function refundActors() {
  const [approver, processor, foreign] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "superadmin@ktcouriers.local" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "e2e-editorial-reviewer@ktcouriers.local" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "e2e-checkout-other@ktcouriers.local" } }),
  ]);
  expect(approver.role).toBe("SUPER_ADMIN"); expect(processor.role).toBe("SUPER_ADMIN"); expect(approver.id).not.toBe(processor.id);
  return { approver, processor, foreign };
}

export async function canonicalRefundSource(page: Page, suffix: string) {
  await assertCanonicalRefundDatabase();
  const source = await canonicalPaidBasket(page, suffix);
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: source.paid.payment.id }, include: { successfulAttempt: true, successWebhookEvent: true } });
  assert.ok(payment.userId && payment.successfulAttempt?.providerReference);
  expect(payment.successWebhookEvent).toMatchObject({ processingStatus: "APPLIED", signatureVerified: true, merchantVerified: true, amountVerified: true, providerDataVerified: true });
  await ensureCustomerRefundWallet(payment.userId);
  const client = new CanonicalOfflineRefundClient(payment.successfulAttempt.providerReference);
  const registry = new RefundProviderRegistry([new PaystackRefundAdapter(client)]);
  const dependencies = { assertProductionReady: () => assertDisposablePaystackAcceptance(), registry, providerRegistry: registry };
  return { ...source, payment, owner: payment.userId, client, registry, dependencies, ...await refundActors() };
}

export const refundOperation = (label: string) => `${label}:${randomUUID()}`;

export async function protectedRefundState(paymentId: string) {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId }, select: { status: true, amount: true, totalRefundedAmount: true, totalRefundReservedAmount: true, version: true } });
  const refunds = await prisma.paymentRefund.findMany({ where: { paymentId }, orderBy: { id: "asc" }, include: { reserveLedgerJournal: { include: { entries: { orderBy: { sequence: "asc" } } } }, releaseLedgerJournal: { include: { entries: { orderBy: { sequence: "asc" } } } }, completionLedgerJournal: { include: { entries: { orderBy: { sequence: "asc" } } } }, fundingAllocations: { orderBy: { id: "asc" } }, statusHistory: { orderBy: { id: "asc" } }, attempts: { orderBy: { attemptNumber: "asc" } }, reconciliationCases: { orderBy: { id: "asc" } } } });
  const journals = refunds.flatMap(r => [r.reserveLedgerJournal, r.releaseLedgerJournal, r.completionLedgerJournal].filter((j): j is NonNullable<typeof j> => Boolean(j)));
  const accountIds = [...new Set(journals.flatMap(j => j.entries.map(e => e.accountId)))];
  const accounts = await prisma.ledgerAccount.findMany({ where: { id: { in: accountIds } }, select: { id: true, currentBalance: true, allowNegative: true }, orderBy: { id: "asc" } });
  return { payment, refunds, journals, accounts };
}

export function assertJournalMoney(journal: { type: string; totalDebits: Prisma.Decimal; totalCredits: Prisma.Decimal; entries: Array<{ direction: string; amount: Prisma.Decimal }> } | null, type: string, amount: string) {
  expect(journal).not.toBeNull();
  expect(journal!.type).toBe(type); expect(journal!.totalDebits.toFixed(2)).toBe(amount); expect(journal!.totalCredits.toFixed(2)).toBe(amount);
  for (const direction of ["DEBIT", "CREDIT"]) expect(journal!.entries.filter(e => e.direction === direction).reduce((sum, e) => sum.add(e.amount), new Prisma.Decimal(0)).toFixed(2)).toBe(amount);
}
