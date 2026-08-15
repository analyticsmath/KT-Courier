import { type NextRequest } from "next/server";
import { createContactMessage } from "@/lib/services/admin-contact.service";
import { ContactFormSchema } from "@/lib/validation/contact";
import { formatZodErrors } from "@/lib/validation/auth";
import { ok, unprocessable, serverError, tooManyRequests } from "@/lib/api/response";
import { queueLegacyEmailIntent } from "@/lib/notifications/security-delivery";
import { EmailTemplateType } from "@/types/db";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";

function getAdminContactRecipient(): string | null {
  // Order of preference: EMAIL_REPLY_TO, then EMAIL_FROM, then null (skip)
  const replyTo = process.env.EMAIL_REPLY_TO;
  if (replyTo) return replyTo;
  const from = process.env.EMAIL_FROM;
  if (from) {
    // EMAIL_FROM may be "Name <addr>" format — extract address
    const match = from.match(/<([^>]+)>/);
    if (match) return match[1];
    return from;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const rl = await checkIpRateLimit(req, "contact", RATE_LIMITS.CONTACT);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = ContactFormSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Please check the form and try again.", formatZodErrors(parsed.error.issues));
  }

  try {
    const msg = await createContactMessage(parsed.data);

    // 1. Confirmation email to the submitter (non-blocking)
    queueLegacyEmailIntent({ to: parsed.data.email, templateType: EmailTemplateType.CONTACT_RECEIVED, context: { name: parsed.data.name, enquiryType: parsed.data.enquiryType } }).catch(() => {});

    // 2. Notification to admin/support if a recipient is configured (non-blocking)
    const adminRecipient = getAdminContactRecipient();
    if (adminRecipient) {
      queueLegacyEmailIntent({
        to: adminRecipient, templateType: EmailTemplateType.ADMIN_CONTACT_MESSAGE,
        context: {
          senderName: parsed.data.name,
          senderEmail: parsed.data.email,
          enquiryType: parsed.data.enquiryType,
          messageSummary: parsed.data.message,
          adminUrl: process.env.NEXT_PUBLIC_APP_URL
            ? `${process.env.NEXT_PUBLIC_APP_URL}/admin/contact-messages/${msg.id}`
            : undefined,
        },
      }).catch(() => {});
    }

    return ok({
      message:
        "Thanks — your message has been received. KT Couriers will respond as soon as possible during operating hours.",
    });
  } catch {
    return serverError("Unable to submit your message. Please try again.");
  }
}
