import { z } from "zod";
import { PermissionEffect, UserRole } from "@/types/db";

export const RolePermissionsUpdateSchema = z.object({
  permissionKeys: z.array(z.string().trim().min(1)).default([]),
});

export const UserPermissionOverridesUpdateSchema = z.object({
  overrides: z
    .array(
      z.object({
        permissionKey: z.string().trim().min(1, "Permission key is required."),
        effect: z.nativeEnum(PermissionEffect, { error: "Invalid permission effect." }),
        reason: z.string().trim().max(500).nullable().optional(),
      })
    )
    .default([]),
});

export function parseUserRole(value: string): UserRole | null {
  return Object.values(UserRole).includes(value as UserRole)
    ? (value as UserRole)
    : null;
}

export type RolePermissionsUpdateInput = z.infer<
  typeof RolePermissionsUpdateSchema
>;
export type UserPermissionOverridesUpdateInput = z.infer<
  typeof UserPermissionOverridesUpdateSchema
>;
