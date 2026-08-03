import { z } from "zod";
import { UserStatus } from "@/types/db";

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

export const AdminEmployeeCreateSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
  name: optionalText(100),
  displayName: optionalText(100),
  jobTitle: optionalText(100),
  department: optionalText(100),
  phone: optionalText(30),
  status: z.nativeEnum(UserStatus, { error: "Invalid user status." }).optional(),
});

export const AdminEmployeeUpdateSchema = z.object({
  name: optionalText(100),
  displayName: optionalText(100),
  jobTitle: optionalText(100),
  department: optionalText(100),
  phone: optionalText(30),
  status: z.nativeEnum(UserStatus, { error: "Invalid user status." }).optional(),
});

export type AdminEmployeeCreateInput = z.infer<typeof AdminEmployeeCreateSchema>;
export type AdminEmployeeUpdateInput = z.infer<typeof AdminEmployeeUpdateSchema>;
