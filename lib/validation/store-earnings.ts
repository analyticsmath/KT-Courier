import { z } from "zod";
import { STORE_EARNING_RECONCILIATION_REASONS } from "@/lib/store-earnings/store-earning-reconciliation-policy";
import { STORE_EARNING_REVERSAL_REASON_CODES } from "@/lib/store-earnings/store-earning-reversal-policy";

const positiveInteger = (maximum: number) => z.coerce.number().int().min(1).max(maximum);
const operationId = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/);
const earningStatus = z.enum(["ACCRUED", "RELEASED", "FULLY_REFUNDED", "REVERSED", "RECONCILIATION_REQUIRED"]);

export const StoreEarningListQuerySchema = z.object({ page: positiveInteger(1_000_000).default(1), pageSize: positiveInteger(100).default(20), status: earningStatus.optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional() }).strict();
export const FinanceStoreEarningListQuerySchema = StoreEarningListQuerySchema.extend({ storeReference: z.string().trim().min(1).max(160).optional(), subjectReference: z.string().trim().min(1).max(160).optional(), paymentReference: z.string().trim().min(1).max(160).optional(), reconciliation: z.enum(["true", "false"]).transform((value) => value === "true").optional() }).strict();
export const StoreEarningPublicReferenceParamsSchema = z.object({ publicReference: z.string().trim().regex(/^SE-[A-F0-9]{32}$/) }).strict();
export const StoreEarningIdParamsSchema = z.object({ id: z.string().trim().regex(/^c[a-z0-9]{20,40}$/i) }).strict();
export const StoreEarningReversalSchema = z.object({ operationId, reasonCode: z.enum(STORE_EARNING_REVERSAL_REASON_CODES), safeNote: z.string().trim().min(1).max(240).optional() }).strict();
export const StoreEarningReconciliationParamsSchema = z.object({ id: z.string().trim().regex(/^SERC-[A-F0-9]{32}$/) }).strict();
export const StoreEarningReconciliationListQuerySchema = z.object({ page: positiveInteger(1_000_000).default(1), pageSize: positiveInteger(100).default(20), status: z.enum(["OPEN", "MONITORING", "RESOLVED", "CLOSED"]).optional(), reason: z.enum(STORE_EARNING_RECONCILIATION_REASONS).optional() }).strict();

export function storeEarningSearchParams(searchParams: URLSearchParams): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    result[key] = values.length === 1 ? values[0]! : "__duplicate_parameter__";
  }
  return result;
}
