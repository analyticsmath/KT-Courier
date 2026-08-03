import { PaymentError } from "@/lib/payments/errors";

export type OrderedPayfastItnField = Readonly<{
  key: string;
  value: string;
  index: number;
}>;

export type ParsedPayfastItn = Readonly<{
  orderedFields: readonly OrderedPayfastItnField[];
  values: Readonly<Record<string, string>>;
}>;

export const PAYFAST_ITN_FORM_LIMITS = Object.freeze({
  maximumFields: 64,
  maximumKeyLength: 64,
  maximumValueLength: 2_048,
});

const DENIED_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const HEX_PAIR = /^[0-9a-fA-F]{2}$/;
const encoder = new TextEncoder();
const fatalDecoder = new TextDecoder("utf-8", { fatal: true });

function invalidForm(cause?: unknown): never {
  throw new PaymentError("PAYFAST_ITN_FORM_INVALID", "The Payfast ITN form is malformed.", false, cause === undefined ? undefined : { cause });
}

function decodeComponent(component: string): string {
  const bytes: number[] = [];
  try {
    for (let index = 0; index < component.length;) {
      const character = component[index];
      if (character === "%") {
        const pair = component.slice(index + 1, index + 3);
        if (pair.length !== 2 || !HEX_PAIR.test(pair)) invalidForm();
        bytes.push(Number.parseInt(pair, 16));
        index += 3;
        continue;
      }
      const point = component.codePointAt(index);
      if (point === undefined) invalidForm();
      const raw = String.fromCodePoint(point === 0x2b ? 0x20 : point);
      bytes.push(...encoder.encode(raw));
      index += raw.length;
    }
    return fatalDecoder.decode(Uint8Array.from(bytes));
  } catch (error) {
    if (error instanceof PaymentError) throw error;
    return invalidForm(error);
  }
}

export function parsePayfastItnForm(rawForm: string): ParsedPayfastItn {
  if (typeof rawForm !== "string" || rawForm.length === 0 || rawForm.includes("\0")) invalidForm();
  const pairs = rawForm.split("&");
  if (pairs.length > PAYFAST_ITN_FORM_LIMITS.maximumFields) invalidForm();

  const orderedFields: OrderedPayfastItnField[] = [];
  const mutableValues: Record<string, string> = Object.create(null) as Record<string, string>;
  const seen = new Set<string>();
  for (let index = 0; index < pairs.length; index += 1) {
    const pair = pairs[index] ?? "";
    const separator = pair.indexOf("=");
    const rawKey = separator < 0 ? pair : pair.slice(0, separator);
    const rawValue = separator < 0 ? "" : pair.slice(separator + 1);
    const key = decodeComponent(rawKey);
    const value = decodeComponent(rawValue);

    if (
      key.length === 0
      || key.length > PAYFAST_ITN_FORM_LIMITS.maximumKeyLength
      || value.length > PAYFAST_ITN_FORM_LIMITS.maximumValueLength
      || key.includes("\0")
      || value.includes("\0")
      || DENIED_KEYS.has(key.toLowerCase())
      || /[\[\].]/.test(key)
      || !/^[A-Za-z0-9_-]+$/.test(key)
      || seen.has(key)
    ) invalidForm();

    seen.add(key);
    mutableValues[key] = value;
    orderedFields.push(Object.freeze({ key, value, index }));
  }

  return Object.freeze({
    orderedFields: Object.freeze(orderedFields),
    values: Object.freeze(mutableValues),
  });
}
