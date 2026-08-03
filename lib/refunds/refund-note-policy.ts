import { RefundError } from "./errors";

const SENSITIVE_FINANCIAL_PATTERN = /\b(?:account\s*(?:number|no)|branch\s*code|routing\s*number|cvv|cvc|pin|card\s*number|iban|swift)\b|\b(?:\d[ -]?){13,19}\b/i;

export function sanitizeRefundNote(value: string | null | undefined, maximum = 500): string | null {
  if (value === undefined || value === null || value.trim() === "") return null;
  const note = value.trim();
  if (note.length > maximum || /[\0]/.test(note) || SENSITIVE_FINANCIAL_PATTERN.test(note)) {
    throw new RefundError("REFUND_INVALID_INPUT", "Refund note is invalid or contains prohibited financial information.");
  }
  return note.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ");
}

export function assertRefundOperationId(value: string): string {
  const operationId = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/.test(operationId)) {
    throw new RefundError("REFUND_INVALID_INPUT", "A valid operation ID is required.");
  }
  return operationId;
}
