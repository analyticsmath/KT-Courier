import { z } from "zod";

// ─── Admin user update ────────────────────────────────────────────────────────

// Role changes are deferred to Phase 1.10 (admin hardening).
// Only name, phone, and status are allowed in this phase.
export const AdminUserUpdateSchema = z.object({
  name: z.string().max(100, "Name is too long").trim().optional(),
  phone: z.string().max(30, "Phone is too long").trim().optional(),
  status: z
    .enum(["ACTIVE", "SUSPENDED", "DISABLED"], {
      error: 'Status must be ACTIVE, SUSPENDED, or DISABLED.',
    })
    .optional(),
});

export type AdminUserUpdateInput = z.infer<typeof AdminUserUpdateSchema>;

// ─── Admin store update ───────────────────────────────────────────────────────

export const AdminStoreUpdateSchema = z.object({
  name: z.string().min(2, "Store name must be at least 2 characters").max(100).trim().optional(),
  contactName: z.string().max(100).trim().optional(),
  contactEmail: z
    .union([z.string().email("Enter a valid email address").trim(), z.literal("")])
    .optional(),
  contactPhone: z.string().max(30).trim().optional(),
  addressLine1: z.string().max(200).trim().optional(),
  addressLine2: z.string().max(200).trim().optional(),
  city: z.string().max(100).trim().optional(),
  province: z.string().max(100).trim().optional(),
  postalCode: z.string().max(20).trim().optional(),
  status: z
    .enum(["PENDING", "ACTIVE", "SUSPENDED", "DISABLED"])
    .optional(),
  featured: z.boolean().optional(),
});

export type AdminStoreUpdateInput = z.infer<typeof AdminStoreUpdateSchema>;

// ─── Store status update ──────────────────────────────────────────────────────

export const StoreStatusUpdateSchema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "DISABLED"], {
    error: 'Status must be PENDING, ACTIVE, SUSPENDED, or DISABLED.',
  }),
});

export type StoreStatusUpdateInput = z.infer<typeof StoreStatusUpdateSchema>;

// ─── Store featured toggle ────────────────────────────────────────────────────

export const StoreFeaturedUpdateSchema = z.object({
  featured: z.boolean(),
});

export type StoreFeaturedUpdateInput = z.infer<typeof StoreFeaturedUpdateSchema>;
