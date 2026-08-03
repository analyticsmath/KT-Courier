import { z } from "zod";

// ─── Customer profile update ──────────────────────────────────────────────────

export const CustomerProfileUpdateSchema = z.object({
  name: z.string().max(100, "Name is too long").trim().optional(),
  phone: z.string().max(30, "Phone number is too long").trim().optional(),
});

export type CustomerProfileUpdateInput = z.infer<typeof CustomerProfileUpdateSchema>;

// ─── Store profile update ─────────────────────────────────────────────────────

export const StoreProfileUpdateSchema = z.object({
  storeName: z
    .string()
    .min(2, "Store name must be at least 2 characters")
    .max(100, "Store name is too long")
    .trim()
    .optional(),
  contactPerson: z
    .string()
    .min(2, "Contact person name must be at least 2 characters")
    .max(100, "Contact person name is too long")
    .trim()
    .optional(),
  businessPhone: z.string().max(30, "Phone number is too long").trim().optional(),
  businessEmail: z
    .union([z.string().email("Enter a valid email address").trim(), z.literal("")])
    .optional(),
  addressLine1: z.string().max(200, "Address is too long").trim().optional(),
  addressLine2: z.string().max(200, "Address is too long").trim().optional(),
  city: z.string().max(100, "City name is too long").trim().optional(),
  province: z.string().max(100, "Province name is too long").trim().optional(),
  postalCode: z.string().max(20, "Postal code is too long").trim().optional(),
  country: z.string().max(100, "Country name is too long").trim().optional(),
});

export type StoreProfileUpdateInput = z.infer<typeof StoreProfileUpdateSchema>;
