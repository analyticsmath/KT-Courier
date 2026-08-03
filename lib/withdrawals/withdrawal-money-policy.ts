import { LedgerMoney } from "@/lib/ledger/money";
import { WithdrawalError } from "./errors";

export function parseWithdrawalAmount(value: string): LedgerMoney {
  try {
    return LedgerMoney.parse(value);
  } catch (error) {
    throw new WithdrawalError("WITHDRAWAL_INVALID_INPUT", error instanceof Error ? error.message : "Withdrawal amount is invalid.");
  }
}

export function assertWithdrawalPolicyAmount(input: Readonly<{
  amount: LedgerMoney;
  minimumAmount: string | null;
  maximumAmount: string | null;
}>): void {
  if (input.minimumAmount && input.amount.lessThan(parseWithdrawalAmount(input.minimumAmount))) {
    throw new WithdrawalError("WITHDRAWAL_POLICY_LIMIT", "Withdrawal amount is below the policy minimum.");
  }
  if (input.maximumAmount && input.amount.greaterThan(parseWithdrawalAmount(input.maximumAmount))) {
    throw new WithdrawalError("WITHDRAWAL_POLICY_LIMIT", "Withdrawal amount exceeds the policy maximum.");
  }
}
