import { Prisma } from "@prisma/client";
import { RefundError } from "../../errors";

export const PAYFAST_REFUND_AMOUNT_UNIT = "UNRESOLVED" as const;
export const PAYFAST_REFUND_AMOUNT_PROTOCOL_REVIEWED = false as const;

export type PayfastRefundAmountSerializer = (amount: Prisma.Decimal) => string;

export function validateRefundAmountForProtocol(value: string): Prisma.Decimal {
  const amount = new Prisma.Decimal(value);
  if (!amount.isFinite() || amount.lessThanOrEqualTo(0) || amount.decimalPlaces() > 2) {
    throw new RefundError("REFUND_INVALID_INPUT", "Payfast refund amount must be an exact positive decimal string.");
  }
  return amount;
}

export function serializePayfastRefundAmount(value: string): never {
  validateRefundAmountForProtocol(value);
  throw new RefundError(
    "REFUND_PROVIDER_NOT_READY",
    "Payfast Refund API amount units are unresolved in repository-visible protocol material.",
  );
}

