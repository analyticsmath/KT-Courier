import { z } from "zod";
import { VehicleDocumentType, VehicleMediaPurpose, VehicleType } from "@/types/db";
import { VEHICLE_SUBTYPES, VEHICLE_TYPE_FOR_SUBTYPE } from "@/lib/driver-operations/vehicle-subtypes";

export const CreateVehicleSchema = z.object({
  make: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(80),
  year: z.number().int().min(1886).max(new Date().getFullYear() + 1).nullable().optional(),
  colour: z.string().trim().max(50).nullable().optional(),
  registrationNumber: z.string().trim().min(2).max(20),
  vehicleType: z.nativeEnum(VehicleType),
  vehicleSubtype: z.enum(VEHICLE_SUBTYPES).optional(),
  capacityKg: z.string().regex(/^(?!0+(?:\.0{1,3})?$)\d{1,8}(\.\d{1,3})?$/, "Enter a positive capacity in kilograms with up to three decimal places.").nullable().optional(),
}).strict().superRefine((value, context) => {
  if (value.vehicleSubtype && VEHICLE_TYPE_FOR_SUBTYPE[value.vehicleSubtype] !== value.vehicleType) {
    context.addIssue({ code: "custom", path: ["vehicleType"], message: "Vehicle category does not match the selected dispatch class." });
  }
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
