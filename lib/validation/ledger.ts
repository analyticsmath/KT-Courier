import { z } from "zod";

const positiveInteger = (maximum: number) => z.preprocess(
  (value) => typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value,
  z.number().int().min(1).max(maximum)
);

const optionalTrimmed = (maximum: number) => z.string().trim().min(1).max(maximum).optional();
const isoDateTime = z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date-time.");

export const LedgerPaginationSchema = z.object({
  page: positiveInteger(1_000_000).default(1),
  pageSize: positiveInteger(100).default(20),
}).strict();

export const LedgerAccountQuerySchema = z.object({
  page: positiveInteger(1_000_000).default(1),
  pageSize: positiveInteger(100).default(20),
  code: optionalTrimmed(80),
  ownerType: z.enum(["CUSTOMER", "STORE", "DRIVER", "PROMOTER", "PLATFORM"]).optional(),
  purpose: z.enum(["AVAILABLE", "PENDING", "HELD", "CASH_CLEARING", "SETTLEMENT_CLEARING", "PLATFORM_REVENUE", "ADJUSTMENT", "SUSPENSE", "OPENING_BALANCE_CONTROL"]).optional(),
  category: z.enum(["ASSET", "LIABILITY", "REVENUE", "EXPENSE", "EQUITY"]).optional(),
  currency: z.literal("ZAR").optional(),
  status: z.enum(["ACTIVE", "FROZEN", "CLOSED"]).optional(),
  nonZero: z.preprocess(
    (value) => value === "true" ? true : value === "false" ? false : value,
    z.boolean().optional()
  ),
}).strict();

export const LedgerJournalQuerySchema = z.object({
  page: positiveInteger(1_000_000).default(1),
  pageSize: positiveInteger(100).default(20),
  from: isoDateTime.optional(),
  to: isoDateTime.optional(),
  reference: optionalTrimmed(160),
  type: z.enum(["GENERAL", "ACCOUNT_TRANSFER", "OPENING_BALANCE", "REVERSAL"]).optional(),
  sourceReference: optionalTrimmed(160),
  accountId: optionalTrimmed(160),
  reversalState: z.enum(["ORIGINAL", "REVERSAL", "REVERSED", "UNREVERSED"]).optional(),
  correlationId: optionalTrimmed(160),
}).strict().superRefine((value, context) => {
  if (value.from && value.to && new Date(value.from) > new Date(value.to)) {
    context.addIssue({ code: "custom", path: ["to"], message: "End date must not precede start date." });
  }
});

export type LedgerAccountQuery = z.infer<typeof LedgerAccountQuerySchema>;
export type LedgerJournalQuery = z.infer<typeof LedgerJournalQuerySchema>;
export type LedgerPagination = z.infer<typeof LedgerPaginationSchema>;

export function searchParamsToObject(searchParams: URLSearchParams): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    if (values.length !== 1) result[key] = "__duplicate_parameter__";
    else result[key] = values[0];
  }
  return result;
}

