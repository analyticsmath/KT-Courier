import { z } from "zod";
import { DeliveryExceptionReason } from "@/types/db";
import { DriverOperationCommandSchema } from "./pickup";

// ─── Start delivery ───────────────────────────────────────────────────────────

export const StartDeliverySchema = DriverOperationCommandSchema.extend({
  driverNote: z.string().trim().max(1000).optional(),
}).strict();

export type StartDeliveryInput = z.infer<typeof StartDeliverySchema>;

// ─── Request / generate OTP ───────────────────────────────────────────────────

export const RequestDeliveryOtpSchema = DriverOperationCommandSchema.extend({
  // Optional override email — used only if order has no customer/store email
  // in practice not exposed to driver UI, kept for admin manual flows
}).strict();

export type RequestDeliveryOtpInput = z.infer<typeof RequestDeliveryOtpSchema>;

// ─── Complete delivery (OTP verification) ─────────────────────────────────────

export const CompleteDeliverySchema = DriverOperationCommandSchema.extend({
  otpCode: z
    .string()
    .trim()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d{6}$/, "OTP must be 6 numeric digits"),
  recipientName: z.string().trim().min(1, "Recipient name is required").max(150),
  recipientPhone: z.string().trim().max(30).optional(),
  publicNote: z.string().trim().max(1000).optional(),
  driverNote: z.string().trim().min(1, "A delivery note is required.").max(1000),
  // This is an opaque reference issued by the trusted private-media boundary;
  // arbitrary URLs and filesystem paths are rejected at the contract edge.
  evidenceReference: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/, "Invalid evidence reference.").optional(),
  confirmDelivery: z.literal(true, {
    error: "You must confirm the delivery has been completed.",
  }),
}).strict();

export type CompleteDeliveryInput = z.infer<typeof CompleteDeliverySchema>;

// ─── Delivery attempted ───────────────────────────────────────────────────────

export const DeliveryAttemptedSchema = DriverOperationCommandSchema.extend({
  reason: z.nativeEnum(DeliveryExceptionReason, {
    error: "A delivery exception reason is required.",
  }),
  publicNote: z.string().trim().max(1000).optional(),
  driverNote: z.string().trim().min(1, "A note is required.").max(1000),
  evidenceReference: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/, "Invalid evidence reference.").optional(),
}).strict();

export type DeliveryAttemptedInput = z.infer<typeof DeliveryAttemptedSchema>;

// ─── Delivery failed (hard failure) ──────────────────────────────────────────

export const DeliveryFailedSchema = z.object({
  reason: z.nativeEnum(DeliveryExceptionReason, {
    error: "A delivery failure reason is required.",
  }),
  note: z.string().trim().min(1, "A note is required for delivery failure.").max(1000),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
}).strict();

export type DeliveryFailedInput = z.infer<typeof DeliveryFailedSchema>;

// ─── Admin manual delivery completion ─────────────────────────────────────────

export const AdminManualDeliverySchema = z.object({
  recipientName: z.string().trim().min(1, "Recipient name is required").max(150),
  recipientPhone: z.string().trim().max(30).optional(),
  reason: z.string().trim().min(1, "A reason is required for manual delivery override.").max(1000),
  publicNote: z.string().trim().max(1000).optional(),
  deliveredAt: z.string().datetime().optional(),
}).strict();

export type AdminManualDeliveryInput = z.infer<typeof AdminManualDeliverySchema>;
