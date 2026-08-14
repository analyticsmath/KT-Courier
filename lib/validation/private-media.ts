import { z } from "zod";
import { VehicleDocumentType, VehicleMediaPurpose, VehicleType } from "@/types/db";

export const CreateVehicleSchema = z.object({
  make: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(80),
  year: z.number().int().min(1886).max(2100).nullable().optional(),
  colour: z.string().trim().max(50).nullable().optional(),
  registrationNumber: z.string().trim().min(2).max(20),
  vehicleType: z.nativeEnum(VehicleType),
  capacityKg: z.string().regex(/^\d{1,8}(\.\d{1,3})?$/).nullable().optional(),
});

export const AttachVehicleDocumentSchema = z.object({
  documentType: z.nativeEnum(VehicleDocumentType),
  privateMediaReference: z.string().regex(/^PMO-[a-f0-9-]{36}$/),
  expiresAt: z.coerce.date().nullable().optional(),
});

export const AttachVehicleMediaSchema = z.object({
  purpose: z.nativeEnum(VehicleMediaPurpose),
  privateMediaReference: z.string().regex(/^PMO-[a-f0-9-]{36}$/),
});
