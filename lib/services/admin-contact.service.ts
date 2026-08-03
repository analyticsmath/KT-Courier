import { prisma } from "@/lib/db/prisma";
import { ContactMessageStatus, Prisma } from "@/types/db";
import {
  toContactMessageDto,
  toContactMessageSummaryDto,
  type ContactMessageDto,
  type ContactMessageSummaryDto,
} from "@/lib/dto/contact.dto";
import type { ContactFormInput } from "@/lib/validation/contact";
import { recordAdminActivity } from "./admin-activity.service";
import { AdminActionType } from "@/types/db";

// ─── Public: create from contact form ────────────────────────────────────────

export async function createContactMessage(
  input: ContactFormInput
): Promise<ContactMessageDto> {
  const msg = await prisma.contactMessage.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      enquiryType: input.enquiryType,
      message: input.message,
      status: ContactMessageStatus.NEW,
    },
  });
  return toContactMessageDto(msg);
}

// ─── Admin: list messages ─────────────────────────────────────────────────────

export interface ContactMessageFilters {
  status?: ContactMessageStatus;
  enquiryType?: string;
  search?: string;
  page: number;
  pageSize: number;
}

export async function listContactMessages(
  filters: ContactMessageFilters
): Promise<{ data: ContactMessageSummaryDto[]; total: number }> {
  const skip = (filters.page - 1) * filters.pageSize;

  const where: Prisma.ContactMessageWhereInput = {};

  if (filters.status) where.status = filters.status;
  if (filters.enquiryType) where.enquiryType = filters.enquiryType;

  if (filters.search) {
    const q = filters.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { message: { contains: q, mode: "insensitive" } },
    ];
  }

  const [messages, total] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: filters.pageSize,
    }),
    prisma.contactMessage.count({ where }),
  ]);

  return { data: messages.map(toContactMessageSummaryDto), total };
}

// ─── Admin: get single message ────────────────────────────────────────────────

export async function getContactMessage(
  id: string
): Promise<ContactMessageDto | null> {
  const msg = await prisma.contactMessage.findUnique({ where: { id } });
  return msg ? toContactMessageDto(msg) : null;
}

// ─── Admin: update status ─────────────────────────────────────────────────────

const ALLOWED_STATUS_TRANSITIONS: Record<ContactMessageStatus, ContactMessageStatus[]> = {
  NEW: [ContactMessageStatus.READ, ContactMessageStatus.ARCHIVED],
  READ: [ContactMessageStatus.RESPONDED, ContactMessageStatus.ARCHIVED],
  RESPONDED: [ContactMessageStatus.ARCHIVED],
  ARCHIVED: [],
};

export async function updateContactMessageStatus(
  actorUserId: string,
  id: string,
  newStatus: ContactMessageStatus
): Promise<{ message: ContactMessageDto } | { error: string }> {
  const existing = await prisma.contactMessage.findUnique({ where: { id } });
  if (!existing) return { error: "Contact message not found." };

  const allowed = ALLOWED_STATUS_TRANSITIONS[existing.status] ?? [];
  if (!allowed.includes(newStatus)) {
    return {
      error: `Cannot change status from ${existing.status} to ${newStatus}.`,
    };
  }

  const updated = await prisma.contactMessage.update({
    where: { id },
    data: { status: newStatus },
  });

  await recordAdminActivity({
    actorUserId,
    action: AdminActionType.STATUS_CHANGE,
    entityType: "ContactMessage",
    entityId: id,
    message: `Marked contact message from ${existing.email} as ${newStatus}.`,
    metadata: { from: existing.status, to: newStatus },
  });

  return { message: toContactMessageDto(updated) };
}
