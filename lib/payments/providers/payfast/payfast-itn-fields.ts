import { PaymentError } from "@/lib/payments/errors";
import { createHash } from "node:crypto";
import type { ParsedPayfastItn } from "./payfast-itn-parser";

export const PAYFAST_REQUIRED_ITN_FIELDS = Object.freeze([
  "m_payment_id",
  "pf_payment_id",
  "payment_status",
  "amount_gross",
  "merchant_id",
  "signature",
] as const);

const KNOWN_OPTIONAL_FIELDS = new Set([
  "amount_fee", "amount_net", "item_name", "item_description",
  "name_first", "name_last", "email_address",
  "custom_str1", "custom_str2", "custom_str3", "custom_str4", "custom_str5",
  "custom_int1", "custom_int2", "custom_int3", "custom_int4", "custom_int5",
  "token",
]);
const KNOWN_FIELDS = new Set<string>([...PAYFAST_REQUIRED_ITN_FIELDS, ...KNOWN_OPTIONAL_FIELDS]);

export type ValidatedPayfastItnFields = Readonly<{
  merchantReference: string;
  providerPaymentId: string;
  providerStatus: string;
  amountGross: string;
  merchantId: string;
  signature: string;
  amountFee: string | null;
  amountNet: string | null;
  recurringTokenFingerprint: string | null;
  itemReference: string | null;
  unknownFieldCount: number;
  safePayloadSnapshot: Readonly<Record<string, string | number | null>>;
}>;

function fail(): never {
  throw new PaymentError("PAYFAST_ITN_FIELDS_INVALID", "Required Payfast ITN fields are invalid.");
}

function bounded(value: string, minimum: number, maximum: number): boolean {
  return value.length >= minimum && value.length <= maximum && !/[\r\n\0]/.test(value);
}

function optionalExactAmount(value: string | undefined): string | null {
  if (!value) return null;
  if (value.length > 18 || !/^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) fail();
  return value;
}

export function validatePayfastItnFields(parsed: ParsedPayfastItn): ValidatedPayfastItnFields {
  for (const field of PAYFAST_REQUIRED_ITN_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(parsed.values, field) || parsed.values[field] === "") fail();
  }
  const merchantReference = parsed.values.m_payment_id!;
  const providerPaymentId = parsed.values.pf_payment_id!;
  const providerStatus = parsed.values.payment_status!;
  const amountGross = parsed.values.amount_gross!;
  const merchantId = parsed.values.merchant_id!;
  const signature = parsed.values.signature!;

  if (
    !bounded(merchantReference, 12, 100)
    // Recurring subscriptions bind PayFast's merchant reference to their
    // immutable invoice. Phase 12 still resolves the same PaymentAttempt;
    // it merely uses a second, explicit reference grammar.
    || !/^(?:kt:payment:pay_[A-Za-z0-9_-]+:attempt:[1-9]\d*|subinv_[A-Za-z0-9_-]{8,96})$/.test(merchantReference)
    || !bounded(providerPaymentId, 1, 128)
    || !/^[A-Za-z0-9_-]+$/.test(providerPaymentId)
    || !bounded(providerStatus, 1, 64)
    || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(providerStatus)
    || !bounded(merchantId, 1, 100)
    || !/^[A-Za-z0-9_-]+$/.test(merchantId)
    || !/^[A-Fa-f0-9]{32}$/.test(signature)
  ) fail();

  const amountFee = optionalExactAmount(parsed.values.amount_fee);
  const amountNet = optionalExactAmount(parsed.values.amount_net);
  const rawRecurringToken = parsed.values.token;
  const recurringTokenFingerprint = rawRecurringToken && /^[A-Za-z0-9_.:-]{8,512}$/.test(rawRecurringToken)
    ? createHash("sha256").update(rawRecurringToken, "utf8").digest("hex")
    : rawRecurringToken ? fail() : null;
  const itemReference = parsed.values.item_name && bounded(parsed.values.item_name, 1, 100)
    ? parsed.values.item_name
    : null;
  const unknownFieldCount = parsed.orderedFields.filter((field) => !KNOWN_FIELDS.has(field.key)).length;
  const safePayloadSnapshot = Object.freeze({
    merchantReference,
    providerPaymentId,
    providerStatus,
    amountGross,
    amountFee,
    amountNet,
    recurringTokenFingerprint,
    itemReference,
    fieldCount: parsed.orderedFields.length,
    unknownFieldCount,
    protocolVersion: "payfast-itn-v1",
  });

  return Object.freeze({
    merchantReference,
    providerPaymentId,
    providerStatus,
    amountGross,
    merchantId,
    signature,
    amountFee,
    amountNet,
    recurringTokenFingerprint,
    itemReference,
    unknownFieldCount,
    safePayloadSnapshot,
  });
}
