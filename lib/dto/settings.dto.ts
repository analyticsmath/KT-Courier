import type { SystemSetting } from "@/types/db";
import type { SystemSettingType } from "@/types/db";

// ─── DTO ──────────────────────────────────────────────────────────────────────

export interface SystemSettingDto {
  id: string;
  key: string;
  label: string;
  type: SystemSettingType;
  value: unknown;
  description: string | null;
  updatedAt: Date;
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

export function toSystemSettingDto(setting: SystemSetting): SystemSettingDto {
  return {
    id: setting.id,
    key: setting.key,
    label: setting.label,
    type: setting.type,
    value: setting.value,
    description: setting.description,
    updatedAt: setting.updatedAt,
  };
}
