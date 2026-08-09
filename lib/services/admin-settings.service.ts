import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/types/db";
import {
  toSystemSettingDto,
  type SystemSettingDto,
} from "@/lib/dto/settings.dto";
import {
  validateSettingValue,
  isForbiddenKey,
} from "@/lib/validation/admin-settings";
import { recordAdminActivity } from "./admin-activity.service";
import { AdminActionType } from "@/types/db";
import { getSystemSettingDefinition } from "@/lib/settings/catalog";

// ─── List all settings ────────────────────────────────────────────────────────

export async function listSettings(): Promise<SystemSettingDto[]> {
  const settings = await prisma.systemSetting.findMany({
    orderBy: { key: "asc" },
  });
  return settings.map(toSystemSettingDto);
}

// ─── Get single setting ───────────────────────────────────────────────────────

export async function getSettingByKey(
  key: string
): Promise<SystemSettingDto | null> {
  const setting = await prisma.systemSetting.findUnique({ where: { key } });
  return setting ? toSystemSettingDto(setting) : null;
}

// ─── Update setting value ─────────────────────────────────────────────────────

export async function updateSettingValue(
  actorUserId: string,
  key: string,
  rawValue: unknown
): Promise<{ setting: SystemSettingDto } | { error: string }> {
  // Refuse forbidden keys
  if (isForbiddenKey(key)) {
    return { error: "This setting key is not allowed." };
  }

  const existing = await prisma.systemSetting.findUnique({ where: { key } });
  if (!existing) {
    return { error: "Setting not found." };
  }

  const definition = getSystemSettingDefinition(key);
  if (!definition || definition.mutability !== "MUTABLE") {
    return { error: "This setting is not mutable through administrative settings." };
  }

  const validated = validateSettingValue(existing.type, rawValue, key);
  if (!validated.ok) {
    return { error: validated.error };
  }

  const updated = await prisma.systemSetting.update({
    where: { key },
    data: { value: validated.value as Prisma.InputJsonValue },
  });

  await recordAdminActivity({
    actorUserId,
    action: AdminActionType.UPDATE,
    entityType: "SystemSetting",
    entityId: existing.id,
    message: `Updated system setting "${existing.label}" (${key}).`,
    metadata: { key },
  });

  return { setting: toSystemSettingDto(updated) };
}
