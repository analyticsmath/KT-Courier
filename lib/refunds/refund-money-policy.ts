import { LedgerMoney } from "@/lib/ledger/money";
import { RefundError } from "./errors";

export function parseRefundAmount(value: string): LedgerMoney {
  try {
    return LedgerMoney.parse(value);
  } catch (error) {
    throw new RefundError("REFUND_INVALID_INPUT", "Refund amount must be an exact positive ZAR decimal string.", false, { cause: error });
  }
}

