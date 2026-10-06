import { z } from "zod";
import { AddressType } from "@/types/db";
import { AddressInputSchema } from "./address";

const SavedAddressTypeSchema = z.enum([
  AddressType.PICKUP,
  AddressType.DROPOFF,
  AddressType.CUSTOMER,
]);

const labelField = z.string().trim().min(2, "Label must be at least 2 characters").max(80, "Label is too long").optional();

// Explicit null clears removed optional details and stale map authority on
// saved addresses. Booking schemas still require real mapped coordinates.
const savedNullableFields = {
  contactName: AddressInputSchema.shape.contactName.nullable(),
  contactPhone: AddressInputSchema.shape.contactPhone.nullable(),
  line2: AddressInputSchema.shape.line2.nullable(),
  city: AddressInputSchema.shape.city.nullable(),
  province: AddressInputSchema.shape.province.nullable(),
  postalCode: AddressInputSchema.shape.postalCode.nullable(),
  accessNotes: AddressInputSchema.shape.accessNotes.nullable(),
  formattedAddress: AddressInputSchema.shape.formattedAddress.nullable(),
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
  ...savedNullableFields,
  type: SavedAddressTypeSchema.default(AddressType.CUSTOMER),
  label: labelField,
  isDefault: z.boolean().optional(),
}).superRefine(validateCoordinatePair);

export const SavedAddressUpdateSchema = AddressInputSchema.partial()
  .extend({
    ...savedNullableFields,
    country: AddressInputSchema.shape.country.removeDefault().optional(),
    type: SavedAddressTypeSchema.optional(),
    label: labelField.nullable().optional(),
    isDefault: z.boolean().optional(),
  })
  .superRefine(validateCoordinatePair);

export const StorePickupAddressSchema = AddressInputSchema.extend({
  ...savedNullableFields,
  label: labelField,
}).superRefine(validateCoordinatePair);

export type SavedAddressCreateInput = z.infer<typeof SavedAddressCreateSchema>;
export type SavedAddressUpdateInput = z.infer<typeof SavedAddressUpdateSchema>;
export type StorePickupAddressInput = z.infer<typeof StorePickupAddressSchema>;
