import type { EmailLog } from "@/types/db";
import type { EmailTemplateType, EmailStatus } from "@/types/db";

// ─── DTO ──────────────────────────────────────────────────────────────────────

export interface EmailLogDto {
  id: string;
  recipient: string;
  subject: string;
  templateType: EmailTemplateType;
  status: EmailStatus;
  providerMessageId: string | null;
  errorMessage: string | null;
  sentAt: Date | null;
  createdAt: Date;
  relatedUserId: string | null;
  relatedOrderId: string | null;
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

export function toEmailLogDto(log: EmailLog): EmailLogDto {
  return {
    id: log.id,
    recipient: log.recipient,
    subject: log.subject,
    templateType: log.templateType,
    status: log.status,
    providerMessageId: log.providerMessageId,
    errorMessage: log.errorMessage,
    sentAt: log.sentAt,
    createdAt: log.createdAt,
    relatedUserId: log.relatedUserId,
    relatedOrderId: log.relatedOrderId,
  };
}
