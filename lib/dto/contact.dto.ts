import type { ContactMessage } from "@/types/db";
import type { ContactMessageStatus } from "@/types/db";

// ─── DTO ──────────────────────────────────────────────────────────────────────

export interface ContactMessageDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  enquiryType: string;
  message: string;
  status: ContactMessageStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** Shorter summary for list views — message body truncated. */
export interface ContactMessageSummaryDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  enquiryType: string;
  messageSummary: string;
  status: ContactMessageStatus;
  createdAt: Date;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

export function toContactMessageDto(msg: ContactMessage): ContactMessageDto {
  return {
    id: msg.id,
    name: msg.name,
    email: msg.email,
    phone: msg.phone,
    enquiryType: msg.enquiryType,
    message: msg.message,
    status: msg.status,
    createdAt: msg.createdAt,
    updatedAt: msg.updatedAt,
  };
}

export function toContactMessageSummaryDto(
  msg: ContactMessage
): ContactMessageSummaryDto {
  return {
    id: msg.id,
    name: msg.name,
    email: msg.email,
    phone: msg.phone,
    enquiryType: msg.enquiryType,
    messageSummary:
      msg.message.length > 120 ? msg.message.slice(0, 120) + "…" : msg.message,
    status: msg.status,
    createdAt: msg.createdAt,
  };
}
