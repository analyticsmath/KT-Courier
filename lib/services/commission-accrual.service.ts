import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { commissionBasisFromOrder, validateCommissionBasisSnapshot, type CommissionBasisSnapshot } from "@/lib/commissions/commission-basis";
import { calculateCommission, hashCommissionCommand, type CommissionBeneficiarySnapshot } from "@/lib/commissions/commission-calculator";
import { commissionAccrualPosting, type ResolvedCommissionAllocationForPosting } from "@/lib/commissions/commission-ledger-policy";
import { assertCommissionProductionReady } from "@/lib/commissions/commission-production-readiness";
import { CommissionError } from "@/lib/commissions/errors";
import { postLedgerJournalWithinTransaction } from "./ledger-posting.service";
import { withLedgerRetry } from "@/lib/ledger/retry";
import { resolveActiveCommissionPlan } from "./commission-plan-query.service";

const ref = (prefix: string) => `${prefix}-${randomUUID().replaceAll("-", "").toUpperCase()}`;
const operationId = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/;

export type CommissionAccrualCommand = Readonly<{
  subjectType: "COURIER_ORDER" | "MARKETPLACE_STORE_ORDER";
  subjectId: string;
  subjectPublicReference: string;
  settlementVersion: string;
  scopeKey: string;
  authoritativeAt: string;
  basis: CommissionBasisSnapshot;
  operationId: string;
  beneficiarySnapshots?: readonly CommissionBeneficiarySnapshot[];
  actorUserId?: string;
  planPublicReference?: string;
  planVersionNumber?: number;
}>;

/** Immutable source evidence accepted by the Phase 14 transaction primitive. */
export type AuthoritativeCommissionSnapshot = Readonly<Omit<CommissionAccrualCommand, "operationId" | "actorUserId">>;
export type CommissionOperationEvidence = Readonly<{ operationId: string; actorUserId?: string }>;

function safeAccrualDto(row: Readonly<{ id: string; publicReference: string; status: string; totalAmount: Prisma.Decimal; basisAmount: Prisma.Decimal; ledgerJournal: { reference: string } | null; reversalLedgerJournal: { reference: string } | null }>) {
  return Object.freeze({ id: row.id, publicReference: row.publicReference, status: row.status, totalAmount: row.totalAmount.toFixed(2), basisAmount: row.basisAmount.toFixed(2), currency: "ZAR" as const, ledgerJournalReference: row.ledgerJournal?.reference ?? null, reversalLedgerJournalReference: row.reversalLedgerJournal?.reference ?? null });
}

function assertCommand(command: CommissionAccrualCommand): Date {
  const allowedScope = command.subjectType === "COURIER_ORDER" ? command.scopeKey === "GLOBAL:COURIER_ORDER" : command.scopeKey.startsWith("STORE:");
  if (!operationId.test(command.operationId) || !command.subjectId || !command.subjectPublicReference || !command.settlementVersion.trim() || command.settlementVersion.length > 120 || !allowedScope) {
    throw new CommissionError("COMMISSION_INVALID_COMMAND", "The internal commission command is incomplete or has an invalid operation identity.");
  }
  const authoritativeAt = new Date(command.authoritativeAt);
  if (Number.isNaN(authoritativeAt.valueOf()) || command.basis.subjectId !== command.subjectId || command.basis.subjectPublicReference !== command.subjectPublicReference || command.basis.authoritativeAt !== authoritativeAt.toISOString()) {
    throw new CommissionError("COMMISSION_INVALID_COMMAND", "The internal commission command does not match its authoritative basis snapshot.");
  }
  validateCommissionBasisSnapshot(command.basis);
  return authoritativeAt;
}

export async function resolveCommissionBasisForOrder(input: Readonly<{ orderId: string; authoritativeAt: Date }>): Promise<CommissionBasisSnapshot> {
  const order = await prisma.order.findUnique({ where: { id: input.orderId }, include: { pricingQuote: true } });
  if (!order || !order.pricingQuote) throw new CommissionError("COMMISSION_INVALID_BASIS", "The order does not have an immutable pricing quote.");
  return commissionBasisFromOrder({ order, quote: order.pricingQuote, authoritativeAt: input.authoritativeAt });
}

async function selectPlanWithinTransaction(tx: Prisma.TransactionClient, command: CommissionAccrualCommand, authoritativeAt: Date) {
  if (!command.planPublicReference && command.subjectType === "COURIER_ORDER") return resolveActiveCommissionPlan({ subjectType: "COURIER_ORDER", scopeKey: "GLOBAL:COURIER_ORDER", authoritativeAt });
  if (!command.planPublicReference) throw new CommissionError("COMMISSION_POLICY_NOT_FOUND", "Marketplace settlement evidence must identify its frozen commission plan.");
  const plan = await tx.commissionPlan.findUnique({ where: { publicReference: command.planPublicReference }, include: { rules: { orderBy: { priority: "asc" } } } });
  if (!plan || plan.status !== "ACTIVE" || plan.subjectType !== command.subjectType || plan.scopeKey !== command.scopeKey || plan.currency !== "ZAR" || plan.effectiveFrom > authoritativeAt || (plan.effectiveUntil && plan.effectiveUntil <= authoritativeAt) || (command.planVersionNumber !== undefined && plan.versionNumber !== command.planVersionNumber)) {
    throw new CommissionError("COMMISSION_POLICY_NOT_FOUND", "The selected commission policy is not active at the authoritative event time.");
  }
  return plan;
}

async function resolveAccounts(tx: Prisma.TransactionClient, components: ReturnType<typeof calculateCommission>["components"]) {
  const platform = await tx.ledgerAccount.findFirst({ where: { purpose: "PLATFORM_REVENUE", category: "REVENUE", currency: "ZAR", status: "ACTIVE", wallet: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" } } });
  const held = await tx.ledgerAccount.findFirst({ where: { purpose: "HELD", category: "LIABILITY", currency: "ZAR", status: "ACTIVE", wallet: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" } } });
  if (!platform || !held) throw new CommissionError("COMMISSION_ACCOUNT_INVALID", "Canonical platform commission accounts have not been provisioned.");
  const allocations: ResolvedCommissionAllocationForPosting[] = [];
  for (const component of components) {
    if (component.allocationType === "PLATFORM_COMMISSION_REVENUE") {
      allocations.push(Object.freeze({ ...component, ledgerAccountId: platform.id, beneficiaryOwnerId: null, beneficiaryWalletId: null }));
      continue;
    }
    const beneficiary = component.beneficiary;
    if (!beneficiary) throw new CommissionError("COMMISSION_BENEFICIARY_REQUIRED", "A beneficiary commission component requires a verified snapshot.");
    const account = await tx.ledgerAccount.findUnique({ where: { id: beneficiary.commissionPayableAccountId }, include: { wallet: true } });
    if (!account || account.walletId !== beneficiary.walletId || account.wallet.ownerType !== "PROMOTER" || account.wallet.ownerId !== beneficiary.ownerId || account.wallet.currency !== "ZAR" || account.wallet.status !== "ACTIVE" || account.purpose !== "COMMISSION_PAYABLE" || account.category !== "LIABILITY" || account.currency !== "ZAR" || account.status !== "ACTIVE") {
      throw new CommissionError("COMMISSION_BENEFICIARY_INVALID", "The beneficiary snapshot is not an active promoter commission-payable account.");
    }
    allocations.push(Object.freeze({ ...component, ledgerAccountId: account.id, beneficiaryOwnerId: beneficiary.ownerId, beneficiaryWalletId: beneficiary.walletId }));
  }
  return Object.freeze({ held, allocations: Object.freeze(allocations) });
}

export async function accrueCommissionInTransaction(tx: Prisma.TransactionClient, authoritativeCommissionSnapshot: AuthoritativeCommissionSnapshot, operationEvidence: CommissionOperationEvidence) {
  const command: CommissionAccrualCommand = { ...authoritativeCommissionSnapshot, operationId: operationEvidence.operationId, actorUserId: operationEvidence.actorUserId };
  const authoritativeAt = assertCommand(command);
  const plan = await selectPlanWithinTransaction(tx, command, authoritativeAt);
  const calculation = calculateCommission({ basis: command.basis, basisType: plan.basisType, calculationVersion: plan.calculationVersion, rules: plan.rules, beneficiaries: command.beneficiarySnapshots });
  const requestHash = hashCommissionCommand({ subjectType: command.subjectType, subjectPublicReference: command.subjectPublicReference, settlementVersion: command.settlementVersion, plan: { publicReference: plan.publicReference, versionNumber: plan.versionNumber }, basis: command.basis, authoritativeAt: command.authoritativeAt, beneficiaries: (command.beneficiarySnapshots ?? []).map(({ beneficiaryType, attributionReference, attributionVersion, ownerId, walletId, commissionPayableAccountId }) => ({ beneficiaryType, attributionReference, attributionVersion, ownerId, walletId, commissionPayableAccountId })), ruleReferences: plan.rules.map((rule) => rule.publicReference), calculationVersion: plan.calculationVersion });
  const existing = await tx.commissionAccrual.findUnique({ where: { creationIdempotencyKey: command.operationId }, include: { ledgerJournal: { select: { reference: true } }, reversalLedgerJournal: { select: { reference: true } }, allocations: { select: { id: true, publicReference: true, amount: true } } } });
  if (existing) {
    if (existing.creationRequestHash !== requestHash) throw new CommissionError("COMMISSION_IDEMPOTENCY_CONFLICT", "The operation ID is already associated with a different commission command.");
    return Object.freeze({ ...safeAccrualDto(existing), replayed: true, allocationEvidence: Object.freeze(existing.allocations.map((allocation) => Object.freeze({ id: allocation.id, publicReference: allocation.publicReference, amount: allocation.amount.toFixed(2), currency: "ZAR" as const }))) });
  }
  const duplicate = await tx.commissionAccrual.findUnique({ where: { subjectType_subjectId_settlementVersion: { subjectType: command.subjectType as never, subjectId: command.subjectId, settlementVersion: command.settlementVersion } }, select: { id: true } });
  if (duplicate) throw new CommissionError("COMMISSION_SETTLEMENT_ALREADY_ACCRUED", "The subject settlement version already has a commission accrual.");
  const accounts = await resolveAccounts(tx, calculation.components);
  const accountIds = [...new Set([accounts.held.id, ...accounts.allocations.map((allocation) => allocation.ledgerAccountId)])].sort();
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "LedgerAccount" WHERE "id" IN (${Prisma.join(accountIds)}) ORDER BY "id" ASC FOR UPDATE`);
  const freshHeld = await tx.ledgerAccount.findUnique({ where: { id: accounts.held.id }, select: { currentBalance: true } });
  if (!freshHeld || freshHeld.currentBalance.lessThan(new Prisma.Decimal(calculation.totalAmount))) throw new CommissionError("COMMISSION_ACCOUNT_INVALID", "Customer funds held are insufficient for the commission accrual.");
  const publicReference = ref("CA");
  const journal = await postLedgerJournalWithinTransaction(tx, commissionAccrualPosting({ accrualReference: publicReference, heldAccountId: accounts.held.id, allocations: accounts.allocations, actorUserId: command.actorUserId, safeMetadata: { accrualReference: publicReference, subjectReference: command.subjectPublicReference, settlementVersion: command.settlementVersion, planReference: plan.publicReference, planVersion: String(plan.versionNumber), allocationReferences: accounts.allocations.map((allocation) => allocation.rulePublicReference), calculationVersion: plan.calculationVersion } }));
  const accrual = await tx.commissionAccrual.create({ data: { publicReference, subjectType: command.subjectType as never, subjectId: command.subjectId, subjectPublicReference: command.subjectPublicReference, settlementVersion: command.settlementVersion, planId: plan.id, planVersionNumber: plan.versionNumber, basisType: plan.basisType, basisAmount: new Prisma.Decimal(calculation.basisAmount), basisSnapshot: command.basis as unknown as Prisma.InputJsonValue, authoritativeAt, currency: "ZAR", totalAmount: new Prisma.Decimal(calculation.totalAmount), status: "ACCRUED", creationIdempotencyKey: command.operationId, creationRequestHash: requestHash, calculationHash: calculation.calculationHash, calculationVersion: plan.calculationVersion, ledgerJournalId: journal.id, allocations: { create: accounts.allocations.map((allocation) => ({ publicReference: ref("CAL"), ruleId: allocation.ruleId, allocationType: allocation.allocationType, beneficiaryType: allocation.beneficiaryType, beneficiaryOwnerId: allocation.beneficiaryOwnerId, beneficiaryWalletId: allocation.beneficiaryWalletId, ledgerAccountId: allocation.ledgerAccountId, amount: new Prisma.Decimal(allocation.amount), currency: "ZAR", status: "ACCRUED", attributionReference: allocation.beneficiary?.attributionReference ?? null, attributionVersion: allocation.beneficiary?.attributionVersion ?? null })) }, statusHistory: { create: { fromStatus: null, toStatus: "ACCRUED", actorType: command.actorUserId ? "USER" : "SYSTEM", actorId: command.actorUserId ?? null, reasonCode: "ACCRUAL_POSTED", safeMetadata: { ledgerReference: journal.reference, planReference: plan.publicReference } } } }, include: { ledgerJournal: { select: { reference: true } }, reversalLedgerJournal: { select: { reference: true } }, allocations: { select: { id: true, publicReference: true, amount: true } } } });
  return Object.freeze({ ...safeAccrualDto(accrual), replayed: false, allocationEvidence: Object.freeze(accrual.allocations.map((allocation) => Object.freeze({ id: allocation.id, publicReference: allocation.publicReference, amount: allocation.amount.toFixed(2), currency: "ZAR" as const }))) });
}

export async function accrueCommission(command: CommissionAccrualCommand, options?: Readonly<{ allowTestOnlyBypass?: boolean }>) {
  assertCommissionProductionReady(options);
  const snapshot: AuthoritativeCommissionSnapshot = { subjectType: command.subjectType, subjectId: command.subjectId, subjectPublicReference: command.subjectPublicReference, settlementVersion: command.settlementVersion, scopeKey: command.scopeKey, authoritativeAt: command.authoritativeAt, basis: command.basis, beneficiarySnapshots: command.beneficiarySnapshots, planPublicReference: command.planPublicReference, planVersionNumber: command.planVersionNumber };
  const run = () => prisma.$transaction((tx) => accrueCommissionInTransaction(tx, snapshot, { operationId: command.operationId, actorUserId: command.actorUserId }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  try { return await withLedgerRetry(run); }
  catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      const existing = await prisma.commissionAccrual.findUnique({ where: { creationIdempotencyKey: command.operationId }, include: { ledgerJournal: { select: { reference: true } }, reversalLedgerJournal: { select: { reference: true } }, allocations: { select: { id: true, publicReference: true, amount: true } } } });
      if (existing) return Object.freeze({ ...safeAccrualDto(existing), replayed: true, allocationEvidence: Object.freeze(existing.allocations.map((allocation) => Object.freeze({ id: allocation.id, publicReference: allocation.publicReference, amount: allocation.amount.toFixed(2), currency: "ZAR" as const }))) });
    }
    throw error;
  }
}
