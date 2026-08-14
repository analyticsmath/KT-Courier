import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { LedgerMoney } from "@/lib/ledger/money";
import { withLedgerRetry } from "@/lib/ledger/retry";
import { calculateCumulativeCommissionAdjustments } from "@/lib/refunds/refund-commission-adjustment";
import { assertRefundEligibility } from "@/lib/refunds/refund-eligibility-policy";
import { RefundError } from "@/lib/refunds/errors";
import { buildRefundFundingPlan, type RefundFundingPlanItem } from "@/lib/refunds/refund-funding-policy";
import { refundCreationHash } from "@/lib/refunds/refund-idempotency";
import { assertRefundReserveJournalEvidence } from "@/lib/refunds/refund-ledger-evidence";
import { refundReleasePosting, refundReservePosting } from "@/lib/refunds/refund-ledger-policy";
import { parseRefundAmount } from "@/lib/refunds/refund-money-policy";
import { assertRefundOperationId, sanitizeRefundNote } from "@/lib/refunds/refund-note-policy";
import { assertRefundProductionActivation } from "@/lib/refunds/refund-production-readiness";
import { assertRefundTransition } from "@/lib/refunds/refund-state-machine";
import { REFUND_METHODS, REFUND_POLICY_VERSION, REFUND_REASON_CODES, type RefundMethodCode, type RefundReasonCodeValue } from "@/lib/refunds/types";
import type { RefundProviderRegistry } from "@/lib/refunds/providers/refund-provider-registry";
import { ensureCustomerRefundWallet } from "./customer-wallet.service";
import { postLedgerJournalWithinTransaction } from "./ledger-posting.service";
import { assertGenericRefundHasNoStoreEarningExposure, releaseStoreEarningRefundReservationsWithinTransaction } from "./store-earning-refund.service";
import { assertGenericRefundHasNoDriverEarningExposure, releaseDriverEarningRefundReservationsWithinTransaction } from "./driver-earning-refund.service";

function refundReference(): string { return `RF-${randomUUID().replaceAll("-", "").toUpperCase()}`; }
function fundingReference(): string { return `RFA-${randomUUID().replaceAll("-", "").toUpperCase()}`; }

type RequestDependencies = Readonly<{
  assertProductionReady?: () => void;
  providerRegistry?: RefundProviderRegistry;
}>;

async function lockPaymentByReference(tx: Prisma.TransactionClient, publicReference: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "Payment" WHERE "paymentNumber" = ${publicReference} FOR UPDATE`);
  if (rows.length !== 1) throw new RefundError("REFUND_NOT_FOUND", "Successful payment was not found.");
  const payment = await tx.payment.findUnique({
    where: { id: rows[0].id },
    include: {
      user: { select: { id: true, role: true, status: true } },
      order: { select: { id: true, orderNumber: true } },
      successfulAttempt: { select: { id: true, status: true, provider: true, providerReference: true } },
      successWebhookEvent: { select: { id: true, processingStatus: true, signatureVerified: true, merchantVerified: true, amountVerified: true, providerDataVerified: true } },
      refunds: { select: { id: true, amount: true, status: true } },
    },
  });
  if (!payment) throw new RefundError("REFUND_NOT_FOUND", "Successful payment was not found.");
  return payment;
}

async function resolveCustomerRefundAccounts(tx: Prisma.TransactionClient, customerUserId: string) {
  const wallet = await tx.wallet.findUnique({
    where: { ownerType_ownerId_currency: { ownerType: "CUSTOMER", ownerId: customerUserId, currency: "ZAR" } },
    include: { accounts: { where: { purpose: { in: ["CUSTOMER_WALLET_AVAILABLE", "CUSTOMER_REFUND_HELD"] }, currency: "ZAR" } } },
  });
  const available = wallet?.accounts.find((account) => account.purpose === "CUSTOMER_WALLET_AVAILABLE");
  const held = wallet?.accounts.find((account) => account.purpose === "CUSTOMER_REFUND_HELD");
  if (!wallet || wallet.status !== "ACTIVE" || !available || !held || available.category !== "LIABILITY" || held.category !== "LIABILITY" || available.allowNegative || held.allowNegative) {
    throw new RefundError("REFUND_PAYMENT_INELIGIBLE", "Customer refund wallet accounts are not provisioned.");
  }
  return { wallet, available, held };
}

async function resolveOriginalCommissionAllocations(tx: Prisma.TransactionClient, payment: Awaited<ReturnType<typeof lockPaymentByReference>>) {
  const accruals = await tx.commissionAccrual.findMany({
    where: { subjectType: "COURIER_ORDER", subjectId: payment.orderId ?? undefined, status: { in: ["ACCRUED", "RECONCILIATION_REQUIRED"] } },
    include: { allocations: { orderBy: { id: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  if (accruals.some((accrual) => accrual.status === "RECONCILIATION_REQUIRED") || accruals.length > 1) {
    throw new RefundError("REFUND_FUNDING_UNAVAILABLE", "Commission evidence requires reconciliation before refund reservation.");
  }
  const allocationIds = accruals[0]?.allocations.map((allocation) => allocation.id) ?? [];
  if (allocationIds.length > 0) {
    const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "CommissionAllocation" WHERE "id" IN (${Prisma.join(allocationIds)}) ORDER BY "id" ASC FOR UPDATE`);
    if (locked.length !== allocationIds.length) throw new RefundError("REFUND_FUNDING_UNAVAILABLE", "Original commission allocations could not be locked coherently.");
  }
  const allocations = allocationIds.length === 0
    ? []
    : await tx.commissionAllocation.findMany({ where: { id: { in: allocationIds } }, orderBy: { id: "asc" } });
  const ids = allocations.map((allocation) => allocation.id);
  const existingAdjustments = ids.length === 0 ? [] : await tx.refundFundingAllocation.groupBy({
    by: ["commissionAllocationId"],
    where: { commissionAllocationId: { in: ids }, refund: { status: { notIn: ["REJECTED", "CANCELLED"] } } },
    _sum: { amount: true },
  });
  const adjusted = new Map(existingAdjustments.map((row) => [row.commissionAllocationId, row._sum.amount ?? new Prisma.Decimal(0)]));
  return allocations.map((allocation) => ({
    id: allocation.id,
    publicReference: allocation.publicReference,
    accrualId: allocation.accrualId,
    allocationType: allocation.allocationType,
    ledgerAccountId: allocation.ledgerAccountId,
    amount: allocation.amount,
    previouslyAdjustedAmount: adjusted.get(allocation.id) ?? new Prisma.Decimal(0),
    status: allocation.status,
    downstreamReleaseJournalId: allocation.downstreamReleaseJournalId,
  }));
}

async function lockAndVerifyFundingAccounts(tx: Prisma.TransactionClient, funding: readonly RefundFundingPlanItem[], heldAccountId: string, options: Readonly<{ allowPlatformHeld?: boolean }> = {}): Promise<void> {
  const accountIds = [...new Set([...funding.map((item) => item.ledgerAccountId), heldAccountId])].sort();
  const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "LedgerAccount" WHERE "id" IN (${Prisma.join(accountIds)}) ORDER BY "id" ASC FOR UPDATE`);
  if (locked.length !== accountIds.length) throw new RefundError("REFUND_FUNDING_UNAVAILABLE", "One or more refund funding accounts are unavailable.");
  const accounts = await tx.ledgerAccount.findMany({ where: { id: { in: accountIds } }, include: { wallet: { select: { status: true, ownerType: true, ownerId: true } } } });
  for (const item of funding) {
    const account = accounts.find((candidate) => candidate.id === item.ledgerAccountId);
    if (!account || account.status !== "ACTIVE" || account.wallet.status !== "ACTIVE" || account.currency !== "ZAR" || LedgerMoney.fromDecimal(account.currentBalance).lessThan(LedgerMoney.parse(item.amount))) {
      throw new RefundError("REFUND_FUNDING_UNAVAILABLE", "Refund source balance does not cover its reservation allocation.");
    }
  }
  const held = accounts.find((candidate) => candidate.id === heldAccountId);
  const validGuestHeld = options.allowPlatformHeld && held?.purpose === "HELD" && held.category === "LIABILITY" && !held.allowNegative && held.wallet.ownerType === "PLATFORM" && held.wallet.ownerId === "platform";
  if (!held || (!validGuestHeld && (held.purpose !== "CUSTOMER_REFUND_HELD" || held.category !== "LIABILITY" || held.allowNegative))) {
    throw new RefundError("REFUND_LEDGER_INCOHERENT", "Customer refund-held account is invalid.");
  }
}

/**
 * Phase 15 marketplace adapter.  Authenticated customers reuse the normal
 * request path. Guest checkout refunds can reserve only to the original payment
 * method and retain no wallet/customer identity or secret.
 */
export function assertMarketplaceRefundRequestMethod(input: Readonly<{ customerUserId?: string | null; guestConfirmationVerified?: boolean; method: RefundMethodCode; customerWalletElected?: boolean }>) {
  if (input.customerUserId) {
    if (input.method === "CUSTOMER_WALLET" && !input.customerWalletElected) throw new RefundError("REFUND_PAYMENT_INELIGIBLE", "Wallet refund requires explicit authenticated customer election.");
    return "AUTHENTICATED" as const;
  }
  if (!input.guestConfirmationVerified || input.method !== "ORIGINAL_PAYMENT_METHOD") throw new RefundError("REFUND_FORBIDDEN", "Guest marketplace refunds require verified guest authority and the original payment method.");
  return "GUEST_ORIGINAL_METHOD" as const;
}

export async function createMarketplaceRefundRequest(input: Readonly<{
  paymentPublicReference: string;
  customerUserId?: string | null;
  guestConfirmationVerified?: boolean;
  amount: string;
  method: RefundMethodCode;
  reasonCode: RefundReasonCodeValue;
  customerWalletElected?: boolean;
  operationId: string;
}>, dependencies: RequestDependencies = {}) {
  (dependencies.assertProductionReady ?? assertRefundProductionActivation)();
  if (assertMarketplaceRefundRequestMethod(input) === "AUTHENTICATED") {
    return createRefundRequest({ actorUserId: input.customerUserId!, paymentPublicReference: input.paymentPublicReference, amount: input.amount, method: input.method, reasonCode: input.reasonCode, operationId: input.operationId }, dependencies);
  }
  const operationId = assertRefundOperationId(input.operationId);
  const amount = parseRefundAmount(input.amount);
  const run = () => prisma.$transaction(async (tx) => {
    const payment = await lockPaymentByReference(tx, input.paymentPublicReference);
    if (payment.subjectType !== "MARKETPLACE_CHECKOUT" || payment.userId || payment.status !== "SUCCEEDED" || payment.currency !== "ZAR" || payment.successfulAttempt?.status !== "SUCCEEDED" || payment.successWebhookEvent?.processingStatus !== "APPLIED" || !payment.successWebhookEvent.signatureVerified || !payment.successWebhookEvent.merchantVerified || !payment.successWebhookEvent.amountVerified || !payment.successWebhookEvent.providerDataVerified) throw new RefundError("REFUND_PAYMENT_INELIGIBLE", "Guest marketplace payment evidence is not eligible for a refund reservation.");
    const requestHash = refundCreationHash({ paymentId: payment.id, customerUserId: "GUEST_MARKETPLACE", amount: amount.toString(), method: input.method, reasonCode: input.reasonCode, customerNote: null, policyVersion: REFUND_POLICY_VERSION });
    const replay = await tx.paymentRefund.findUnique({ where: { creationIdempotencyKey: operationId } });
    if (replay) {
      if (replay.creationRequestHash !== requestHash) throw new RefundError("REFUND_IDEMPOTENCY_CONFLICT", "Operation ID belongs to a different marketplace refund request.");
      return replay;
    }
    const succeeded = payment.refunds.filter((refund) => refund.status === "SUCCEEDED").reduce((sum, refund) => sum.add(refund.amount), new Prisma.Decimal(0));
    const reserved = payment.refunds.filter((refund) => ["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING", "RECONCILIATION_REQUIRED"].includes(refund.status)).reduce((sum, refund) => sum.add(refund.amount), new Prisma.Decimal(0));
    if (amount.toDecimal().greaterThan(payment.amount.sub(succeeded).sub(reserved))) throw new RefundError("REFUND_AMOUNT_EXCEEDS_REMAINING", "Guest refund exceeds the remaining original payment amount.");
    const held = await tx.ledgerAccount.findFirst({ where: { purpose: "HELD", category: "LIABILITY", currency: "ZAR", status: "ACTIVE", allowNegative: false, wallet: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" } } });
    if (!held) throw new RefundError("REFUND_FUNDING_UNAVAILABLE", "Canonical marketplace customer-funds-held account is unavailable.");
    const funding: RefundFundingPlanItem[] = [{ publicReference: fundingReference(), sourceType: "CUSTOMER_FUNDS_HELD", ledgerAccountId: held.id, commissionAccrualId: null, commissionAllocationId: null, commissionAllocationReference: null, storeEarningId: null, driverEarningId: null, amount: amount.toString() }];
    await lockAndVerifyFundingAccounts(tx, funding, held.id, { allowPlatformHeld: true });
    const publicReference = refundReference();
    const reserveJournal = await postLedgerJournalWithinTransaction(tx, refundReservePosting({ refundReference: publicReference, paymentReference: payment.publicReference, amount: amount.toString(), heldAccountId: held.id, method: input.method, reasonCode: input.reasonCode, funding }));
    const refund = await tx.paymentRefund.create({ data: { publicReference, paymentId: payment.id, customerUserId: null, method: input.method, amount: amount.toDecimal(), currency: "ZAR", status: "REQUESTED", reasonCode: input.reasonCode, creationIdempotencyKey: operationId, creationRequestHash: requestHash, policyVersion: REFUND_POLICY_VERSION, reserveLedgerJournalId: reserveJournal.id } as never });
    await tx.refundFundingAllocation.createMany({ data: funding.map((item) => ({ publicReference: item.publicReference, refundId: refund.id, sourceType: item.sourceType, ledgerAccountId: item.ledgerAccountId, commissionAccrualId: null, commissionAllocationId: null, storeEarningId: null, driverEarningId: null, amount: item.amount, currency: "ZAR" })) });
    const projection = await tx.payment.updateMany({ where: { id: payment.id, version: payment.version }, data: { totalRefundReservedAmount: { increment: amount.toDecimal() }, version: { increment: 1 } } });
    if (projection.count !== 1) throw new RefundError("REFUND_CONCURRENCY_CONFLICT", "Guest refund reservation lost a concurrent update.", true);
    await tx.refundStatusHistory.create({ data: { refundId: refund.id, toStatus: "REQUESTED", actorType: "SYSTEM", operationId, reasonCode: "MARKETPLACE_GUEST_REFUND_RESERVED", safeMetadata: { reserveJournalReference: reserveJournal.reference, method: input.method } } });
    return refund;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return withLedgerRetry(run);
}

export type RefundRequestInput = Readonly<{
  actorUserId: string;
  paymentPublicReference: string;
  amount: string;
  method: RefundMethodCode;
  reasonCode: RefundReasonCodeValue;
  customerNote?: string;
  operationId: string;
}>;

function assertRefundRequestInput(input: RefundRequestInput) {
  const operationId = assertRefundOperationId(input.operationId);
  const amount = parseRefundAmount(input.amount);
  const customerNote = sanitizeRefundNote(input.customerNote);
  if (!(REFUND_METHODS as readonly string[]).includes(input.method) || !(REFUND_REASON_CODES as readonly string[]).includes(input.reasonCode)) {
    throw new RefundError("REFUND_INVALID_INPUT", "Refund method or reason code is invalid.");
  }
  return { operationId, amount, customerNote };
}

/**
 * Canonical refund-reservation authority for a caller that already owns the
 * transaction.  It intentionally performs no root-client reads or nested
 * transaction/retry: its payment, ledger, refund and idempotency effects are
 * part of the parent's atomic decision.
 */
export async function createRefundRequestInTransaction(tx: Prisma.TransactionClient, input: RefundRequestInput, dependencies: RequestDependencies = {}) {
  const { operationId, amount, customerNote } = assertRefundRequestInput(input);
  const replayByOperation = await tx.paymentRefund.findUnique({ where: { creationIdempotencyKey: operationId } });
  if (replayByOperation) {
    const payment = await tx.payment.findUnique({ where: { publicReference: input.paymentPublicReference }, select: { id: true } });
    const requestHash = payment ? refundCreationHash({ paymentId: payment.id, customerUserId: input.actorUserId, amount: amount.toString(), method: input.method, reasonCode: input.reasonCode, customerNote, policyVersion: REFUND_POLICY_VERSION }) : null;
    if (requestHash && replayByOperation.creationRequestHash === requestHash) return replayByOperation;
    throw new RefundError("REFUND_IDEMPOTENCY_CONFLICT", "Operation ID belongs to a different refund request.");
  }

  const payment = await lockPaymentByReference(tx, input.paymentPublicReference);
  const requestHash = refundCreationHash({ paymentId: payment.id, customerUserId: input.actorUserId, amount: amount.toString(), method: input.method, reasonCode: input.reasonCode, customerNote, policyVersion: REFUND_POLICY_VERSION });
  if (!payment.user || payment.userId !== input.actorUserId || payment.user.role !== "CUSTOMER" || payment.user.status !== "ACTIVE") throw new RefundError("REFUND_FORBIDDEN", "Payment does not belong to the active customer.");
  const succeeded = payment.refunds.filter((refund) => refund.status === "SUCCEEDED").reduce((sum, refund) => sum.add(refund.amount), new Prisma.Decimal(0));
  const reserved = payment.refunds.filter((refund) => ["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING", "RECONCILIATION_REQUIRED"].includes(refund.status)).reduce((sum, refund) => sum.add(refund.amount), new Prisma.Decimal(0));
  if (!succeeded.equals(payment.totalRefundedAmount) || !reserved.equals(payment.totalRefundReservedAmount)) throw new RefundError("REFUND_LEDGER_INCOHERENT", "Payment refund projections do not match refund evidence.");
  const remaining = payment.amount.sub(succeeded).sub(reserved);
  if (amount.toDecimal().greaterThan(remaining)) throw new RefundError("REFUND_AMOUNT_EXCEEDS_REMAINING", "Requested refund exceeds the remaining refundable amount.");
  const accounts = await resolveCustomerRefundAccounts(tx, input.actorUserId);
  const incompatible = payment.refunds.some((refund) => refund.status === "PROCESSING" || refund.status === "RECONCILIATION_REQUIRED");
  const provider = payment.provider === "PAYFAST" ? payment.provider : null;
  const adapter = input.method === "ORIGINAL_PAYMENT_METHOD" && provider && dependencies.providerRegistry ? dependencies.providerRegistry.getAdapter(provider) : null;
  const providerSupportsMethod = Boolean(adapter && adapter.capabilities.supportsFullRefund && (amount.toDecimal().equals(payment.amount) || adapter.capabilities.supportsPartialRefund) && !adapter.capabilities.requiresCustomerBankData);
  assertRefundEligibility({ paymentStatus: payment.status, paymentCustomerUserId: payment.userId, requestingCustomerUserId: input.actorUserId, currency: payment.currency, paymentAmount: payment.amount.toFixed(2), remainingRefundableAmount: remaining.toFixed(2), requestedAmount: amount.toString(), hasVerifiedSuccessfulAttempt: payment.successfulAttempt?.status === "SUCCEEDED", hasVerifiedWebhook: Boolean(payment.successWebhookEvent?.processingStatus === "APPLIED" && payment.successWebhookEvent.signatureVerified && payment.successWebhookEvent.merchantVerified && payment.successWebhookEvent.amountVerified && payment.successWebhookEvent.providerDataVerified), hasSuccessLedgerJournal: Boolean(payment.successLedgerJournalId), hasIncompatibleActiveRefund: incompatible, hasChargebackOrDisputeEvidence: false, financialAllocationsSafe: true, customerWalletProvisioned: Boolean(accounts.available && accounts.held), providerReferenceAvailable: Boolean(payment.successfulAttempt?.providerReference), providerSupportsMethod, method: input.method, reasonCode: input.reasonCode });
  await assertGenericRefundHasNoStoreEarningExposure(tx, payment.id);
  await assertGenericRefundHasNoDriverEarningExposure(tx, payment.id);
  const allocations = await resolveOriginalCommissionAllocations(tx, payment);
  const deltas = calculateCumulativeCommissionAdjustments({ originalPaymentAmount: payment.amount, priorSuccessfulAndReservedRefundAmount: succeeded.add(reserved), currentRefundAmount: amount.toDecimal(), allocations });
  const customerFunds = await tx.ledgerAccount.findUnique({ where: { code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR" } });
  if (!customerFunds || customerFunds.purpose !== "HELD" || customerFunds.category !== "LIABILITY" || customerFunds.allowNegative) throw new RefundError("REFUND_FUNDING_UNAVAILABLE", "Platform customer funds held account is unavailable.");
  const funding = buildRefundFundingPlan({ refundAmount: amount.toString(), customerFundsHeldAccountId: customerFunds.id, adjustmentDeltas: deltas, createReference: fundingReference });
  await lockAndVerifyFundingAccounts(tx, funding, accounts.held.id);
  const publicReference = refundReference();
  const reserveJournal = await postLedgerJournalWithinTransaction(tx, refundReservePosting({ refundReference: publicReference, paymentReference: payment.publicReference, amount: amount.toString(), actorUserId: input.actorUserId, heldAccountId: accounts.held.id, method: input.method, reasonCode: input.reasonCode, funding }));
  const refund = await tx.paymentRefund.create({ data: { publicReference, paymentId: payment.id, customerUserId: input.actorUserId, method: input.method, amount: amount.toDecimal(), currency: "ZAR", status: "REQUESTED", reasonCode: input.reasonCode, customerNote, creationIdempotencyKey: operationId, creationRequestHash: requestHash, policyVersion: REFUND_POLICY_VERSION, reserveLedgerJournalId: reserveJournal.id } });
  await tx.refundFundingAllocation.createMany({ data: funding.map((item) => ({ publicReference: item.publicReference, refundId: refund.id, sourceType: item.sourceType, ledgerAccountId: item.ledgerAccountId, commissionAccrualId: item.commissionAccrualId, commissionAllocationId: item.commissionAllocationId, storeEarningId: item.storeEarningId, driverEarningId: item.driverEarningId, amount: item.amount, currency: "ZAR" })) });
  const projection = await tx.payment.updateMany({ where: { id: payment.id, version: payment.version }, data: { totalRefundReservedAmount: { increment: amount.toDecimal() }, version: { increment: 1 } } });
  if (projection.count !== 1) throw new RefundError("REFUND_CONCURRENCY_CONFLICT", "Payment refund reservation lost a concurrent update.", true);
  await tx.refundStatusHistory.createMany({ data: [
    { refundId: refund.id, toStatus: "REQUESTED", actorType: "CUSTOMER", actorUserId: input.actorUserId, operationId, reasonCode: "REFUND_REQUESTED" },
    { refundId: refund.id, toStatus: "REQUESTED", actorType: "SYSTEM", reasonCode: "FUNDS_RESERVED", safeMetadata: { reserveJournalReference: reserveJournal.reference } },
  ] });
  return refund;
}

export async function createRefundRequest(input: RefundRequestInput, dependencies: RequestDependencies = {}) {
  (dependencies.assertProductionReady ?? assertRefundProductionActivation)();
  assertRefundRequestInput(input);

  await ensureCustomerRefundWallet(input.actorUserId);
  const run = () => prisma.$transaction((tx) => createRefundRequestInTransaction(tx, input, dependencies), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  try { return await withLedgerRetry(run); }
  catch (error) {
    if ((error as { code?: string })?.code !== "P2002") throw error;
    const operationId = assertRefundOperationId(input.operationId);
    const winner = await prisma.paymentRefund.findUnique({ where: { creationIdempotencyKey: operationId } });
    if (winner) return winner;
    throw new RefundError("REFUND_IDEMPOTENCY_CONFLICT", "Operation ID belongs to a different refund request.");
  }
}

async function releaseRefundReservation(input: Readonly<{ actorUserId: string; publicReference: string; operationId: string; targetStatus: "CANCELLED" | "REJECTED"; financeNote?: string }>) {
  const operationId = assertRefundOperationId(input.operationId);
  const financeNote = sanitizeRefundNote(input.financeNote);
  return withLedgerRetry(() => prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "PaymentRefund" WHERE "publicReference" = ${input.publicReference} FOR UPDATE`);
    if (rows.length !== 1) throw new RefundError("REFUND_NOT_FOUND", "Refund request was not found.");
    const refund = await tx.paymentRefund.findUnique({ where: { id: rows[0].id }, include: { payment: true, reserveLedgerJournal: { include: { entries: { select: { accountId: true, direction: true, amount: true } } } }, fundingAllocations: { include: { commissionAllocation: { select: { publicReference: true } } }, orderBy: { id: "asc" } } } });
    if (!refund) throw new RefundError("REFUND_NOT_FOUND", "Refund request was not found.");
    const replay = await tx.refundStatusHistory.findUnique({ where: { refundId_operationId: { refundId: refund.id, operationId } } });
    if (replay) {
      if (replay.toStatus === input.targetStatus && refund.status === input.targetStatus) return refund;
      throw new RefundError("REFUND_IDEMPOTENCY_CONFLICT", "Operation ID belongs to another refund transition.");
    }
    if (input.targetStatus === "CANCELLED" && refund.customerUserId !== input.actorUserId) throw new RefundError("REFUND_FORBIDDEN", "Refund request does not belong to the customer.");
    if (input.targetStatus === "REJECTED" && refund.customerUserId === input.actorUserId) throw new RefundError("REFUND_DUAL_CONTROL_REQUIRED", "Customer requester cannot reject their own refund administratively.");
    if (!((["REQUESTED", "UNDER_REVIEW"] as string[]).includes(refund.status))) throw new RefundError("REFUND_INVALID_STATE", "Refund reservation cannot be released from its current state.");
    assertRefundTransition(refund.status, input.targetStatus);
    if (refund.releaseLedgerJournalId || refund.completionLedgerJournalId) throw new RefundError("REFUND_INVALID_STATE", "Refund already has release or completion evidence.");
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Payment" WHERE "id" = ${refund.paymentId} FOR UPDATE`);
    const held = await tx.ledgerAccount.findFirst({ where: { purpose: "CUSTOMER_REFUND_HELD", category: "LIABILITY", currency: "ZAR", status: "ACTIVE", allowNegative: false, wallet: { ownerType: "CUSTOMER", ownerId: refund.customerUserId ?? undefined, status: "ACTIVE" } } });
    if (!held) throw new RefundError("REFUND_LEDGER_INCOHERENT", "Customer refund-held account is unavailable.");
    assertRefundReserveJournalEvidence({ refundAmount: refund.amount, heldAccountId: held.id, journal: refund.reserveLedgerJournal });
    const funding: RefundFundingPlanItem[] = refund.fundingAllocations.map((item) => ({ publicReference: item.publicReference, sourceType: item.sourceType, ledgerAccountId: item.ledgerAccountId, commissionAccrualId: item.commissionAccrualId, commissionAllocationId: item.commissionAllocationId, commissionAllocationReference: item.commissionAllocation?.publicReference ?? null, storeEarningId: item.storeEarningId, driverEarningId: item.driverEarningId, amount: item.amount.toFixed(2) }));
    await lockAndVerifyReleaseAccounts(tx, funding, held.id, refund.amount);
    const release = await postLedgerJournalWithinTransaction(tx, refundReleasePosting({ refundReference: refund.publicReference, paymentReference: refund.payment.publicReference, amount: refund.amount.toFixed(2), heldAccountId: held.id, funding, actorUserId: input.actorUserId }));
    const paymentProjection = await tx.payment.updateMany({ where: { id: refund.paymentId, version: refund.payment.version, totalRefundReservedAmount: { gte: refund.amount } }, data: { totalRefundReservedAmount: { decrement: refund.amount }, version: { increment: 1 } } });
    if (paymentProjection.count !== 1) throw new RefundError("REFUND_CONCURRENCY_CONFLICT", "Payment refund release lost a concurrent update.", true);
    const now = new Date();
    await releaseStoreEarningRefundReservationsWithinTransaction(tx, { refundId: refund.id, refundPublicReference: refund.publicReference, actorUserId: input.actorUserId });
    await releaseDriverEarningRefundReservationsWithinTransaction(tx, { refundId: refund.id, refundPublicReference: refund.publicReference, actorUserId: input.actorUserId });
    const updated = await tx.paymentRefund.update({ where: { id: refund.id }, data: input.targetStatus === "CANCELLED"
      ? { status: "CANCELLED", releaseLedgerJournalId: release.id, cancelledByUserId: input.actorUserId, cancelledAt: now, version: { increment: 1 } }
      : { status: "REJECTED", releaseLedgerJournalId: release.id, rejectedByUserId: input.actorUserId, rejectedAt: now, financeNote, version: { increment: 1 } }
    });
    await tx.refundStatusHistory.createMany({ data: [
      { refundId: refund.id, fromStatus: refund.status, toStatus: input.targetStatus, actorType: input.targetStatus === "CANCELLED" ? "CUSTOMER" : "FINANCE_ADMIN", actorUserId: input.actorUserId, operationId, reasonCode: input.targetStatus === "CANCELLED" ? "CUSTOMER_CANCELLED" : "FINANCE_REJECTED" },
      { refundId: refund.id, toStatus: input.targetStatus, actorType: "SYSTEM", reasonCode: "RESERVATION_RELEASED", safeMetadata: { releaseJournalReference: release.reference } },
    ] });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

async function lockAndVerifyReleaseAccounts(tx: Prisma.TransactionClient, funding: readonly RefundFundingPlanItem[], heldAccountId: string, refundAmount: Prisma.Decimal): Promise<void> {
  const accountIds = [...new Set([...funding.map((item) => item.ledgerAccountId), heldAccountId])].sort();
  const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "LedgerAccount" WHERE "id" IN (${Prisma.join(accountIds)}) ORDER BY "id" ASC FOR UPDATE`);
  if (locked.length !== accountIds.length) throw new RefundError("REFUND_LEDGER_INCOHERENT", "Refund release accounts are unavailable.");
  const held = await tx.ledgerAccount.findUnique({ where: { id: heldAccountId } });
  const sum = funding.reduce((total, item) => total.add(item.amount), new Prisma.Decimal(0));
  if (!held || held.purpose !== "CUSTOMER_REFUND_HELD" || LedgerMoney.fromDecimal(held.currentBalance).lessThan(LedgerMoney.fromDecimal(refundAmount)) || !sum.equals(refundAmount)) {
    throw new RefundError("REFUND_LEDGER_INCOHERENT", "Refund reservation evidence cannot be released exactly.");
  }
}

export function cancelRefundRequest(input: Readonly<{ actorUserId: string; publicReference: string; operationId: string }>) {
  return releaseRefundReservation({ ...input, targetStatus: "CANCELLED" });
}

export function rejectRefundRequest(input: Readonly<{ actorUserId: string; publicReference: string; operationId: string; financeNote?: string }>) {
  return releaseRefundReservation({ ...input, targetStatus: "REJECTED" });
}
