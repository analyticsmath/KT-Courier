import type { PostLedgerJournalInput } from "@/lib/ledger/types";

type Common = Readonly<{ earningReference: string; amount: string; driverPublicReference: string; assignmentPublicReference: string; assignmentVersion: string; orderPublicReference: string; settlementVersion: string; completionEvidenceReference: string; actorUserId?: string }>;
const actor = (userId?: string) => userId ? { kind: "USER" as const, userId } : { kind: "SYSTEM" as const };
const metadata = (input: Common) => ({ earningReference: input.earningReference, driverReference: input.driverPublicReference, assignmentReference: input.assignmentPublicReference, assignmentVersion: input.assignmentVersion, orderReference: input.orderPublicReference, settlementVersion: input.settlementVersion, completionEvidenceReference: input.completionEvidenceReference });

export function driverEarningAccrualPosting(input: Common & Readonly<{ customerFundsHeldAccountId: string; driverPayableAccountId: string }>): PostLedgerJournalInput {
  return Object.freeze({ idempotencyKey: `driver-earning:${input.earningReference}:accrue:v1`, sourceReference: `driver-earning:${input.earningReference}:accrue`, type: "DRIVER_EARNING_ACCRUAL", currency: "ZAR", actor: actor(input.actorUserId), memo: `Driver earning accrual ${input.earningReference}`, metadata: metadata(input), entries: Object.freeze([
    { accountId: input.customerFundsHeldAccountId, direction: "DEBIT" as const, amount: input.amount, lineCode: "CUSTOMER_FUNDS_HELD" },
    { accountId: input.driverPayableAccountId, direction: "CREDIT" as const, amount: input.amount, lineCode: "DRIVER_EARNINGS_PAYABLE" },
  ]) });
}

export function driverEarningReleasePosting(input: Common & Readonly<{ driverPayableAccountId: string; ownerWithdrawableAccountId: string; releaseEligibleAt: string }>): PostLedgerJournalInput {
  return Object.freeze({ idempotencyKey: `driver-earning:${input.earningReference}:release:v1`, sourceReference: `driver-earning:${input.earningReference}:release`, type: "DRIVER_EARNING_RELEASE", currency: "ZAR", actor: actor(input.actorUserId), memo: `Driver earning release ${input.earningReference}`, metadata: { ...metadata(input), releaseEligibleAt: input.releaseEligibleAt }, entries: Object.freeze([
    { accountId: input.driverPayableAccountId, direction: "DEBIT" as const, amount: input.amount, lineCode: "DRIVER_EARNINGS_PAYABLE" },
    { accountId: input.ownerWithdrawableAccountId, direction: "CREDIT" as const, amount: input.amount, lineCode: "OWNER_WITHDRAWABLE" },
  ]) });
}

export function driverEarningReversalPosting(input: Common & Readonly<{ driverPayableAccountId: string; customerFundsHeldAccountId: string; reasonCode: string; reversalEvidenceReference: string }>): PostLedgerJournalInput {
  return Object.freeze({ idempotencyKey: `driver-earning:${input.earningReference}:reverse:v1`, sourceReference: `driver-earning:${input.earningReference}:reverse`, type: "DRIVER_EARNING_REVERSAL", currency: "ZAR", actor: actor(input.actorUserId), memo: `Driver earning reversal ${input.earningReference}`, metadata: { ...metadata(input), reasonCode: input.reasonCode, reversalEvidenceReference: input.reversalEvidenceReference }, entries: Object.freeze([
    { accountId: input.driverPayableAccountId, direction: "DEBIT" as const, amount: input.amount, lineCode: "DRIVER_EARNINGS_PAYABLE" },
    { accountId: input.customerFundsHeldAccountId, direction: "CREDIT" as const, amount: input.amount, lineCode: "CUSTOMER_FUNDS_HELD" },
  ]) });
}
