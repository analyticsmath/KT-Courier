import { createHash } from "node:crypto";
import type { RefundMethodCode, RefundReasonCodeValue } from "./types";

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

export function refundCreationHash(input: Readonly<{
  paymentId: string;
  customerUserId: string;
  amount: string;
  method: RefundMethodCode;
  reasonCode: RefundReasonCodeValue;
  customerNote: string | null;
  policyVersion: number;
  sourceAdjustmentReference?: string;
}>): string {
  return digest({
    amount: input.amount,
    customerNote: input.customerNote,
    customerUserId: input.customerUserId,
    method: input.method,
    paymentId: input.paymentId,
    policyVersion: input.policyVersion,
    reasonCode: input.reasonCode,
    ...(input.sourceAdjustmentReference ? { sourceAdjustmentReference: input.sourceAdjustmentReference } : {}),
  });
}

export function refundAttemptHash(input: Readonly<{
  refundId: string;
  actorUserId: string;
  provider: string;
  providerPaymentId: string;
}>): string {
  return digest({ actorUserId: input.actorUserId, provider: input.provider, providerPaymentId: input.providerPaymentId, refundId: input.refundId });
}

