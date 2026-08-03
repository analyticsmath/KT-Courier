import type { EmailStatus, EmailTemplateType } from "@/types/db";
import { listLegacyEmailHistory } from "@/lib/notifications/legacy-email-history";
import type { EmailLogDto } from "@/lib/dto/email-log.dto";

/** Historical read-only screen. New delivery state is Phase 27 NotificationDelivery. */
export interface EmailLogFilters {
  status?: EmailStatus;
  templateType?: EmailTemplateType;
  search?: string;
  page: number;
  pageSize: number;
}

export async function listEmailLogs(filters: EmailLogFilters): Promise<{ data: EmailLogDto[]; total: number }> {
  return listLegacyEmailHistory(filters);
}
