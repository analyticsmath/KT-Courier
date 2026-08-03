import { z } from "zod";

const positiveInteger = (maximum: number) => z.preprocess(
  (value) => typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value,
  z.number().int().min(1).max(maximum),
);
const optionalText = (maximum: number) => z.string().trim().min(1).max(maximum).optional();
const isoDateTime = z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date-time.");
const eventReference = z.string().regex(/^pwe_[A-Za-z0-9_-]{16,96}$/);
const caseReference = z.string().regex(/^prc_[A-Za-z0-9_-]{16,96}$/);

export const PaymentWebhookListQuerySchema = z.object({
  page: positiveInteger(1_000_000).default(1),
  pageSize: positiveInteger(100).default(20),
  provider: z.literal("PAYFAST").optional(),
  environment: z.enum(["SANDBOX", "PRODUCTION"]).optional(),
  processingStatus: z.enum(["RECEIVED", "REJECTED", "VERIFIED", "APPLIED", "DUPLICATE", "IGNORED_STALE", "RECONCILIATION_REQUIRED", "TEMPORARY_FAILURE"]).optional(),
  normalizedStatus: z.enum(["COMPLETE", "PENDING", "FAILED", "UNKNOWN"]).optional(),
  paymentReference: optionalText(100),
  attemptReference: optionalText(100),
  reconciliationRequired: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  from: isoDateTime.optional(),
  to: isoDateTime.optional(),
}).strict().superRefine((value, context) => {
  if (value.from && value.to && new Date(value.from) > new Date(value.to)) context.addIssue({ code: "custom", path: ["to"], message: "End date must not precede start date." });
});

export const PaymentReconciliationListQuerySchema = z.object({
  page: positiveInteger(1_000_000).default(1),
  pageSize: positiveInteger(100).default(20),
  provider: z.literal("PAYFAST").optional(),
  status: z.enum(["OPEN", "MONITORING", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  reason: z.enum([
    "UNKNOWN_OUTCOME", "CREDENTIAL_VERSION_MISMATCH", "PROVIDER_CONFIRMATION_UNAVAILABLE",
    "CONFLICTING_PROVIDER_STATUS", "OUT_OF_ORDER_EVENT", "AMOUNT_MISMATCH", "MERCHANT_MISMATCH",
    "PROVIDER_REFERENCE_CONFLICT", "UNRECOGNIZED_PROVIDER_STATUS", "APPLICATION_FAILURE_AFTER_VERIFICATION",
    "STALE_PROCESSING_ATTEMPT",
  ]).optional(),
  paymentReference: optionalText(100),
  attemptReference: optionalText(100),
  eventReference: optionalText(100),
  from: isoDateTime.optional(),
  to: isoDateTime.optional(),
}).strict().superRefine((value, context) => {
  if (value.from && value.to && new Date(value.from) > new Date(value.to)) context.addIssue({ code: "custom", path: ["to"], message: "End date must not precede start date." });
});

export const PaymentWebhookDetailParamsSchema = z.object({ id: eventReference }).strict();
export const PaymentReconciliationDetailParamsSchema = z.object({ id: caseReference }).strict();
export type PaymentWebhookListQuery = z.infer<typeof PaymentWebhookListQuerySchema>;
export type PaymentReconciliationListQuery = z.infer<typeof PaymentReconciliationListQuerySchema>;

export function confirmationSearchParamsToObject(searchParams: URLSearchParams): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    result[key] = values.length === 1 ? values[0]! : "__duplicate_parameter__";
  }
  return result;
}
