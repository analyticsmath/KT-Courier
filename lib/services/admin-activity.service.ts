import { prisma } from "@/lib/db/prisma";
import { AdminActionType, Prisma } from "@/types/db";
import {
  toAdminActivityDto,
  type AdminActivityDto,
} from "@/lib/dto/admin-activity.dto";

// ─── Write: record an activity log entry ─────────────────────────────────────

export interface RecordActivityInput {
  actorUserId: string;
  action: AdminActionType;
  entityType?: string;
  entityId?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export async function recordAdminActivity(input: RecordActivityInput): Promise<void> {
  try {
    await prisma.adminActivityLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        message: input.message ?? null,
        metadata:
          input.metadata !== undefined
            ? (input.metadata as unknown as Prisma.InputJsonValue)
            : undefined,
      },
    });
  } catch {
    // Activity logging must never block the primary operation
  }
}

// ─── Read: list activity logs ─────────────────────────────────────────────────

export interface AdminActivityFilters {
  action?: AdminActionType;
  entityType?: string;
  actorUserId?: string;
  search?: string;
  page: number;
  pageSize: number;
}

export async function listAdminActivity(
  filters: AdminActivityFilters
): Promise<{ data: AdminActivityDto[]; total: number }> {
  const skip = (filters.page - 1) * filters.pageSize;

  const where: Prisma.AdminActivityLogWhereInput = {};

  if (filters.action) where.action = filters.action;
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.actorUserId) where.actorUserId = filters.actorUserId;

  if (filters.search) {
    const q = filters.search.trim();
    where.OR = [
      { message: { contains: q, mode: "insensitive" } },
      { entityType: { contains: q, mode: "insensitive" } },
      { entityId: { contains: q, mode: "insensitive" } },
      { actorUser: { name: { contains: q, mode: "insensitive" } } },
      { actorUser: { email: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.adminActivityLog.findMany({
      where,
      include: { actorUser: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: filters.pageSize,
    }),
    prisma.adminActivityLog.count({ where }),
  ]);

  return { data: logs.map(toAdminActivityDto), total };
}
