import { Prisma } from "@prisma/client";
import type { CalculatedCommissionComponent } from "./commission-calculator";
import { CommissionError } from "./errors";
import type { PostLedgerJournalInput } from "@/lib/ledger/types";

const Decimal = Prisma.Decimal;

type ResolvedCommissionAllocation = CalculatedCommissionComponent & Readonly<{
  ledgerAccountId: string;
  beneficiaryOwnerId: string | null;
  beneficiaryWalletId: string | null;
}>;

function creditLines(allocations: readonly ResolvedCommissionAllocation[]) {
  const byAccount = new Map<string, Prisma.Decimal>();
  for (const allocation of allocations) {
    byAccount.set(allocation.ledgerAccountId, (byAccount.get(allocation.ledgerAccountId) ?? new Decimal(0)).add(allocation.amount));
  }
  return [...byAccount.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([accountId, amount], index) => ({ accountId, direction: "CREDIT" as const, amount: amount.toFixed(2), lineCode: `COMMISSION_CREDIT_${index + 1}` }));
}

export function commissionAccrualPosting(input: Readonly<{
  accrualReference: string;
  heldAccountId: string;
  allocations: readonly ResolvedCommissionAllocation[];
  actorUserId?: string;
  safeMetadata: Record<string, string | readonly string[]>;
}>): PostLedgerJournalInput {
  const credits = creditLines(input.allocations);
  const total = input.allocations.reduce((sum, allocation) => sum.add(allocation.amount), new Decimal(0));
  if (credits.length === 0 || total.lessThanOrEqualTo(0)) throw new CommissionError("COMMISSION_INVALID_COMMAND", "A commission accrual requires positive allocations.");
  return Object.freeze({
    idempotencyKey: `commission:${input.accrualReference}:accrue:v1`,
    sourceReference: `commission:${input.accrualReference}:accrue`,
    type: "COMMISSION_ACCRUAL",
    currency: "ZAR",
    actor: (input.actorUserId ? { kind: "USER" as const, userId: input.actorUserId } : { kind: "SYSTEM" as const }) as any,
    memo: `Commission accrual ${input.accrualReference}`,
    metadata: input.safeMetadata,
    entries: Object.freeze([{ accountId: input.heldAccountId, direction: "DEBIT" as const, amount: total.toFixed(2), lineCode: "CUSTOMER_FUNDS_HELD" }, ...credits]),
  });
}

export function commissionReversalPosting(input: Readonly<{
  accrualReference: string;
  originalJournalId: string;
  originalEntries: readonly Readonly<{ accountId: string; direction: "DEBIT" | "CREDIT"; amount: string; lineCode: string }>[];
  actorUserId?: string;
}>): PostLedgerJournalInput {
  const entries = input.originalEntries.map((entry) => Object.freeze({ accountId: entry.accountId, direction: entry.direction === "DEBIT" ? "CREDIT" as const : "DEBIT" as const, amount: entry.amount, lineCode: `REV_${entry.lineCode}` }));
  return Object.freeze({
    idempotencyKey: `commission:${input.accrualReference}:reverse:v1`,
    sourceReference: `commission:${input.accrualReference}:reverse`,
    type: "COMMISSION_REVERSAL",
    currency: "ZAR",
    reversalOfJournalId: input.originalJournalId,
    actor: (input.actorUserId ? { kind: "USER" as const, userId: input.actorUserId } : { kind: "SYSTEM" as const }) as any,
    memo: `Commission reversal ${input.accrualReference}`,
    metadata: { accrualReference: input.accrualReference },
    entries: Object.freeze(entries),
  });
}

/**
 * A bounded reversal of immutable Phase 14 allocation evidence.  This lives in
 * the commission authority so downstream domains cannot post commission
 * journals themselves.
 */
export function commissionAdjustmentReversalPosting(input: Readonly<{
  accrualReference: string;
  originalJournalId: string;
  heldAccountId: string;
  allocationAccountId: string;
  amount: string;
  operationId: string;
  actorUserId?: string;
}>): PostLedgerJournalInput {
  if (new Decimal(input.amount).lessThanOrEqualTo(0)) throw new CommissionError("COMMISSION_INVALID_COMMAND", "A commission adjustment reversal requires a positive amount.");
  return Object.freeze({
    idempotencyKey: `commission:${input.accrualReference}:adjust:${input.operationId}`,
    sourceReference: `commission:${input.accrualReference}:adjust`,
    type: "COMMISSION_REVERSAL",
    currency: "ZAR",
    reversalOfJournalId: input.originalJournalId,
    actor: (input.actorUserId ? { kind: "USER" as const, userId: input.actorUserId } : { kind: "SYSTEM" as const }) as any,
    memo: `Commission adjustment reversal ${input.accrualReference}`,
    metadata: { accrualReference: input.accrualReference, operationId: input.operationId, adjustmentAmount: input.amount },
    entries: Object.freeze([
      { accountId: input.allocationAccountId, direction: "DEBIT" as const, amount: input.amount, lineCode: "COMMISSION_ADJUSTMENT_REVERSAL" },
      { accountId: input.heldAccountId, direction: "CREDIT" as const, amount: input.amount, lineCode: "CUSTOMER_FUNDS_HELD" },
    ]),
  });
}

export type ResolvedCommissionAllocationForPosting = ResolvedCommissionAllocation;
