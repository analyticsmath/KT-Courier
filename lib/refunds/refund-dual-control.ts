import { RefundError } from "./errors";

export function assertRefundApprovalControl(input: Readonly<{
  customerUserId: string;
  approverUserId: string;
}>): void {
  if (input.customerUserId === input.approverUserId) {
    throw new RefundError("REFUND_DUAL_CONTROL_REQUIRED", "The refund requester cannot approve this refund.");
  }
}

export function assertRefundCompletionControl(input: Readonly<{
  customerUserId: string;
  approvedByUserId: string | null;
  completedByUserId: string;
}>): void {
  if (!input.approvedByUserId || input.customerUserId === input.completedByUserId || input.approvedByUserId === input.completedByUserId) {
    throw new RefundError("REFUND_DUAL_CONTROL_REQUIRED", "Refund approval and completion require separate authorized actors.");
  }
}

