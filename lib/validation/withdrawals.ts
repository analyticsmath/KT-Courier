import { z } from "zod";

const operationId = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/);
const publicReference = z.string().trim().regex(/^WD-[A-F0-9]{32}$/);
const attemptReference = z.string().trim().regex(/^WPA-[A-F0-9]{32}$/);
const destinationReference = z.string().trim().regex(/^PD-[A-F0-9]{32}$/);
const opaqueId = z.string().trim().regex(/^c[a-z0-9]{20,40}$/i);
const exactAmount = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/);
const positiveInteger = (maximum: number) => z.preprocess((value) => typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value, z.number().int().min(1).max(maximum));

export const WithdrawalCreateSchema = z.object({ amount: exactAmount, payoutDestinationPublicReference: destinationReference, operationId }).strict();
export const WithdrawalActionSchema = z.object({ operationId }).strict();
export const WithdrawalRejectSchema = z.object({ operationId, reasonCode: z.string().trim().regex(/^[A-Z][A-Z0-9_]{2,79}$/) }).strict();
export const WithdrawalAttemptActionSchema = z.object({ operationId, payoutAttemptPublicReference: attemptReference }).strict();
export const WithdrawalPayoutFailureSchema = WithdrawalAttemptActionSchema.extend({ failureCategory: z.enum(["OPERATOR_CONFIRMED", "EXTERNAL_SYSTEM_REJECTED", "LIQUIDITY_UNAVAILABLE", "DESTINATION_UNAVAILABLE", "EVIDENCE_REJECTED", "OTHER_SAFE_FAILURE"]), failureCode: z.string().trim().regex(/^[A-Z][A-Z0-9_]{2,79}$/), safeFailureMessage: z.string().trim().min(1).max(240).optional() }).strict();
export const WithdrawalPayoutUnknownSchema = WithdrawalAttemptActionSchema.extend({ safeEvidenceReference: z.string().trim().min(1).max(160).optional() }).strict();
export const WithdrawalCompletePayoutSchema = WithdrawalAttemptActionSchema.extend({ externalPayoutReference: z.string().trim().min(3).max(132), safeEvidenceReference: z.string().trim().min(1).max(160).optional() }).strict();
export const PayoutDestinationCreateSchema = z.object({ ownerType: z.enum(["STORE", "DRIVER", "PROMOTER"]), ownerId: opaqueId, externalReference: z.string().trim().min(3).max(132), maskedLabel: z.string().trim().min(1).max(160), institutionName: z.string().trim().min(1).max(120).optional(), accountLast4: z.string().trim().min(1).max(4).optional(), countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/).optional(), operationId }).strict();
export const PayoutDestinationActionSchema = z.object({ operationId }).strict();
export const WithdrawalPublicParamsSchema = z.object({ publicReference }).strict();
export const WithdrawalAdminParamsSchema = z.object({ id: opaqueId }).strict();
export const PayoutDestinationParamsSchema = z.object({ id: destinationReference }).strict();
export const WithdrawalReconciliationParamsSchema = z.object({ id: z.string().trim().regex(/^WRC-[A-F0-9]{32}$/) }).strict();

export const WithdrawalListQuerySchema = z.object({ page: positiveInteger(1_000_000).default(1), pageSize: positiveInteger(100).default(20), status: z.enum(["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING", "PAID", "REJECTED", "CANCELLED", "RECONCILIATION_REQUIRED"]).optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional() }).strict();
export const AdminWithdrawalListQuerySchema = WithdrawalListQuerySchema.extend({ ownerType: z.enum(["STORE", "DRIVER", "PROMOTER"]).optional(), payoutDestinationStatus: z.enum(["PENDING_REVIEW", "ACTIVE", "SUSPENDED", "REVOKED"]).optional(), reconciliation: z.enum(["true", "false"]).transform((value) => value === "true").optional(), reference: z.string().trim().min(1).max(80).optional() }).strict();
export const WithdrawalReconciliationListQuerySchema = z.object({ page: positiveInteger(1_000_000).default(1), pageSize: positiveInteger(100).default(20), status: z.enum(["OPEN", "MONITORING", "RESOLVED", "CLOSED"]).optional(), reason: z.enum(["UNKNOWN_PAYOUT_OUTCOME", "CONFLICTING_EXTERNAL_REFERENCE", "PAYOUT_EVIDENCE_INCOMPLETE", "PAID_WITHOUT_LEDGER_LINK", "LEDGER_LINK_WITHOUT_PAID_STATE", "HELD_BALANCE_MISMATCH", "STALE_PROCESSING_ATTEMPT", "DESTINATION_CHANGED", "CREDENTIAL_OR_SYSTEM_VERSION_MISMATCH", "APPLICATION_FAILURE_AFTER_EXTERNAL_PAYOUT", "DUPLICATE_PAYOUT_REFERENCE", "INSUFFICIENT_CASH_CLEARING"]).optional() }).strict();

export function withdrawalSearchParams(searchParams: URLSearchParams): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    result[key] = values.length === 1 ? values[0]! : "__duplicate_parameter__";
  }
  return result;
}
