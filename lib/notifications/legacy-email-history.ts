/**
 * Read-only compatibility projection for records created before Phase 27.
 * It is deliberately unable to create, mutate, or send legacy email records.
 */
import { prisma } from "@/lib/db/prisma";
import { EmailStatus, type EmailTemplateType, type Prisma } from "@/types/db";
import { toEmailLogDto, type EmailLogDto } from "@/lib/dto/email-log.dto";

export async function listLegacyEmailHistory(filters: { status?: EmailStatus; templateType?: EmailTemplateType; search?: string; page: number; pageSize: number }): Promise<{ data: EmailLogDto[]; total: number }> {
  const where: Prisma.EmailLogWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.templateType) where.templateType = filters.templateType;
  if (filters.search) {
    const query = filters.search.trim();
    where.OR = [{ recipient: { contains: query, mode: "insensitive" } }, { subject: { contains: query, mode: "insensitive" } }];
  }
  const [logs, total] = await Promise.all([prisma.emailLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize }), prisma.emailLog.count({ where })]);
  return { data: logs.map(toEmailLogDto), total };
}

export async function getLegacyEmailHistory(id: string): Promise<EmailLogDto | null> {
  const log = await prisma.emailLog.findUnique({ where: { id } });
  return log ? toEmailLogDto(log) : null;
}

export async function countLegacyFailedEmailHistory(): Promise<number> {
  return prisma.emailLog.count({ where: { status: EmailStatus.FAILED } });
}
