import { z } from "zod";
import { SystemSettingType } from "@/types/db";
import { getSystemSettingDefinition } from "@/lib/settings/catalog";
import { parseHighRiskAreas } from "@/lib/settings/high-risk-area-policy";

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
  value: unknown,
  key?: string
): { ok: true; value: unknown } | { ok: false; error: string } {
  const definition = key ? getSystemSettingDefinition(key) : null;
  if (key && !definition) return { ok: false, error: "This setting is not governed by the system setting catalog." };
  if (definition && definition.type !== type) return { ok: false, error: "The stored setting type does not match its governed definition." };
  switch (type) {
    case SystemSettingType.STRING:
      if (typeof value !== "string") return { ok: false, error: "Value must be a string." };
      if (value.length > 2000) return { ok: false, error: "Value must be under 2000 characters." };
      const normalized = value.trim();
      if (definition?.allowedValues && !definition.allowedValues.includes(normalized)) return { ok: false, error: "Value is not in the approved setting range." };
      return { ok: true, value: normalized };

    case SystemSettingType.NUMBER: {
      // parseFloat("10junk") silently accepts malformed commercial settings.
      // Refuse partial parses, exponent overflow and nonfinite numeric JSON.
      const trimmed = typeof value === "string" ? value.trim() : "";
      const n = typeof value === "string"
        ? (/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(trimmed) ? Number(trimmed) : NaN)
        : value;
      if (typeof n !== "number" || !Number.isFinite(n)) return { ok: false, error: "Value must be a finite number." };
      if (definition?.minimum !== undefined && n < definition.minimum) return { ok: false, error: "Value is below the approved setting range." };
      if (definition?.maximum !== undefined && n > definition.maximum) return { ok: false, error: "Value is above the approved setting range." };
      if (key === "loyalty.conversion_points" || key === "welcome.store.valid_days" || key === "loyalty.points_per_zar") {
        if (!Number.isSafeInteger(n)) return { ok: false, error: "This setting must be a whole number." };
      }
      if (key?.startsWith("welcome.store.") || key?.startsWith("loyalty.") || key === "referral.reward_zar") {
        const decimalText = typeof value === "string" ? trimmed : n.toString();
        if (/e/i.test(decimalText) || (decimalText.split(".")[1]?.length ?? 0) > 2) {
          return { ok: false, error: "Commercial amounts must use no more than two decimal places." };
        }
      }
      return { ok: true, value: n };
    }

    case SystemSettingType.BOOLEAN:
      if (typeof value === "boolean") return { ok: true, value };
      if (value === "true") return { ok: true, value: true };
      if (value === "false") return { ok: true, value: false };
      return { ok: false, error: "Value must be true or false." };

    case SystemSettingType.JSON: {
      let parsed: unknown = value;
      if (typeof value === "string") {
        try { parsed = JSON.parse(value); }
        catch { return { ok: false, error: "Value must be valid JSON." }; }
      }
      if (key === "delivery.high_risk_areas") {
        const riskAreas = parseHighRiskAreas(parsed);
        if (!riskAreas) return { ok: false, error: "Each high-risk area requires unique ID, named locations, area notes, and enabled status." };
        return { ok: true, value: riskAreas };
      }
      if (typeof parsed === "object" && parsed !== null) return { ok: true, value: parsed };
      return { ok: false, error: "Value must be a valid JSON object." };
    }

    default:
      return { ok: false, error: "Unknown setting type." };
  }
}

export const SettingValueUpdateSchema = z.object({
  value: z.unknown(),
});

export type SettingValueUpdateInput = z.infer<typeof SettingValueUpdateSchema>;
