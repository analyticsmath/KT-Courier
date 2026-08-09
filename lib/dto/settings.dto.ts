import type { SystemSetting } from "@/types/db";
import type { SystemSettingType } from "@/types/db";
import { getSystemSettingDefinition, type SettingMutability, type SettingSensitivity } from "@/lib/settings/catalog";

// ─── DTO ──────────────────────────────────────────────────────────────────────

export interface SystemSettingDto {
  id: string;
  key: string;
  label: string;
  type: SystemSettingType;
  value: unknown;
  description: string | null;
  updatedAt: Date;
  sensitivity: SettingSensitivity;
  mutability: SettingMutability;
  restartRequired: boolean;
  readinessImpact: string | null;
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

export function toSystemSettingDto(setting: SystemSetting): SystemSettingDto {
  const definition = getSystemSettingDefinition(setting.key);
  return {
    id: setting.id,
    key: setting.key,
    label: setting.label,
    type: setting.type,
    value: definition ? setting.value : "[UNAVAILABLE]",
    description: setting.description,
    updatedAt: setting.updatedAt,
    sensitivity: definition?.sensitivity ?? "INTERNAL",
    mutability: definition?.mutability ?? "READ_ONLY",
    restartRequired: definition?.restartRequired ?? false,
    readinessImpact: definition?.readinessImpact ?? null,
  };
}
