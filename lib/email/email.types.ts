import type { EmailTemplateType } from "@/types/db";

// ─── Input to the email service ───────────────────────────────────────────────

export interface SendEmailInput {
  to: string;
  templateType: EmailTemplateType;
  context: Record<string, unknown>;
  relatedUserId?: string;
  relatedOrderId?: string;
}

// ─── Rendered email (produced by template registry) ──────────────────────────

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// ─── Provider send input ──────────────────────────────────────────────────────

export interface ProviderSendInput {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
}

// ─── Provider send result ─────────────────────────────────────────────────────

export type ProviderSendResult =
  | { ok: true; providerMessageId?: string }
  | { ok: false; error: string };

// ─── Final service result ─────────────────────────────────────────────────────

export type EmailSendResult =
  | { ok: true; logId: string; providerMessageId?: string }
  | { ok: false; logId?: string; error: string };
