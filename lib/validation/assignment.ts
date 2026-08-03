import { z } from "zod";

// ─── Admin: assign an order to a driver ───────────────────────────────────────

export const AdminAssignOrderSchema = z.object({
  driverProfileId: z.string().min(1, "Driver is required"),
  reasonCode: z.string().trim().min(2).max(80).optional(),
  adminNote: z.string().trim().max(1000).optional(),
  overrideReason: z.string().trim().max(500).optional(),
});

export type AdminAssignOrderInput = z.infer<typeof AdminAssignOrderSchema>;

// ─── Admin: reassign an order to another driver ───────────────────────────────

export const AdminReassignOrderSchema = z.object({
  currentAssignmentId: z.string().cuid().optional(),
  expectedVersion: z.number().int().positive().optional(),
  newDriverProfileId: z.string().cuid().optional(),
  reasonCode: z.string().trim().min(2).max(80).optional(),
  note: z.string().trim().max(500).optional(),
  driverProfileId: z.string().min(1).optional(),
  reason: z.string().min(1).trim().max(500).optional(),
  adminNote: z.string().trim().max(1000).optional(),
  overrideReason: z.string().trim().max(500).optional(),
});

export type AdminReassignOrderInput = z.infer<typeof AdminReassignOrderSchema>;

// ─── Admin: cancel an assignment ──────────────────────────────────────────────

export const AdminCancelAssignmentSchema = z.object({
  assignmentId: z.string().cuid().optional(),
  expectedVersion: z.number().int().positive().optional(),
  reasonCode: z.string().trim().min(2).max(80).optional(),
  note: z.string().trim().max(500).optional(),
  reason: z.string().min(1).trim().max(500).optional(),
});

export type AdminCancelAssignmentInput = z.infer<typeof AdminCancelAssignmentSchema>;

// ─── Driver: accept an assignment ─────────────────────────────────────────────

export const DriverAcceptAssignmentSchema = z.object({
  expectedVersion: z.number().int().positive().optional(),
  driverNote: z.string().trim().max(500).optional(),
});

export type DriverAcceptAssignmentInput = z.infer<typeof DriverAcceptAssignmentSchema>;

// ─── Driver: reject an assignment ─────────────────────────────────────────────

export const DriverRejectAssignmentSchema = z.object({
  expectedVersion: z.number().int().positive().optional(),
  reasonCode: z.string().trim().min(2).max(80).optional(),
  note: z.string().trim().max(500).optional(),
  reason: z.string().min(1).trim().max(500).optional(),
});

export type DriverRejectAssignmentInput = z.infer<typeof DriverRejectAssignmentSchema>;

// Phase 7 canonical wire contracts. Legacy schemas above remain only for
// existing internal callers while routes use these strict, versioned payloads.
export const DispatchOfferSchema = z.object({
  driverProfileId: z.string().cuid(),
  reasonCode: z.string().trim().min(2).max(80),
  adminNote: z.string().trim().max(1_000).optional(),
}).strict();
export const DispatchReassignSchema = z.object({
  currentAssignmentId: z.string().cuid(),
  expectedVersion: z.number().int().positive(),
  newDriverProfileId: z.string().cuid(),
  reasonCode: z.string().trim().min(2).max(80),
  note: z.string().trim().max(500).optional(),
}).strict();
export const DispatchUnassignSchema = z.object({
  assignmentId: z.string().cuid(),
  expectedVersion: z.number().int().positive(),
  reasonCode: z.string().trim().min(2).max(80),
  note: z.string().trim().max(500).optional(),
}).strict();
export const DispatchAcceptSchema = z.object({ expectedVersion: z.number().int().positive() }).strict();
export const DispatchRejectSchema = z.object({ expectedVersion: z.number().int().positive(), reasonCode: z.string().trim().min(2).max(80), note: z.string().trim().max(500).optional() }).strict();
