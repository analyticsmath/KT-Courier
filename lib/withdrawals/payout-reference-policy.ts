import { WithdrawalError } from "./errors";

const destinationReference = /^manual-finance:[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/;
const payoutReference = /^manual-bank:[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/;
const rawNumberRun = /\d{6,}/;

function assertOpaqueReference(value: string, expression: RegExp, message: string): string {
  const normalized = value.trim();
  if (!expression.test(normalized) || rawNumberRun.test(normalized)) {
    throw new WithdrawalError("WITHDRAWAL_DESTINATION_INVALID", message);
  }
  return normalized;
}

export function assertPayoutDestinationExternalReference(value: string): string {
  return assertOpaqueReference(value, destinationReference, "Payout destination reference must be a safe opaque manual-finance reference.");
}

export function assertExternalPayoutReference(value: string): string {
  return assertOpaqueReference(value, payoutReference, "External payout reference must be a safe opaque manual-bank reference.");
}

export function assertMaskedDestinationMetadata(input: Readonly<{ maskedLabel: string; accountLast4?: string | null }>): void {
  if (!input.maskedLabel.trim() || input.maskedLabel.length > 160 || rawNumberRun.test(input.maskedLabel)) {
    throw new WithdrawalError("WITHDRAWAL_DESTINATION_INVALID", "Payout destination label must be masked and bounded.");
  }
  if (input.accountLast4 && !/^[A-Za-z0-9]{1,4}$/.test(input.accountLast4)) {
    throw new WithdrawalError("WITHDRAWAL_DESTINATION_INVALID", "Payout destination last-four metadata is invalid.");
  }
}
