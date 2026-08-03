import { PaymentError } from "@/lib/payments/errors";
import type { PaymentProviderEnvironment } from "@/lib/payments/types";

export const PAYFAST_VALIDATION_ENDPOINTS: Readonly<Record<PaymentProviderEnvironment, string>> = Object.freeze({
  SANDBOX: "https://sandbox.payfast.co.za/eng/query/validate",
  PRODUCTION: "https://www.payfast.co.za/eng/query/validate",
});

const RESPONSE_LIMIT_BYTES = 64;
const DEFAULT_TIMEOUT_MS = 5_000;

async function readBoundedResponse(response: Response): Promise<string> {
  if (!response.body) throw new PaymentError("PAYFAST_CONFIRMATION_INVALID", "Payfast validation response is empty.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > RESPONSE_LIMIT_BYTES) throw new PaymentError("PAYFAST_CONFIRMATION_INVALID", "Payfast validation response is too large.");
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw new PaymentError("PAYFAST_CONFIRMATION_INVALID", "Payfast validation response encoding is invalid.", false, { cause: error });
  }
}

export async function confirmPayfastItnData(input: {
  environment: PaymentProviderEnvironment;
  canonicalBody: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await (input.fetchImpl ?? fetch)(PAYFAST_VALIDATION_ENDPOINTS[input.environment], {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: input.canonicalBody,
      redirect: "error",
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
    });
    if (response.status !== 200) {
      throw new PaymentError("PAYFAST_CONFIRMATION_UNAVAILABLE", "Payfast validation endpoint is temporarily unavailable.", true);
    }
    const body = (await readBoundedResponse(response)).trim();
    if (body !== "VALID") throw new PaymentError("PAYFAST_CONFIRMATION_INVALID", "Payfast did not validate the ITN data.");
  } catch (error) {
    if (error instanceof PaymentError) throw error;
    throw new PaymentError("PAYFAST_CONFIRMATION_UNAVAILABLE", "Payfast validation endpoint is temporarily unavailable.", true, { cause: error });
  } finally {
    clearTimeout(timeout);
  }
}
