import type { EmailSendResult, SendEmailInput } from "./email.types";
import { queueLegacyEmailIntent } from "@/lib/notifications/security-delivery";

/**
 * Compatibility boundary for pre-Phase-27 callers. It has no provider, no
 * renderer and no delivery side effect: it appends a canonical Phase 27 intent.
 * New business code must use the notification authority directly.
 */
export async function sendTransactionalEmail(input: SendEmailInput): Promise<EmailSendResult> {
  try {
    const result = await queueLegacyEmailIntent({ templateType: input.templateType, to: input.to, relatedUserId: input.relatedUserId, relatedOrderId: input.relatedOrderId, context: input.context });
    return { ok: true, logId: result.intent.publicReference };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? "Notification delivery intent could not be queued." : "Notification delivery intent could not be queued." };
  }
}

/** Legacy callers can only observe the canonical fail-closed adapter. */
export function getEmailProviderName(): string { return "PHASE27_NOTIFICATION_AUTHORITY"; }
