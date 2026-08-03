import { PaymentError } from "../../errors";

export const PAYFAST_V1_FIELD_ORDER = Object.freeze([
  "merchant_id",
  "merchant_key",
  "return_url",
  "cancel_url",
  "notify_url",
  "name_first",
  "name_last",
  "email_address",
  "m_payment_id",
  "amount",
  "item_name",
  "item_description",
] as const);

export type PayfastUnsignedFieldName = (typeof PAYFAST_V1_FIELD_ORDER)[number];
export type PayfastUnsignedFields = Readonly<{
  merchant_id: string;
  merchant_key: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  name_first?: string;
  name_last?: string;
  email_address: string;
  m_payment_id: string;
  amount: string;
  item_name: string;
  item_description?: string;
}>;

export type PayfastCheckoutFields = Readonly<PayfastUnsignedFields & { signature: string }>;

const FIELD_LIMITS: Readonly<Record<PayfastUnsignedFieldName, number>> = Object.freeze({
  merchant_id: 100,
  merchant_key: 100,
  return_url: 2_048,
  cancel_url: 2_048,
  notify_url: 2_048,
  name_first: 100,
  name_last: 100,
  email_address: 254,
  m_payment_id: 100,
  amount: 22,
  item_name: 100,
  item_description: 255,
});

const REQUIRED = new Set<PayfastUnsignedFieldName>([
  "merchant_id", "merchant_key", "return_url", "cancel_url", "notify_url",
  "email_address", "m_payment_id", "amount", "item_name",
]);

function normalizeText(name: PayfastUnsignedFieldName, value: unknown): string | undefined {
  if (value === undefined) {
    if (REQUIRED.has(name)) throw new PaymentError("PAYFAST_FIELD_INVALID", "A required Payfast checkout field is missing.");
    return undefined;
  }
  if (typeof value !== "string" || /[\r\n\0]/.test(value)) {
    throw new PaymentError("PAYFAST_FIELD_INVALID", "A Payfast checkout field is invalid.");
  }
  const normalized = value.normalize("NFC").trim();
  if (!normalized) {
    if (REQUIRED.has(name)) throw new PaymentError("PAYFAST_FIELD_INVALID", "A required Payfast checkout field is empty.");
    return undefined;
  }
  if (normalized.length > FIELD_LIMITS[name]) {
    throw new PaymentError("PAYFAST_FIELD_TOO_LONG", "A Payfast checkout field exceeds its supported length.");
  }
  return normalized;
}

export function normalizePayfastUnsignedFields(input: PayfastUnsignedFields): PayfastUnsignedFields {
  const inputKeys = Object.keys(input);
  if (inputKeys.some((key) => !(PAYFAST_V1_FIELD_ORDER as readonly string[]).includes(key))) {
    throw new PaymentError("PAYFAST_FIELD_INVALID", "Unsupported Payfast checkout fields are not permitted.");
  }
  const output: Partial<Record<PayfastUnsignedFieldName, string>> = {};
  for (const name of PAYFAST_V1_FIELD_ORDER) {
    const value = normalizeText(name, input[name]);
    if (value !== undefined) output[name] = value;
  }
  if (!/^\d+\.\d{2}$/.test(output.amount ?? "") || output.amount === "0.00") {
    throw new PaymentError("PAYFAST_FIELD_INVALID", "Payfast amount must be a positive canonical two-decimal value.");
  }
  if (!/^[A-Za-z0-9_.:-]{1,100}$/.test(output.m_payment_id ?? "")) {
    throw new PaymentError("PAYFAST_MERCHANT_REFERENCE_INVALID", "Payfast merchant payment reference is invalid.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(output.email_address ?? "")) {
    throw new PaymentError("PAYFAST_PAYER_EMAIL_REQUIRED", "A valid payer email is required for Payfast checkout.");
  }
  return Object.freeze(output as PayfastUnsignedFields);
}
