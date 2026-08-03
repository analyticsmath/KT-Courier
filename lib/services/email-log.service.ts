import { EmailTemplateType } from "@/types/db";
import { getLegacyEmailHistory } from "@/lib/notifications/legacy-email-history";
import type { EmailLogDto } from "@/lib/dto/email-log.dto";

// ─── Create a PENDING log before sending ─────────────────────────────────────

export interface CreateEmailLogInput {
  recipient: string;
  subject: string;
  templateType: EmailTemplateType;
  relatedUserId?: string;
  relatedOrderId?: string;
}

export async function createEmailLog(_input: CreateEmailLogInput): Promise<never> {
  void _input;
  throw new Error("Legacy email logging is disabled; create a Phase 27 notification source intent instead.");
}

// ─── Mark SENT after successful provider send ─────────────────────────────────

export async function markEmailLogSent(
  _logId: string,
  _providerMessageId?: string
): Promise<never> {
  void _logId; void _providerMessageId;
  throw new Error("Legacy email logging is disabled; Phase 27 owns delivery attempts and receipts.");
}

// ─── Mark FAILED with safe error message ─────────────────────────────────────

export async function markEmailLogFailed(_logId: string, _errorMessage: string): Promise<never> {
  void _logId; void _errorMessage;
  throw new Error("Legacy email logging is disabled; Phase 27 owns delivery attempts and receipts.");
}

// ─── Get single log (admin) ───────────────────────────────────────────────────

export async function getEmailLogById(id: string): Promise<EmailLogDto | null> {
  return getLegacyEmailHistory(id);
}
