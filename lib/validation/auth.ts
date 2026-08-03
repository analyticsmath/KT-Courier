import { z } from "zod";

// ─── Shared ───────────────────────────────────────────────────────────────────

const emailField = z.string().min(1, "Email is required").email("Enter a valid email address").toLowerCase().trim();
const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long");

// ─── Signup ───────────────────────────────────────────────────────────────────

export const CustomerSignupSchema = z
  .object({
    fullName: z.string().min(2, "Full name must be at least 2 characters").trim(),
    email: emailField,
    phone: z.string().trim().optional(),
    password: passwordField,
    confirmPassword: z.string().min(1, "Please confirm your password"),
    accountType: z.literal("CUSTOMER"),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
  });

export const StoreSignupSchema = z
  .object({
    storeName: z.string().min(2, "Store name must be at least 2 characters").trim(),
    contactPerson: z.string().min(2, "Contact person name is required").trim(),
    email: emailField,
    phone: z.string().min(1, "Phone number is required").trim(),
    businessAddress: z.string().trim().optional(),
    password: passwordField,
    confirmPassword: z.string().min(1, "Please confirm your password"),
    accountType: z.literal("STORE"),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
  });

// ─── Login ────────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password is required"),
});

// ─── OTP ──────────────────────────────────────────────────────────────────────

export const VerifyOtpSchema = z.object({
  email: emailField,
  code: z
    .string()
    .length(6, "Verification code must be 6 digits")
    .regex(/^\d{6}$/, "Verification code must be 6 digits"),
});

export const ResendOtpSchema = z.object({
  email: emailField,
});

// ─── Password reset ───────────────────────────────────────────────────────────

export const ForgotPasswordSchema = z.object({
  email: emailField,
});

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    password: passwordField,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
  });

// ─── Inferred types ───────────────────────────────────────────────────────────

export type CustomerSignupInput = z.infer<typeof CustomerSignupSchema>;
export type StoreSignupInput = z.infer<typeof StoreSignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
export type ResendOtpInput = z.infer<typeof ResendOtpSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatZodErrors(
  issues: { path: PropertyKey[]; message: string }[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const strPath = issue.path
      .filter((k): k is string | number => typeof k !== "symbol")
      .join(".");
    const key = strPath || "_root";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
