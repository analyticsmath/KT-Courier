import { z } from "zod";
import { DRIVER_EARNING_RECONCILIATION_REASONS } from "@/lib/driver-earnings/driver-earning-reconciliation-policy";
import { DRIVER_EARNING_REVERSAL_REASON_CODES } from "@/lib/driver-earnings/driver-earning-reversal-policy";

const positive = (max: number) => z.coerce.number().int().min(1).max(max);
const operationId = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/);
const status = z.enum(["ACCRUED", "RECONCILIATION_REQUIRED", "RELEASED", "FULLY_REFUNDED", "REVERSED"]);
export const DriverEarningListQuerySchema = z.object({ page: positive(1_000_000).default(1), pageSize: positive(100).default(20), status: status.optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional() }).strict();
export const FinanceDriverEarningListQuerySchema = DriverEarningListQuerySchema.extend({ driverReference: z.string().trim().min(1).max(160).optional(), assignmentReference: z.string().trim().min(1).max(160).optional(), orderReference: z.string().trim().min(1).max(160).optional(), paymentReference: z.string().trim().min(1).max(160).optional(), reconciliation: z.enum(["true", "false"]).transform((value) => value === "true").optional() }).strict();
export const DriverEarningPublicReferenceParamsSchema = z.object({ publicReference: z.string().trim().regex(/^DE-[A-F0-9]{32}$/) }).strict();
export const DriverEarningIdParamsSchema = z.object({ id: z.string().trim().regex(/^c[a-z0-9]{20,40}$/i) }).strict();
export const DriverEarningReversalSchema = z.object({ operationId, reasonCode: z.enum(DRIVER_EARNING_REVERSAL_REASON_CODES), reversalEvidenceReference: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/), safeNote: z.string().trim().min(1).max(240).optional() }).strict();
export const DriverEarningReconciliationParamsSchema = z.object({ id: z.string().trim().regex(/^DERC-[A-F0-9]{32}$/) }).strict();
export const DriverEarningReconciliationListQuerySchema = z.object({ page: positive(1_000_000).default(1), pageSize: positive(100).default(20), status: z.enum(["OPEN", "MONITORING", "RESOLVED", "CLOSED"]).optional(), reason: z.enum(DRIVER_EARNING_RECONCILIATION_REASONS).optional() }).strict();
export function driverEarningSearchParams(searchParams: URLSearchParams): Record<string, string> { const result: Record<string, string> = {}; for (const key of new Set(searchParams.keys())) { const values = searchParams.getAll(key); result[key] = values.length === 1 ? values[0]! : "__duplicate_parameter__"; } return result; }
