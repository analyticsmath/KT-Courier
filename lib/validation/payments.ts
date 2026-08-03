import { z } from "zod";
import { PAYMENT_ATTEMPT_STATES, PAYMENT_STATES } from "@/lib/payments/types";

const boundedKey = z.string().trim().min(8).max(128).regex(/^[a-zA-Z0-9_.:-]+$/);
const boundedId = z.string().trim().min(1).max(160);
const paymentPublicReference = z.string().regex(/^pay_[a-zA-Z0-9_-]{12,80}$/);
const attemptPublicReference = z.string().regex(/^pat_[a-zA-Z0-9_-]{16,96}$/);
const operationId = z.string().uuid();
const positiveInteger = (maximum: number) => z.preprocess(
  (value) => typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value,
  z.number().int().min(1).max(maximum),
);
const optionalText = (maximum: number) => z.string().trim().min(1).max(maximum).optional();
const moneyString = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/).max(22);
const isoDateTime = z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date-time.");
const cents = (value: string) => {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
};

export const PrepareOrderPaymentSchema = z.object({
  orderId: boundedId,
  idempotencyKey: boundedKey,
}).strict();

export const CreateProviderSessionSchema = z.object({
  paymentId: boundedId,
  provider: z.literal("PAYFAST"),
  idempotencyKey: boundedKey,
}).strict();

export const PaymentOperationSchema = z.object({ operationId }).strict();
export const OrderPaymentParamsSchema = z.object({ orderId: boundedId }).strict();
export const CustomerPaymentParamsSchema = z.object({ publicReference: paymentPublicReference }).strict();
export const PayfastCheckoutParamsSchema = z.object({ attemptReference: attemptPublicReference }).strict();
export const CustomerPaymentPageParamsSchema = z.object({ orderReference: z.string().trim().min(1).max(80) }).strict();

export const PaymentListQuerySchema = z.object({
  page: positiveInteger(1_000_000).default(1),
  pageSize: positiveInteger(100).default(20),
  publicReference: optionalText(160),
  orderReference: optionalText(160),
  payer: optionalText(160),
  status: z.enum(PAYMENT_STATES).optional(),
  provider: z.literal("PAYFAST").optional(),
  from: isoDateTime.optional(),
  to: isoDateTime.optional(),
  minimumAmount: moneyString.optional(),
  maximumAmount: moneyString.optional(),
}).strict().superRefine((value, context) => {
  if (value.from && value.to && new Date(value.from) > new Date(value.to)) {
    context.addIssue({ code: "custom", path: ["to"], message: "End date must not precede start date." });
  }
  if (value.minimumAmount && value.maximumAmount) {
    if (cents(value.minimumAmount) > cents(value.maximumAmount)) context.addIssue({ code: "custom", path: ["maximumAmount"], message: "Maximum amount must not be less than minimum amount." });
  }
});

export const PaymentDetailParamsSchema = z.object({ id: boundedId }).strict();

export type PrepareOrderPaymentInput = z.infer<typeof PrepareOrderPaymentSchema>;
export type CreateProviderSessionInput = z.infer<typeof CreateProviderSessionSchema>;
export type PaymentOperationInput = z.infer<typeof PaymentOperationSchema>;
export type PaymentListQuery = z.infer<typeof PaymentListQuerySchema>;

export const PAYMENT_QUERY_ATTEMPT_STATES = PAYMENT_ATTEMPT_STATES;

export function paymentSearchParamsToObject(searchParams: URLSearchParams): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    result[key] = values.length === 1 ? values[0] : "__duplicate_parameter__";
  }
  return result;
}
