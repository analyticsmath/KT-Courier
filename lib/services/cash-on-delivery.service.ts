import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withLedgerRetry } from "@/lib/ledger/retry";
import { ensureLedgerAccount, ensureWalletForOwner } from "@/lib/services/wallet-account.service";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";

export class CashOnDeliveryError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

const money = (value: string) => {
  const parsed = new Prisma.Decimal(value);
  if (parsed.isNegative() || !parsed.isFinite() || parsed.decimalPlaces() > 2) throw new CashOnDeliveryError("COD_AMOUNT_MISMATCH", "Cash amount is invalid.");
  return parsed;
};
const hash = (value: unknown) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const reference = (prefix: string, id: string) => `${prefix}-${id.replaceAll("-", "").toUpperCase()}`;

async function custodyAccounts(driverId: string) {
  const [platformWallet, driverWallet] = await Promise.all([
    ensureWalletForOwner({ ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" }),
    ensureWalletForOwner({ ownerType: "DRIVER", ownerId: driverId, currency: "ZAR" }),
  ]);
  const [held, driverCash, platformCash] = await Promise.all([
    ensureLedgerAccount({ walletId: platformWallet.id, code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR", purpose: "HELD", category: "LIABILITY", currency: "ZAR" }),
    ensureLedgerAccount({ walletId: driverWallet.id, code: reference("DRIVER-COD-CASH", driverId), purpose: "CASH_CLEARING", category: "ASSET", currency: "ZAR" }),
    ensureLedgerAccount({ walletId: platformWallet.id, code: "PLATFORM-CASH-CLEARING-ZAR", purpose: "CASH_CLEARING", category: "ASSET", currency: "ZAR" }),
  ]);
  return { held, driverCash, platformCash };
}

export async function createCashOnDeliveryObligation(input: {
  orderId: string; paymentId?: string; policyMode: "FULL_COD" | "DEPOSIT_PLUS_COD";
  authoritativePayable: string; digitalRequired: string; digitalPaid?: string;
}) {
  const payable = money(input.authoritativePayable); const digitalRequired = money(input.digitalRequired); const digitalPaid = money(input.digitalPaid ?? "0");
  const cashObligation = payable.sub(digitalRequired);
  if (cashObligation.isNegative() || digitalPaid.greaterThan(digitalRequired)) throw new CashOnDeliveryError("COD_AMOUNT_MISMATCH", "COD payment split is invalid.");
  return createCashOnDeliveryObligationWithinTransaction(prisma, { ...input, authoritativePayable: payable.toFixed(2), digitalRequired: digitalRequired.toFixed(2), digitalPaid: digitalPaid.toFixed(2) });
}

export async function createCashOnDeliveryObligationWithinTransaction(tx: Prisma.TransactionClient, input: { orderId: string; paymentId?: string; policyMode: "FULL_COD" | "DEPOSIT_PLUS_COD"; authoritativePayable: string; digitalRequired: string; digitalPaid?: string; policyEvidence?: unknown }) {
  const payable = money(input.authoritativePayable); const digitalRequired = money(input.digitalRequired); const digitalPaid = money(input.digitalPaid ?? "0"); const cashObligation = payable.sub(digitalRequired);
  if (cashObligation.isNegative() || digitalPaid.greaterThan(digitalRequired)) throw new CashOnDeliveryError("COD_AMOUNT_MISMATCH", "COD payment split is invalid.");
  return tx.cashOnDelivery.create({ data: { publicReference: `COD-${crypto.randomUUID().replaceAll("-", "").toUpperCase()}`, orderId: input.orderId, paymentId: input.paymentId, policyMode: input.policyMode, authoritativePayable: payable, digitalRequired, digitalPaid, cashObligation, status: input.policyMode === "FULL_COD" ? "READY_FOR_COLLECTION" : "PENDING", events: { create: { operationId: `commit:${input.orderId}`, requestHash: hash({ orderId: input.orderId, policyMode: input.policyMode, payable: payable.toFixed(2), digitalRequired: digitalRequired.toFixed(2) }), eventType: "COMMITTED", safeEvidence: input.policyEvidence as Prisma.InputJsonValue | undefined } } } });
}

/** Called only by the verified payment-success transaction after its ledger receipt is posted. */
export async function activateDepositCashOnDeliveryWithinTransaction(tx: Prisma.TransactionClient, input: { paymentId: string; orderId: string | null; amount: Prisma.Decimal; verifiedEventReference: string }) {
  if (!input.orderId) return null;
  const cod = await tx.cashOnDelivery.findUnique({ where: { orderId: input.orderId } });
  if (!cod || cod.policyMode !== "DEPOSIT_PLUS_COD") return null;
  if (cod.status === "READY_FOR_COLLECTION" && cod.paymentId === input.paymentId && cod.digitalPaid.equals(cod.digitalRequired)) return cod;
  if (cod.status !== "PENDING" || !input.amount.equals(cod.digitalRequired)) throw new CashOnDeliveryError("COD_DEPOSIT_NOT_SATISFIED", "Verified digital payment does not satisfy the committed COD deposit.");
  return tx.cashOnDelivery.update({ where: { id: cod.id }, data: { paymentId: input.paymentId, digitalPaid: input.amount, status: "READY_FOR_COLLECTION", version: { increment: 1 }, events: { create: { operationId: `deposit-verified:${input.paymentId}`, requestHash: hash({ paymentId: input.paymentId, event: input.verifiedEventReference, amount: input.amount.toFixed(2) }), eventType: "DEPOSIT_VERIFIED", safeEvidence: { verifiedEventReference: input.verifiedEventReference } } } } });
}

export async function recordCashCollection(input: { orderId: string; collectorDriverId: string; actorUserId: string; amount: string; operationId: string }) {
  const amount = money(input.amount); const requestHash = hash({ orderId: input.orderId, collectorDriverId: input.collectorDriverId, amount: amount.toFixed(2) });
  const accounts = await custodyAccounts(input.collectorDriverId);
  const run = () => prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "CashOnDelivery" WHERE "orderId" = ${input.orderId} FOR UPDATE`);
    if (rows.length !== 1) throw new CashOnDeliveryError("NOT_COD_ORDER", "Order has no COD obligation.");
    const cod = await tx.cashOnDelivery.findUnique({ where: { id: rows[0].id }, include: { order: true } });
    if (!cod) throw new CashOnDeliveryError("NOT_COD_ORDER", "Order has no COD obligation.");
    if (cod.collectionOperationId === input.operationId) {
      if (cod.collectionRequestHash !== requestHash) throw new CashOnDeliveryError("COD_COLLECTION_CONFLICT", "Collection operation conflicts with existing evidence.");
      return cod;
    }
    if (cod.status === "COLLECTED" || cod.status === "RECONCILED") throw new CashOnDeliveryError("COD_ALREADY_COLLECTED", "Cash is already collected.");
    if (cod.status !== "READY_FOR_COLLECTION" || cod.order.currentDriverProfileId !== input.collectorDriverId) throw new CashOnDeliveryError("COD_COLLECTOR_NOT_AUTHORIZED", "Collector is not assigned to this COD order.");
    if (cod.policyMode === "DEPOSIT_PLUS_COD") {
      const deposit = cod.paymentId ? await tx.payment.findUnique({ where: { id: cod.paymentId } }) : null;
      if (!deposit || deposit.status !== "SUCCEEDED" || !deposit.amount.equals(cod.digitalRequired) || !cod.digitalPaid.equals(cod.digitalRequired)) throw new CashOnDeliveryError("COD_DEPOSIT_NOT_SATISFIED", "Verified digital deposit is required before cash collection.");
    }
    if (!amount.equals(cod.cashObligation.sub(cod.cashCollected))) throw new CashOnDeliveryError("COD_OVER_COLLECTION", "Collection amount must equal the outstanding cash obligation.");
    const journal = await postLedgerJournalWithinTransaction(tx, { idempotencyKey: `cod-collect:${input.operationId}`, type: "GENERAL", currency: "ZAR", sourceReference: `cod:${cod.publicReference}:collection`, correlationId: cod.publicReference, memo: "COD cash collection into driver custody", actor: { kind: "USER", userId: input.actorUserId }, metadata: { codReference: cod.publicReference, collectorDriverId: input.collectorDriverId }, entries: [{ accountId: accounts.driverCash.id, direction: "DEBIT", amount: amount.toFixed(2), lineCode: "DRIVER_CASH_CUSTODY" }, { accountId: accounts.held.id, direction: "CREDIT", amount: amount.toFixed(2), lineCode: "CUSTOMER_FUNDS_HELD" }] });
    return tx.cashOnDelivery.update({ where: { id: cod.id }, data: { cashCollected: { increment: amount }, status: "COLLECTED", collectorDriverId: input.collectorDriverId, collectedAt: new Date(), collectionOperationId: input.operationId, collectionRequestHash: requestHash, collectionJournalId: journal.id, version: { increment: 1 }, events: { create: { operationId: `collection:${input.operationId}`, requestHash, eventType: "COLLECTED", actorUserId: input.actorUserId } } } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  try { return await withLedgerRetry(run); } catch (error) { if ((error as { code?: string }).code === "P2002") { const winner = await prisma.cashOnDelivery.findUnique({ where: { orderId: input.orderId } }); if (winner?.collectionOperationId === input.operationId && winner.collectionRequestHash === requestHash) return winner; } throw error; }
}

export async function reconcileCashCollection(input: { orderId: string; actorUserId: string; receivedAmount: string; operationId: string; evidenceReference?: string }) {
  const received = money(input.receivedAmount); const requestHash = hash({ orderId: input.orderId, received: received.toFixed(2), evidenceReference: input.evidenceReference ?? null });
  const run = () => prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "CashOnDelivery" WHERE "orderId" = ${input.orderId} FOR UPDATE`);
    if (rows.length !== 1) throw new CashOnDeliveryError("NOT_COD_ORDER", "Order has no COD obligation.");
    const cod = await tx.cashOnDelivery.findUnique({ where: { id: rows[0].id } });
    if (!cod?.collectorDriverId) throw new CashOnDeliveryError("COD_NOT_RECONCILABLE", "COD collection has no collector custody evidence.");
    if (cod.reconciliationJournalId) throw new CashOnDeliveryError("COD_ALREADY_RECONCILED", "COD collection is already reconciled.");
    if (cod.status !== "COLLECTED" || !received.equals(cod.cashCollected)) throw new CashOnDeliveryError("COD_NOT_RECONCILABLE", "COD cash cannot be reconciled with a discrepancy.");
    const accounts = await custodyAccounts(cod.collectorDriverId);
    const journal = await postLedgerJournalWithinTransaction(tx, { idempotencyKey: `cod-reconcile:${input.operationId}`, type: "GENERAL", currency: "ZAR", sourceReference: `cod:${cod.publicReference}:reconciliation`, correlationId: cod.publicReference, memo: "COD driver custody handover", actor: { kind: "USER", userId: input.actorUserId }, metadata: { codReference: cod.publicReference, collectorDriverId: cod.collectorDriverId }, entries: [{ accountId: accounts.platformCash.id, direction: "DEBIT", amount: received.toFixed(2), lineCode: "PLATFORM_CASH_RECEIVED" }, { accountId: accounts.driverCash.id, direction: "CREDIT", amount: received.toFixed(2), lineCode: "DRIVER_CUSTODY_RELEASED" }] });
    return tx.cashOnDelivery.update({ where: { id: cod.id }, data: { cashReconciled: received, status: "RECONCILED", reconciliationStatus: "RECONCILED", reconciledAt: new Date(), reconciliationActorId: input.actorUserId, reconciliationJournalId: journal.id, version: { increment: 1 }, reconciliations: { create: { operationId: input.operationId, requestHash, expectedAmount: cod.cashCollected, receivedAmount: received, discrepancyAmount: new Prisma.Decimal(0), collectorDriverId: cod.collectorDriverId, reconciledByUserId: input.actorUserId, evidenceReference: input.evidenceReference, journalId: journal.id } }, events: { create: { operationId: `reconciliation:${input.operationId}`, requestHash, eventType: "RECONCILED", actorUserId: input.actorUserId } } } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return withLedgerRetry(run);
}

export async function recordCashCollectionFailure(input: { orderId: string; collectorDriverId: string; actorUserId: string; reasonCode: "CUSTOMER_UNAVAILABLE" | "CUSTOMER_REFUSED" | "INSUFFICIENT_CASH" | "AMOUNT_DISPUTE" | "DELIVERY_FAILED" | "OTHER"; operationId: string }) {
  const requestHash = hash({ orderId: input.orderId, collectorDriverId: input.collectorDriverId, reasonCode: input.reasonCode });
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "CashOnDelivery" WHERE "orderId" = ${input.orderId} FOR UPDATE`);
    if (rows.length !== 1) throw new CashOnDeliveryError("NOT_COD_ORDER", "Order has no COD obligation.");
    const cod = await tx.cashOnDelivery.findUnique({ where: { id: rows[0].id }, include: { order: true } });
    if (!cod || cod.status !== "READY_FOR_COLLECTION" || cod.order.currentDriverProfileId !== input.collectorDriverId) throw new CashOnDeliveryError("COD_NOT_READY", "COD cash collection cannot be failed by this collector.");
    const prior = await tx.cashOnDeliveryEvent.findUnique({ where: { operationId: input.operationId } });
    if (prior) { if (prior.requestHash !== requestHash) throw new CashOnDeliveryError("COD_COLLECTION_CONFLICT", "Failure operation conflicts with existing evidence."); return cod; }
    return tx.cashOnDelivery.update({ where: { id: cod.id }, data: { status: "COLLECTION_FAILED", failureReasonCode: input.reasonCode, version: { increment: 1 }, events: { create: { operationId: input.operationId, requestHash, eventType: "COLLECTION_FAILED", actorUserId: input.actorUserId, safeReasonCode: input.reasonCode } } } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
