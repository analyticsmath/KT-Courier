import { WithdrawalError } from "./errors";

export function assertWithdrawalDualControl(input: Readonly<{
  requestedByUserId: string;
  approvedByUserId: string | null;
  processingUserId: string;
  requiresDualControl: boolean;
}>): void {
  if (input.processingUserId === input.requestedByUserId) {
    throw new WithdrawalError("WITHDRAWAL_DUAL_CONTROL_REQUIRED", "The requester cannot process their own withdrawal.");
  }
  if (input.requiresDualControl && (!input.approvedByUserId || input.processingUserId === input.approvedByUserId)) {
    throw new WithdrawalError("WITHDRAWAL_DUAL_CONTROL_REQUIRED", "A different finance operator must complete an approved withdrawal.");
  }
}
