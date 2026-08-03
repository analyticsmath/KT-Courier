import { EmailTemplateType } from "@/types/db";
import { renderEmailHtml, renderEmailText } from "./email-renderer";
import type { RenderedEmail } from "./email.types";

// ─── Template context interfaces ──────────────────────────────────────────────

export interface WelcomeContext {
  name: string;
}

export interface OtpContext {
  name: string;
  otp: string;
  expiresMinutes: number;
}

export interface PasswordResetContext {
  name: string;
  resetUrl: string;
  expiresMinutes: number;
}

export interface PasswordChangedContext {
  name: string;
}

export interface ContactReceivedContext {
  name: string;
  enquiryType: string;
}

export interface OrderConfirmationContext {
  name: string;
  orderNumber: string;
  deliveryType: string;
  pickupAddress: string;
  dropoffAddress: string;
  priceEstimate?: string;
  orderUrl?: string;
}

export interface OrderStatusChangedContext {
  name: string;
  orderNumber: string;
  newStatus: string;
  statusLabel: string;
  statusNote?: string;
  orderUrl?: string;
}

export interface AdminNewOrderContext {
  orderNumber: string;
  source: string;
  deliveryType: string;
  submittedBy: string;
  adminOrderUrl?: string;
}

export interface AdminContactMessageContext {
  senderName: string;
  senderEmail: string;
  enquiryType: string;
  messageSummary: string;
  adminUrl?: string;
}

export interface DeliveryOtpContext {
  name: string;
  otp: string;
  expiresMinutes: number;
  orderNumber: string;
  orderUrl?: string;
}

// ─── Status label helper ──────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING: "Request received",
  CONFIRMED: "Confirmed",
  PICKUP_SCHEDULED: "Pickup scheduled",
  PICKED_UP: "Parcel collected",
  IN_TRANSIT: "In transit",
  IN_PROGRESS: "In progress",
  DELIVERY_ATTEMPTED: "Delivery attempted",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  FAILED: "Could not be completed",
};

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

// ─── Template registry ────────────────────────────────────────────────────────

export function renderTemplate(
  templateType: EmailTemplateType,
  context: Record<string, unknown>
): RenderedEmail {
  switch (templateType) {
    case EmailTemplateType.WELCOME:
      return renderWelcome(context as unknown as WelcomeContext);

    case EmailTemplateType.EMAIL_VERIFICATION_OTP:
      return renderOtp(context as unknown as OtpContext);

    case EmailTemplateType.PASSWORD_RESET:
      return renderPasswordReset(context as unknown as PasswordResetContext);

    case EmailTemplateType.PASSWORD_CHANGED:
      return renderPasswordChanged(context as unknown as PasswordChangedContext);

    case EmailTemplateType.CONTACT_RECEIVED:
      return renderContactReceived(context as unknown as ContactReceivedContext);

    case EmailTemplateType.ORDER_CONFIRMATION:
      return renderOrderConfirmation(context as unknown as OrderConfirmationContext);

    case EmailTemplateType.ORDER_STATUS_CHANGED:
      return renderOrderStatusChanged(context as unknown as OrderStatusChangedContext);

    case EmailTemplateType.ADMIN_NEW_ORDER:
      return renderAdminNewOrder(context as unknown as AdminNewOrderContext);

    case EmailTemplateType.ADMIN_CONTACT_MESSAGE:
      return renderAdminContactMessage(context as unknown as AdminContactMessageContext);

    case EmailTemplateType.DELIVERY_OTP:
      return renderDeliveryOtp(context as unknown as DeliveryOtpContext);

    default:
      throw new Error(`No template registered for: ${templateType}`);
  }
}

// ─── Individual templates ─────────────────────────────────────────────────────

function renderWelcome(ctx: WelcomeContext): RenderedEmail {
  const subject = "Welcome to KT Couriers";
  const title = "Welcome to KT Couriers";
  const body = `
    <p>Hi ${ctx.name},</p>
    <p>Your account has been created. Once your email is verified, you can start placing
    delivery requests through the KT Couriers platform.</p>
    <p>If you have any questions, contact us through the contact form on our website.</p>
  `;
  return {
    subject,
    html: renderEmailHtml({ title, body }),
    text: renderEmailText(title, `Hi ${ctx.name},\n\nYour account has been created. Once your email is verified, you can start placing delivery requests through the KT Couriers platform.`),
  };
}

function renderOtp(ctx: OtpContext): RenderedEmail {
  const subject = "Your KT Couriers verification code";
  const title = "Verify your email address";
  const body = `
    <p>Hi ${ctx.name},</p>
    <p>Use the code below to verify your email address. It expires in
    <strong>${ctx.expiresMinutes} minutes</strong>.</p>
    <div style="text-align:center;margin:28px 0;">
      <span style="display:inline-block;padding:16px 32px;background:#f0f4ff;
                   border:2px dashed #1D6ADB;border-radius:10px;
                   font-size:32px;font-weight:700;letter-spacing:8px;
                   color:#0F2B52;font-family:monospace;">
        ${ctx.otp}
      </span>
    </div>
    <p style="color:#6b7280;font-size:13px;">If you did not create a KT Couriers account,
    you can ignore this email.</p>
  `;
  const text = `Hi ${ctx.name},\n\nYour verification code is: ${ctx.otp}\n\nIt expires in ${ctx.expiresMinutes} minutes.\n\nIf you did not create a KT Couriers account, ignore this email.`;
  return {
    subject,
    html: renderEmailHtml({ title, body }),
    text: renderEmailText(title, text),
  };
}

function renderPasswordReset(ctx: PasswordResetContext): RenderedEmail {
  const subject = "Reset your KT Couriers password";
  const title = "Password reset request";
  const body = `
    <p>Hi ${ctx.name},</p>
    <p>We received a request to reset your password. Click the button below to choose
    a new password. This link expires in <strong>${ctx.expiresMinutes} minutes</strong>.</p>
    <p style="color:#6b7280;font-size:13px;">If you did not request a password reset,
    you can safely ignore this email. Your password has not been changed.</p>
  `;
  return {
    subject,
    html: renderEmailHtml({ title, body, actionUrl: ctx.resetUrl, actionLabel: "Reset password" }),
    text: renderEmailText(title, `Hi ${ctx.name},\n\nWe received a password reset request. Use this link to reset your password (expires in ${ctx.expiresMinutes} minutes):\n\n${ctx.resetUrl}\n\nIf you did not request a reset, ignore this email.`),
  };
}

function renderPasswordChanged(ctx: PasswordChangedContext): RenderedEmail {
  const subject = "Your KT Couriers password has been changed";
  const title = "Password changed";
  const body = `
    <p>Hi ${ctx.name},</p>
    <p>Your KT Couriers password was successfully changed.</p>
    <p>If you did not make this change, please contact us immediately through
    the contact form on our website.</p>
  `;
  return {
    subject,
    html: renderEmailHtml({ title, body }),
    text: renderEmailText(title, `Hi ${ctx.name},\n\nYour KT Couriers password was successfully changed.\n\nIf you did not make this change, please contact us immediately.`),
  };
}

function renderContactReceived(ctx: ContactReceivedContext): RenderedEmail {
  const subject = "We received your message — KT Couriers";
  const title = "Message received";
  const enquiryLabel = ctx.enquiryType.replace(/_/g, " ");
  const body = `
    <p>Hi ${ctx.name},</p>
    <p>Thank you for getting in touch. We have received your message regarding
    <strong>${enquiryLabel}</strong>.</p>
    <p>A member of our team will review your enquiry and respond as soon as possible
    during operating hours.</p>
    <p style="color:#6b7280;font-size:13px;">Please do not reply to this email.
    If you need to follow up, submit a new message through the contact form on our website.</p>
  `;
  return {
    subject,
    html: renderEmailHtml({ title, body }),
    text: renderEmailText(title, `Hi ${ctx.name},\n\nThank you for getting in touch. We have received your message regarding ${enquiryLabel}.\n\nA member of our team will review your enquiry and respond as soon as possible during operating hours.`),
  };
}

function renderOrderConfirmation(ctx: OrderConfirmationContext): RenderedEmail {
  const subject = `Order ${ctx.orderNumber} received — KT Couriers`;
  const title = "Order received";
  const price = ctx.priceEstimate ? `<p>Estimated price: <strong>${ctx.priceEstimate}</strong></p>` : "";
  const body = `
    <p>Hi ${ctx.name},</p>
    <p>Your delivery request has been received and is pending confirmation.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
      <tr>
        <td style="padding:8px 0;color:#6b7280;width:40%;">Order number</td>
        <td style="padding:8px 0;font-weight:600;color:#0a1628;font-family:monospace;">${ctx.orderNumber}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#6b7280;">Delivery type</td>
        <td style="padding:8px 0;color:#374151;">${ctx.deliveryType}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#6b7280;">Pickup</td>
        <td style="padding:8px 0;color:#374151;">${ctx.pickupAddress}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#6b7280;">Dropoff</td>
        <td style="padding:8px 0;color:#374151;">${ctx.dropoffAddress}</td>
      </tr>
    </table>
    ${price}
    <p>We will notify you when your order status is updated.</p>
  `;
  const textBody = `Hi ${ctx.name},\n\nYour delivery request has been received.\n\nOrder: ${ctx.orderNumber}\nDelivery type: ${ctx.deliveryType}\nPickup: ${ctx.pickupAddress}\nDropoff: ${ctx.dropoffAddress}${ctx.priceEstimate ? `\nEstimated price: ${ctx.priceEstimate}` : ""}\n\nWe will notify you when your order status is updated.`;
  return {
    subject,
    html: renderEmailHtml({ title, body, actionUrl: ctx.orderUrl, actionLabel: "View order" }),
    text: renderEmailText(title, textBody, ctx.orderUrl),
  };
}

function renderOrderStatusChanged(ctx: OrderStatusChangedContext): RenderedEmail {
  const subject = `Order ${ctx.orderNumber} update — KT Couriers`;
  const title = `Order status: ${ctx.statusLabel}`;
  const noteRow = ctx.statusNote
    ? `<tr><td style="padding:8px 0;color:#6b7280;width:40%;">Note</td><td style="padding:8px 0;color:#374151;">${ctx.statusNote}</td></tr>`
    : "";
  const body = `
    <p>Hi ${ctx.name},</p>
    <p>The status of your delivery order has been updated.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
      <tr>
        <td style="padding:8px 0;color:#6b7280;width:40%;">Order number</td>
        <td style="padding:8px 0;font-weight:600;color:#0a1628;font-family:monospace;">${ctx.orderNumber}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#6b7280;">New status</td>
        <td style="padding:8px 0;font-weight:600;color:#0F2B52;">${ctx.statusLabel}</td>
      </tr>
      ${noteRow}
    </table>
  `;
  const textBody = `Hi ${ctx.name},\n\nYour delivery order has been updated.\n\nOrder: ${ctx.orderNumber}\nNew status: ${ctx.statusLabel}${ctx.statusNote ? `\nNote: ${ctx.statusNote}` : ""}`;
  return {
    subject,
    html: renderEmailHtml({ title, body, actionUrl: ctx.orderUrl, actionLabel: "View order" }),
    text: renderEmailText(title, textBody, ctx.orderUrl),
  };
}

function renderAdminNewOrder(ctx: AdminNewOrderContext): RenderedEmail {
  const subject = `New delivery request: ${ctx.orderNumber}`;
  const title = "New delivery request received";
  const body = `
    <p>A new delivery request has been submitted on the KT Couriers platform.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
      <tr>
        <td style="padding:8px 0;color:#6b7280;width:40%;">Order number</td>
        <td style="padding:8px 0;font-weight:600;font-family:monospace;color:#0a1628;">${ctx.orderNumber}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#6b7280;">Source</td>
        <td style="padding:8px 0;color:#374151;">${ctx.source}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#6b7280;">Delivery type</td>
        <td style="padding:8px 0;color:#374151;">${ctx.deliveryType}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#6b7280;">Submitted by</td>
        <td style="padding:8px 0;color:#374151;">${ctx.submittedBy}</td>
      </tr>
    </table>
  `;
  const textBody = `New delivery request received.\n\nOrder: ${ctx.orderNumber}\nSource: ${ctx.source}\nDelivery type: ${ctx.deliveryType}\nSubmitted by: ${ctx.submittedBy}`;
  return {
    subject,
    html: renderEmailHtml({ title, body, actionUrl: ctx.adminOrderUrl, actionLabel: "Review order" }),
    text: renderEmailText(title, textBody, ctx.adminOrderUrl),
  };
}

function renderDeliveryOtp(ctx: DeliveryOtpContext): RenderedEmail {
  const subject = `Your KT Couriers delivery code — Order ${ctx.orderNumber}`;
  const title = "Delivery confirmation code";
  const body = `
    <p>Hi ${ctx.name},</p>
    <p>Your delivery is arriving now. Please give the code below to the driver to confirm receipt.</p>
    <p>This code is valid for <strong>${ctx.expiresMinutes} minutes</strong>.</p>
    <div style="text-align:center;margin:28px 0;">
      <span style="display:inline-block;padding:16px 36px;background:#f0f4ff;
                   border:2px dashed #1D6ADB;border-radius:10px;
                   font-size:36px;font-weight:700;letter-spacing:10px;
                   color:#0F2B52;font-family:monospace;">
        ${ctx.otp}
      </span>
    </div>
    <p style="font-size:13px;color:#6b7280;">Order number: <strong style="font-family:monospace;">${ctx.orderNumber}</strong></p>
    <p style="font-size:13px;color:#6b7280;margin-top:16px;">
      Do not share this code with anyone other than the KT Couriers driver at your door.
      KT Couriers staff will never call or message you to ask for this code.
    </p>
  `;
  const text = `Hi ${ctx.name},\n\nYour KT Couriers delivery is arriving now.\n\nYour delivery confirmation code is:\n\n  ${ctx.otp}\n\nValid for ${ctx.expiresMinutes} minutes.\n\nOrder: ${ctx.orderNumber}\n\nGive this code to the driver to confirm receipt. Do not share it with anyone else.`;
  return {
    subject,
    html: renderEmailHtml({ title, body, actionUrl: ctx.orderUrl, actionLabel: "View order" }),
    text: renderEmailText(title, text, ctx.orderUrl),
  };
}

function renderAdminContactMessage(ctx: AdminContactMessageContext): RenderedEmail {
  const subject = `New contact message: ${ctx.enquiryType.replace(/_/g, " ")}`;
  const title = "New contact form submission";
  const preview = ctx.messageSummary.length > 200 ? ctx.messageSummary.slice(0, 200) + "…" : ctx.messageSummary;
  const body = `
    <p>A new contact message has been submitted.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
      <tr>
        <td style="padding:8px 0;color:#6b7280;width:35%;">Name</td>
        <td style="padding:8px 0;color:#374151;">${ctx.senderName}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#6b7280;">Email</td>
        <td style="padding:8px 0;color:#374151;">${ctx.senderEmail}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#6b7280;">Enquiry type</td>
        <td style="padding:8px 0;color:#374151;">${ctx.enquiryType.replace(/_/g, " ")}</td>
      </tr>
    </table>
    <p style="font-size:13px;color:#6b7280;border-left:3px solid #e5e7eb;padding-left:12px;
              font-style:italic;margin:16px 0;">${preview}</p>
  `;
  const textBody = `New contact message.\n\nName: ${ctx.senderName}\nEmail: ${ctx.senderEmail}\nEnquiry: ${ctx.enquiryType.replace(/_/g, " ")}\n\nMessage preview:\n${preview}`;
  return {
    subject,
    html: renderEmailHtml({ title, body, actionUrl: ctx.adminUrl, actionLabel: "View message" }),
    text: renderEmailText(title, textBody, ctx.adminUrl),
  };
}
