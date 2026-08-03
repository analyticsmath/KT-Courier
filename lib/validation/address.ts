import { z } from "zod";

// Latitude must be -90..90; longitude must be -180..180
const latitudeField = z
  .number({ error: "Latitude must be a number" })
  .min(-90, "Latitude must be between -90 and 90")
  .max(90, "Latitude must be between -90 and 90")
  .optional();

const longitudeField = z
  .number({ error: "Longitude must be a number" })
  .min(-180, "Longitude must be between -180 and 180")
  .max(180, "Longitude must be between -180 and 180")
  .optional();

// Shared address body — used for pickup and dropoff sub-objects
export const AddressInputSchema = z.object({
  contactName: z.string().trim().optional(),
  contactPhone: z.string().trim().optional(),
  line1: z.string().min(3, "Address is required").max(200).trim(),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  province: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
  country: z.string().trim().max(100).default("South Africa"),
  accessNotes: z.string().trim().max(500).optional(),
  formattedAddress: z.string().trim().max(500).optional(),
  placeId: z.string().trim().max(200).optional(),
  latitude: latitudeField,
  longitude: longitudeField,
});

export type AddressInput = z.infer<typeof AddressInputSchema>;
