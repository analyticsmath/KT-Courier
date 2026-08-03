import { z } from "zod";
import { AddressType } from "@/types/db";
import { AddressInputSchema } from "./address";

const SavedAddressTypeSchema = z.enum([
  AddressType.PICKUP,
  AddressType.DROPOFF,
  AddressType.CUSTOMER,
]);

const labelField = z.string().trim().min(2, "Label must be at least 2 characters").max(80, "Label is too long").optional();

function validateCoordinatePair(
  data: { latitude?: number | null; longitude?: number | null },
  ctx: z.RefinementCtx
) {
  const hasLat = typeof data.latitude === "number";
  const hasLng = typeof data.longitude === "number";
  if (hasLat !== hasLng) {
    ctx.addIssue({
      code: "custom",
      message: "Latitude and longitude must be supplied together",
      path: hasLat ? ["longitude"] : ["latitude"],
    });
  }
}

export const SavedAddressCreateSchema = AddressInputSchema.extend({
  type: SavedAddressTypeSchema.default(AddressType.CUSTOMER),
  label: labelField,
  isDefault: z.boolean().optional(),
}).superRefine(validateCoordinatePair);

export const SavedAddressUpdateSchema = AddressInputSchema.partial()
  .extend({
    type: SavedAddressTypeSchema.optional(),
    label: labelField.nullable().optional(),
    isDefault: z.boolean().optional(),
  })
  .superRefine(validateCoordinatePair);

export const StorePickupAddressSchema = AddressInputSchema.extend({
  label: labelField,
}).superRefine(validateCoordinatePair);

export type SavedAddressCreateInput = z.infer<typeof SavedAddressCreateSchema>;
export type SavedAddressUpdateInput = z.infer<typeof SavedAddressUpdateSchema>;
export type StorePickupAddressInput = z.infer<typeof StorePickupAddressSchema>;
