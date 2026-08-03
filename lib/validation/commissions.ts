import { z } from "zod";

const opaqueId = z.string().trim().regex(/^c[a-z0-9]{20,40}$/i);
const operationId = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/);
const exactAmount = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/);
const positiveInteger = (maximum: number) => z.preprocess((value) => typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value, z.number().int().min(1).max(maximum));
const rule = z.object({ ruleCode: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,63}$/), allocationType: z.enum(["PLATFORM_COMMISSION_REVENUE", "BENEFICIARY_COMMISSION_PAYABLE"]), beneficiaryType: z.enum(["PLATFORM", "PROMOTER"]), calculationMethod: z.enum(["PERCENTAGE_BPS", "FIXED_AMOUNT"]), rateBasisPoints: z.number().int().min(0).max(10_000).optional(), fixedAmount: exactAmount.optional(), minimumAmount: exactAmount.optional(), maximumAmount: exactAmount.optional(), priority: z.number().int().min(0).max(10_000), isRequired: z.boolean().optional() }).strict();

export const CommissionPlanCreateSchema = z.object({ subjectType: z.literal("COURIER_ORDER"), scopeKey: z.literal("GLOBAL:COURIER_ORDER"), basisType: z.enum(["ORDER_SUBTOTAL", "ORDER_TOTAL"]), effectiveFrom: z.string().datetime(), effectiveUntil: z.string().datetime().nullable().optional(), calculationVersion: z.string().trim().min(1).max(80), rules: z.array(rule).min(1).max(30), operationId }).strict();
export const CommissionPlanUpdateSchema = CommissionPlanCreateSchema;
export const CommissionPlanActionSchema = z.object({ operationId }).strict();
export const CommissionPlanPreviewSchema = z.object({ subtotal: exactAmount, tax: exactAmount, total: exactAmount, beneficiary: z.object({ ownerId: opaqueId, walletId: opaqueId, commissionPayableAccountId: opaqueId, attributionReference: z.string().trim().min(1).max(120), attributionVersion: z.string().trim().min(1).max(80) }).strict().optional(), operationId }).strict();
export const CommissionReversalSchema = z.object({ operationId, reasonCode: z.string().trim().regex(/^[A-Z][A-Z0-9_]{2,79}$/), safeNote: z.string().trim().min(1).max(240).optional() }).strict();
export const CommissionPlanParamsSchema = z.object({ id: opaqueId }).strict();
export const CommissionAccrualParamsSchema = z.object({ id: opaqueId }).strict();
export const CommissionReconciliationParamsSchema = z.object({ id: z.string().trim().regex(/^CRC-[A-F0-9]{32}$/) }).strict();
export const CommissionPlanListQuerySchema = z.object({ page: positiveInteger(1_000_000).default(1), pageSize: positiveInteger(100).default(20), status: z.enum(["DRAFT", "UNDER_REVIEW", "APPROVED", "ACTIVE", "RETIRED", "REJECTED"]).optional() }).strict();
export const CommissionListQuerySchema = z.object({ page: positiveInteger(1_000_000).default(1), pageSize: positiveInteger(100).default(20), status: z.enum(["ACCRUED", "REVERSED", "RECONCILIATION_REQUIRED"]).optional(), subjectReference: z.string().trim().min(1).max(100).optional(), plan: z.string().trim().regex(/^CP-[A-F0-9]{32}$/).optional(), beneficiaryType: z.enum(["PLATFORM", "PROMOTER"]).optional(), allocationType: z.enum(["PLATFORM_COMMISSION_REVENUE", "BENEFICIARY_COMMISSION_PAYABLE"]).optional(), reconciliation: z.enum(["true", "false"]).transform((value) => value === "true").optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional(), minAmount: exactAmount.optional(), maxAmount: exactAmount.optional() }).strict();
export const CommissionReconciliationListQuerySchema = z.object({ page: positiveInteger(1_000_000).default(1), pageSize: positiveInteger(100).default(20), status: z.enum(["OPEN", "MONITORING", "RESOLVED", "CLOSED"]).optional(), reason: z.enum(["POLICY_OVERLAP", "POLICY_NOT_FOUND", "CALCULATION_MISMATCH", "BASIS_MISMATCH", "TOTAL_EXCEEDS_BASIS", "DUPLICATE_ACCRUAL", "LEDGER_LINK_MISSING", "LEDGER_AMOUNT_MISMATCH", "BENEFICIARY_ACCOUNT_MISMATCH", "DOWNSTREAM_RELEASE_EXISTS", "REVERSAL_BLOCKED", "STALE_ACCRUAL", "APPLICATION_FAILURE"]).optional() }).strict();

export function commissionSearchParams(searchParams: URLSearchParams): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    result[key] = values.length === 1 ? values[0]! : "__duplicate_parameter__";
  }
  return result;
}
