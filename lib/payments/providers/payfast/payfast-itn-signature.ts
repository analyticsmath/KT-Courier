import { createHash, timingSafeEqual } from "node:crypto";
import { PaymentError } from "@/lib/payments/errors";
import type { OrderedPayfastItnField } from "./payfast-itn-parser";
import { buildPayfastItnParameterString } from "./payfast-itn-parameter-string";

export function buildPayfastItnSignatureBase(
  orderedFields: readonly OrderedPayfastItnField[],
  passphrase: string,
): string {
  return buildPayfastItnParameterString(orderedFields, { includePassphrase: true, passphrase });
}

export function calculatePayfastItnSignature(
  orderedFields: readonly OrderedPayfastItnField[],
  passphrase: string,
): Buffer {
  return createHash("md5").update(buildPayfastItnSignatureBase(orderedFields, passphrase), "utf8").digest();
}

export function verifyPayfastItnSignature(
  orderedFields: readonly OrderedPayfastItnField[],
  suppliedSignature: string,
  passphrase: string,
): boolean {
  if (!/^[A-Fa-f0-9]{32}$/.test(suppliedSignature)) return false;
  const supplied = Buffer.from(suppliedSignature, "hex");
  let calculated: Buffer;
  try {
    calculated = calculatePayfastItnSignature(orderedFields, passphrase);
  } catch (error) {
    if (error instanceof PaymentError && error.code === "PAYFAST_ITN_FORM_INVALID") return false;
    throw error;
  }
  if (supplied.length !== 16 || calculated.length !== supplied.length) return false;
  return timingSafeEqual(calculated, supplied);
}
