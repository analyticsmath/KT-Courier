import { z } from "zod";
import { PickupFailureReason, ParcelCondition } from "@/types/db";

export const DriverOperationCommandSchema = z.object({
  operationId: z.string().uuid("operationId must be a UUID"),
  assignmentVersion: z.number().int().positive("assignmentVersion is required"),
});

// ─── Start pickup ─────────────────────────────────────────────────────────────

export const StartPickupSchema = DriverOperationCommandSchema.extend({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  driverNote: z.string().trim().max(500).optional(),
});

export type StartPickupInput = z.infer<typeof StartPickupSchema>;

// ─── Complete pickup ──────────────────────────────────────────────────────────

export const CompletePickupSchema = DriverOperationCommandSchema.extend({
  parcelCount: z.number({ error: "Parcel count must be a number" }).int().min(1).max(50).default(1),
  parcelCondition: z.nativeEnum(ParcelCondition, { error: "Invalid parcel condition" }).default(ParcelCondition.NOT_RECORDED),
  publicNote: z.string().trim().max(500).optional(),
  driverNote: z.string().trim().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  confirmPickup: z.boolean().refine((val) => val === true, {
    message: "You must confirm the parcel has been collected.",
  }),
});

export type CompletePickupInput = z.infer<typeof CompletePickupSchema>;

// ─── Fail pickup ──────────────────────────────────────────────────────────────

export const FailPickupSchema = z
  .object({
    failureReason: z.nativeEnum(PickupFailureReason, { error: "A failure reason is required" }),
    note: z.string().trim().min(1, "A note is required for pickup failure").max(1000),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  });

export type FailPickupInput = z.infer<typeof FailPickupSchema>;

// ─── Admin operational note ───────────────────────────────────────────────────

export const AdminOperationalNoteSchema = z.object({
  internalNote: z.string().trim().min(1, "Note is required").max(2000),
  publicNote: z.string().trim().max(500).optional(),
});

export type AdminOperationalNoteInput = z.infer<typeof AdminOperationalNoteSchema>;
