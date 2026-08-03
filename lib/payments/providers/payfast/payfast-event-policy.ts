import type { PaymentWebhookProcessingStatusCode } from "@/lib/payments/types";

export const TERMINAL_PAYFAST_EVENT_STATES = Object.freeze([
  "REJECTED",
  "APPLIED",
  "DUPLICATE",
  "IGNORED_STALE",
  "RECONCILIATION_REQUIRED",
] as const satisfies readonly PaymentWebhookProcessingStatusCode[]);

export function isTerminalPayfastEventState(status: string): boolean {
  return TERMINAL_PAYFAST_EVENT_STATES.includes(status as (typeof TERMINAL_PAYFAST_EVENT_STATES)[number]);
}

export function canRetryPayfastEvent(status: string): boolean {
  return status === "RECEIVED" || status === "TEMPORARY_FAILURE";
}
