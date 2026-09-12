import { z } from "zod";
import { VehicleType, DriverAvailability, DriverStatus, DocumentType } from "@/types/db";

// ─── Vehicle and Registration Validations ────────────────────────────────────
const VehicleTypeSchema = z.nativeEnum(VehicleType);

// ─── Admin Create Driver Profile Input ────────────────────────────────────────
export const AdminCreateDriverSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  displayName: z.string().max(100, "Display name is too long").trim().optional(),
  phone: z.string().max(30, "Phone number is too long").trim().optional(),
  emergencyContactName: z.string().max(100).trim().optional(),
  emergencyContactPhone: z.string().max(30).trim().optional(),
  vehicleType: VehicleTypeSchema.optional(),
  vehicleMake: z.string().max(50).trim().optional(),
  vehicleModel: z.string().max(50).trim().optional(),
  vehicleColor: z.string().max(30).trim().optional(),
  vehicleRegistration: z.string().max(20).trim().optional(),
  licenseNumber: z.string().max(50).trim().optional(),
  licenseExpiryDate: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  serviceNotes: z.string().optional(),
  internalNotes: z.string().optional(),
});

export type AdminCreateDriverInput = z.infer<typeof AdminCreateDriverSchema>;

// ─── Admin Update Driver Profile Input ────────────────────────────────────────
export const AdminUpdateDriverSchema = z.object({
  displayName: z.string().max(100, "Display name is too long").trim().optional(),
  phone: z.string().max(30, "Phone number is too long").trim().optional(),
  emergencyContactName: z.string().max(100).trim().optional(),
  emergencyContactPhone: z.string().max(30).trim().optional(),
  vehicleType: VehicleTypeSchema.optional(),
  vehicleMake: z.string().max(50).trim().optional(),
  vehicleModel: z.string().max(50).trim().optional(),
  vehicleColor: z.string().max(30).trim().optional(),
  vehicleRegistration: z.string().max(20).trim().optional(),
  licenseNumber: z.string().max(50).trim().optional(),
  licenseExpiryDate: z.string().nullable().optional().transform((val) => val ? new Date(val) : val),
  serviceNotes: z.string().optional(),
  internalNotes: z.string().optional(),
});

export type AdminUpdateDriverInput = z.infer<typeof AdminUpdateDriverSchema>;

// ─── Admin Driver Status Change Input ─────────────────────────────────────────
export const AdminDriverStatusChangeSchema = z.object({
  status: z.nativeEnum(DriverStatus),
  reason: z.string().trim().optional(),
}).refine((data) => {
  if ((data.status === "REJECTED" || data.status === "SUSPENDED") && (!data.reason || data.reason.length < 3)) {
    return false;
  }
  return true;
}, {
  message: "A valid reason (at least 3 characters) is required when rejecting or suspending a driver.",
  path: ["reason"],
});

export type AdminDriverStatusChangeInput = z.infer<typeof AdminDriverStatusChangeSchema>;

// ─── Admin Driver Service Regions Input ───────────────────────────────────────
export const AdminDriverRegionsSchema = z.object({
  regionIds: z.array(z.string()).min(0),
  primaryRegionId: z.string().nullable().optional(),
});

export type AdminDriverRegionsInput = z.infer<typeof AdminDriverRegionsSchema>;

// ─── Driver Self Profile Update ──────────────────────────────────────────────
export const DriverSelfUpdateSchema = z.object({
  displayName: z.string().max(100, "Display name is too long").trim().optional(),
  phone: z.string().min(8, "Phone number is too short").max(30, "Phone number is too long").trim().optional(),
  emergencyContactName: z.string().max(100).trim().optional(),
  emergencyContactPhone: z.string().max(30).trim().optional(),
});

export type DriverSelfUpdateInput = z.infer<typeof DriverSelfUpdateSchema>;

// ─── Driver Self Availability Update ──────────────────────────────────────────
export const DriverAvailabilityUpdateSchema = z.object({
  availability: z.nativeEnum(DriverAvailability).refine((val) => val !== "ON_DELIVERY", {
    message: "Drivers cannot set their status to ON_DELIVERY manually.",
  }),
  expectedRevision: z.number().int().positive("expectedRevision is required"),
});

export type DriverAvailabilityUpdateInput = z.infer<typeof DriverAvailabilityUpdateSchema>;

// ─── Driver Onboarding Identity Input ────────────────────────────────────────
export const DriverOnboardingSchema = z.object({
  displayName: z.string().max(100).trim().optional(),
  phone: z.string().min(8, "Phone number is required").max(30).trim(),
  idNumber: z.string().min(5, "ID or passport number is required").max(30).trim(),
  dateOfBirth: z.coerce.date(),
  residentialAddress: z.string().min(5, "Residential address is required").max(300).trim(),
  licenseNumber: z.string().min(5, "Driver licence number is required").max(50).trim(),
  licenseExpiryDate: z.coerce.date(),
  emergencyContactName: z.string().min(2, "Emergency contact name is required").max(100).trim(),
  emergencyContactPhone: z.string().min(8, "Emergency contact phone is required").max(30).trim(),
});

export type DriverOnboardingInput = z.infer<typeof DriverOnboardingSchema>;

// ─── Driver Document Attachment Input ─────────────────────────────────────────
export const AttachDriverDocumentSchema = z.object({
  documentType: z.nativeEnum(DocumentType),
  privateMediaReference: z.string().regex(/^PMO-[a-f0-9-]{36}$/),
  expiresAt: z.coerce.date().nullable().optional(),
});

export type AttachDriverDocumentInput = z.infer<typeof AttachDriverDocumentSchema>;

// ─── Admin Review Driver Document Input ───────────────────────────────────────
export const AdminReviewDriverDocumentSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().trim().optional(),
}).refine((data) => {
  if (data.status === "REJECTED" && (!data.reason || data.reason.length < 3)) {
    return false;
  }
  return true;
}, {
  message: "A valid reason (at least 3 characters) is required when rejecting a document.",
  path: ["reason"],
});

export type AdminReviewDriverDocumentInput = z.infer<typeof AdminReviewDriverDocumentSchema>;
