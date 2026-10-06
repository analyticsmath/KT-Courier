import { z } from "zod";
import { AddressType } from "@/types/db";
import { AddressInputSchema } from "./address";

const SavedAddressTypeSchema = z.enum([
  AddressType.PICKUP,
  AddressType.DROPOFF,
  AddressType.CUSTOMER,
]);

const labelField = z.string().trim().min(2, "Label must be at least 2 characters").max(80, "Label is too long").optional();

// Explicit null clears stale map authority when a saved address is edited to
// text-only entry. Booking schemas still require real mapped coordinates.
const savedLocationFields = {
  placeId: AddressInputSchema.shape.placeId.nullable(),
  latitude: AddressInputSchema.shape.latitude.nullable(),
  longitude: AddressInputSchema.shape.longitude.nullable(),
};

function validateCoordinatePair(
  data: { latitude?: number | null; longitude?: number | null },
  ctx: z.RefinementCtx
) {
  const hasLat = typeof data.latitude === "number";
  const hasLng = typeof data.longitude === "number";
  if (hasLat !== hasLng || (data.latitude !== undefined) !== (data.longitude !== undefined)) {
    ctx.addIssue({
      code: "custom",
      message: "Latitude and longitude must be supplied together",
      path: hasLat ? ["longitude"] : ["latitude"],
    });
  }
}

export const SavedAddressCreateSchema = AddressInputSchema.extend({
  ...savedLocationFields,
  type: SavedAddressTypeSchema.default(AddressType.CUSTOMER),
  label: labelField,
  isDefault: z.boolean().optional(),
}).superRefine(validateCoordinatePair);

export const SavedAddressUpdateSchema = AddressInputSchema.partial()
  .extend({
    ...savedLocationFields,
    country: AddressInputSchema.shape.country.removeDefault().optional(),
    type: SavedAddressTypeSchema.optional(),
    label: labelField.nullable().optional(),
    isDefault: z.boolean().optional(),
  })
  .superRefine(validateCoordinatePair);

export const StorePickupAddressSchema = AddressInputSchema.extend({
  ...savedLocationFields,
  label: labelField,
}).superRefine(validateCoordinatePair);

export type SavedAddressCreateInput = z.infer<typeof SavedAddressCreateSchema>;
export type SavedAddressUpdateInput = z.infer<typeof SavedAddressUpdateSchema>;
export type StorePickupAddressInput = z.infer<typeof StorePickupAddressSchema>;
