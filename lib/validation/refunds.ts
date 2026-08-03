import { z } from "zod";
import { REFUND_METHODS, REFUND_REASON_CODES, REFUND_STATUSES } from "@/lib/refunds/types";

const operationId = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/);
const refundReference = z.string().trim().regex(/^RF-[A-F0-9]{32}$/);
const opaqueId = z.string().trim().regex(/^c[a-z0-9]{20,40}$/i);
const exactAmount = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/);
const note = z.string().trim().min(1).max(500).optional();
const positiveInteger = (maximum: number) => z.preprocess((value) => typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value, z.number().int().min(1).max(maximum));

export const RefundCreateSchema = z.object({
  paymentPublicReference: z.string().trim().regex(/^PAY-[A-Z0-9-]{8,80}$|^[A-Za-z0-9_.:-]{8,120}$/),
  amount: exactAmount,
  method: z.enum(REFUND_METHODS),
  reasonCode: z.enum(REFUND_REASON_CODES),
  customerNote: note,
  operationId,
}).strict();

export const RefundActionSchema = z.object({ operationId }).strict();
export const RefundFinanceActionSchema = z.object({ operationId, financeNote: note }).strict();
export const RefundPublicParamsSchema = z.object({ publicReference: refundReference }).strict();
export const RefundAdminParamsSchema = z.object({ id: opaqueId }).strict();
export const RefundReconciliationParamsSchema = z.object({ id: z.string().trim().regex(/^RRC-[A-F0-9]{32}$/) }).strict();

export const RefundListQuerySchema = z.object({
  page: positiveInteger(1_000_000).default(1),
  pageSize: positiveInteger(100).default(20),
  status: z.enum(REFUND_STATUSES).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
}).strict();

export const WalletTransactionListQuerySchema = z.object({
  page: positiveInteger(1_000_000).default(1),
  pageSize: positiveInteger(100).default(20),
}).strict();

export const AdminRefundListQuerySchema = RefundListQuerySchema.extend({
  method: z.enum(REFUND_METHODS).optional(),
  reasonCode: z.enum(REFUND_REASON_CODES).optional(),
  reconciliation: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  reference: z.string().trim().min(1).max(120).optional(),
}).strict();

export const RefundReconciliationListQuerySchema = z.object({
  page: positiveInteger(1_000_000).default(1),
  pageSize: positiveInteger(100).default(20),
  status: z.enum(["OPEN", "MONITORING", "RESOLVED", "CLOSED"]).optional(),
  reason: z.enum(["UNKNOWN_PROVIDER_OUTCOME", "PROVIDER_QUERY_UNAVAILABLE", "PROVIDER_REFUND_ID_CONFLICT", "PAYMENT_REFUND_TOTAL_MISMATCH", "REFUND_LEDGER_LINK_MISSING", "REFUND_LEDGER_AMOUNT_MISMATCH", "COMMISSION_ADJUSTMENT_MISMATCH", "DOWNSTREAM_COMMISSION_RELEASE", "INSUFFICIENT_CASH_CLEARING", "UNSUPPORTED_PROVIDER_REFUND_METHOD", "APPLICATION_FAILURE_AFTER_PROVIDER_SUCCESS", "STALE_PROCESSING_ATTEMPT"]).optional(),
}).strict();

export function refundSearchParams(searchParams: URLSearchParams): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    result[key] = values.length === 1 ? values[0]! : "__duplicate_parameter__";
  }
  return result;
}
