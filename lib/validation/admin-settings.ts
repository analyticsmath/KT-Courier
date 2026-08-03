import { z } from "zod";
import { SystemSettingType } from "@/types/db";

// Keys that must never be stored in SystemSetting (enforced server-side).
export const FORBIDDEN_SETTING_KEYS = [
  "secret",
  "api_key",
  "private_key",
  "token",
  "password",
  "credential",
  "webhook_secret",
];

export function isForbiddenKey(key: string): boolean {
  return FORBIDDEN_SETTING_KEYS.some((f) => key.toLowerCase().includes(f));
}

/** Validates an incoming value against the setting's declared type. */
export function validateSettingValue(
  type: SystemSettingType,
  value: unknown
): { ok: true; value: unknown } | { ok: false; error: string } {
  switch (type) {
    case SystemSettingType.STRING:
      if (typeof value !== "string") return { ok: false, error: "Value must be a string." };
      if (value.length > 2000) return { ok: false, error: "Value must be under 2000 characters." };
      return { ok: true, value: value.trim() };

    case SystemSettingType.NUMBER: {
      const n = typeof value === "string" ? parseFloat(value) : value;
      if (typeof n !== "number" || isNaN(n)) return { ok: false, error: "Value must be a number." };
      return { ok: true, value: n };
    }

    case SystemSettingType.BOOLEAN:
      if (typeof value === "boolean") return { ok: true, value };
      if (value === "true") return { ok: true, value: true };
      if (value === "false") return { ok: true, value: false };
      return { ok: false, error: "Value must be true or false." };

    case SystemSettingType.JSON:
      if (typeof value === "object" && value !== null) return { ok: true, value };
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          return { ok: true, value: parsed };
        } catch {
          return { ok: false, error: "Value must be valid JSON." };
        }
      }
      return { ok: false, error: "Value must be a valid JSON object." };

    default:
      return { ok: false, error: "Unknown setting type." };
  }
}

export const SettingValueUpdateSchema = z.object({
  value: z.unknown(),
});

export type SettingValueUpdateInput = z.infer<typeof SettingValueUpdateSchema>;
