import type { Prisma } from "@prisma/client";
import { PaymentError } from "@/lib/payments/errors";
import { LedgerMoney } from "@/lib/ledger/money";

export function parsePayfastItnAmount(value: string): LedgerMoney {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) {
    throw new PaymentError("PAYFAST_AMOUNT_MISMATCH", "Payfast sent an invalid gross amount.");
  }
  try {
    return LedgerMoney.parse(value);
  } catch (error) {
    throw new PaymentError("PAYFAST_AMOUNT_MISMATCH", "Payfast sent an invalid gross amount.", false, { cause: error });
  }
}

export function verifyPayfastItnAmount(
  amountGross: string,
  expected: Prisma.Decimal,
  currency: string,
): void {
  if (currency !== "ZAR") throw new PaymentError("PAYFAST_AMOUNT_MISMATCH", "Payfast confirmation requires ZAR.");
  const received = parsePayfastItnAmount(amountGross);
  if (!received.equals(LedgerMoney.fromDecimal(expected))) {
    throw new PaymentError("PAYFAST_AMOUNT_MISMATCH", "Payfast gross amount does not match the authoritative payment amount.");
  }
}
