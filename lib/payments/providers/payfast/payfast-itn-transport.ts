import { PaymentError } from "@/lib/payments/errors";

export const PAYFAST_ITN_BODY_LIMIT_BYTES = 32 * 1024;
export const PAYFAST_ITN_BODY_TIMEOUT_MS = 5_000;

export type BoundedPayfastItnBody = Readonly<{
  bytes: Uint8Array;
  text: string;
}>;

export function assertPayfastItnContentType(value: string | null): void {
  if (!value) throw new PaymentError("PAYFAST_ITN_TRANSPORT_INVALID", "Payfast ITN content type is required.");
  const segments = value.split(";").map((part) => part.trim());
  if (segments.shift()?.toLowerCase() !== "application/x-www-form-urlencoded") {
    throw new PaymentError("PAYFAST_ITN_TRANSPORT_INVALID", "Payfast ITN content type is invalid.");
  }
  if (segments.length > 1) throw new PaymentError("PAYFAST_ITN_TRANSPORT_INVALID", "Payfast ITN charset is invalid.");
  if (segments.length === 1) {
    const match = /^charset\s*=\s*(?:"utf-8"|utf-8)$/i.exec(segments[0] ?? "");
    if (!match) throw new PaymentError("PAYFAST_ITN_TRANSPORT_INVALID", "Payfast ITN charset is invalid.");
  }
}

function declaredLength(request: Request): number | null {
  const value = request.headers.get("content-length");
  if (value === null) return null;
  if (!/^(?:0|[1-9]\d*)$/.test(value)) throw new PaymentError("PAYFAST_ITN_TRANSPORT_INVALID", "Payfast ITN content length is invalid.");
  const length = Number(value);
  if (!Number.isSafeInteger(length) || length <= 0) throw new PaymentError("PAYFAST_ITN_TRANSPORT_INVALID", "Payfast ITN content length is invalid.");
  if (length > PAYFAST_ITN_BODY_LIMIT_BYTES) throw new PaymentError("PAYFAST_ITN_BODY_TOO_LARGE", "Payfast ITN request is too large.");
  return length;
}

export async function readBoundedPayfastItnBody(
  request: Request,
  options: { timeoutMs?: number; maximumBytes?: number } = {},
): Promise<BoundedPayfastItnBody> {
  assertPayfastItnContentType(request.headers.get("content-type"));
  const maximumBytes = options.maximumBytes ?? PAYFAST_ITN_BODY_LIMIT_BYTES;
  const expectedLength = declaredLength(request);
  if (expectedLength !== null && expectedLength > maximumBytes) {
    throw new PaymentError("PAYFAST_ITN_BODY_TOO_LARGE", "Payfast ITN request is too large.");
  }
  if (!request.body) throw new PaymentError("PAYFAST_ITN_TRANSPORT_INVALID", "Payfast ITN body is required.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    while (true) {
      const read = reader.read();
      const result = await Promise.race([
        read,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new PaymentError("PAYFAST_ITN_BODY_TIMEOUT", "Payfast ITN body read timed out.", true)), options.timeoutMs ?? PAYFAST_ITN_BODY_TIMEOUT_MS);
        }),
      ]);
      if (timer) clearTimeout(timer);
      timer = undefined;
      if (result.done) break;
      total += result.value.byteLength;
      if (total > maximumBytes) throw new PaymentError("PAYFAST_ITN_BODY_TOO_LARGE", "Payfast ITN request is too large.");
      chunks.push(result.value);
    }
  } finally {
    if (timer) clearTimeout(timer);
    reader.releaseLock();
  }
  if (total === 0 || (expectedLength !== null && total !== expectedLength)) {
    throw new PaymentError("PAYFAST_ITN_TRANSPORT_INVALID", "Payfast ITN body length is invalid.");
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return Object.freeze({ bytes, text });
  } catch (error) {
    throw new PaymentError("PAYFAST_ITN_FORM_INVALID", "Payfast ITN body is not valid UTF-8.", false, { cause: error });
  }
}
