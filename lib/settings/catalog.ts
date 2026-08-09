import { SystemSettingType } from "@/types/db";

export type SettingSensitivity = "PUBLIC" | "INTERNAL";
export type SettingMutability = "MUTABLE" | "READ_ONLY";

export interface SystemSettingDefinition {
  key: string;
  type: SystemSettingType;
  safeDefault: string | number | boolean;
  sensitivity: SettingSensitivity;
  mutability: SettingMutability;
  requiredPermission: "settings.update";
  restartRequired: boolean;
  readinessImpact?: string;
  minimum?: number;
  maximum?: number;
  allowedValues?: readonly string[];
}

const mutable = (key: string, type: SystemSettingType, safeDefault: string | number | boolean, options: Partial<SystemSettingDefinition> = {}): SystemSettingDefinition => ({
  key, type, safeDefault, sensitivity: "INTERNAL", mutability: "MUTABLE", requiredPermission: "settings.update", restartRequired: false, ...options,
});

export const SYSTEM_SETTING_CATALOG: Record<string, SystemSettingDefinition> = {
  "platform.name": mutable("platform.name", SystemSettingType.STRING, "KT Couriers", { sensitivity: "PUBLIC" }),
  "platform.contact_email": mutable("platform.contact_email", SystemSettingType.STRING, "support@example.invalid", { sensitivity: "PUBLIC" }),
  "platform.operating_hours": mutable("platform.operating_hours", SystemSettingType.STRING, "Unavailable", { sensitivity: "PUBLIC" }),
  "orders.require_confirmation": mutable("orders.require_confirmation", SystemSettingType.BOOLEAN, true),
  "orders.default_currency": mutable("orders.default_currency", SystemSettingType.STRING, "ZAR", { allowedValues: ["ZAR"] }),
  "orders.max_parcel_count": mutable("orders.max_parcel_count", SystemSettingType.NUMBER, 10, { minimum: 1, maximum: 100 }),
  "pricing.vat.enabled": mutable("pricing.vat.enabled", SystemSettingType.BOOLEAN, false),
  "pricing.vat.rate": mutable("pricing.vat.rate", SystemSettingType.STRING, "0.1500"),
  "pricing.quote_ttl_minutes": mutable("pricing.quote_ttl_minutes", SystemSettingType.STRING, "15"),
  "dispatch.assignment_offer_ttl_minutes": mutable("dispatch.assignment_offer_ttl_minutes", SystemSettingType.STRING, "10"),
  "dispatch.policy_version": mutable("dispatch.policy_version", SystemSettingType.STRING, "dispatch-v1"),
  "dispatch.default_driver_capacity": mutable("dispatch.default_driver_capacity", SystemSettingType.STRING, "1"),
  "dispatch.serializable_retry_count": mutable("dispatch.serializable_retry_count", SystemSettingType.STRING, "3"),
  "notifications.email_enabled": mutable("notifications.email_enabled", SystemSettingType.BOOLEAN, false, { readinessImpact: "transactional_email" }),
  "coverage.confirmation_required": mutable("coverage.confirmation_required", SystemSettingType.BOOLEAN, true),
};

export function getSystemSettingDefinition(key: string): SystemSettingDefinition | null {
  return SYSTEM_SETTING_CATALOG[key] ?? null;
}
