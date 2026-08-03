import { assertWithdrawalPolicyAmount, parseWithdrawalAmount } from "./withdrawal-money-policy";
import { WithdrawalError } from "./errors";

export function assertWithdrawalPolicy(input: Readonly<{
  enabled: boolean;
  ownerType: string;
  currency: string;
  minimumAmount: string | null;
  maximumAmount: string | null;
  amount: string;
}>): void {
  if (!input.enabled) throw new WithdrawalError("WITHDRAWAL_POLICY_DISABLED", "Withdrawals are not enabled for this owner type.");
  if (input.currency !== "ZAR") throw new WithdrawalError("WITHDRAWAL_POLICY_DISABLED", "Withdrawals are only supported in ZAR.");
  assertWithdrawalPolicyAmount({ amount: parseWithdrawalAmount(input.amount), minimumAmount: input.minimumAmount, maximumAmount: input.maximumAmount });
}
