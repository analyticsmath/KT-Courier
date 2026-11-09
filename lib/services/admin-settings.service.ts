import { prisma } from "@/lib/db/prisma";
import { createHash } from "node:crypto";
import { withLedgerRetry } from "@/lib/ledger/retry";
import { Prisma } from "@prisma/client";
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

/** Financial and delivery-risk settings must commit their audit receipt atomically.
 * Store SHA-256 digests, never sensitive raw policy values, in the activity log.
 */
function requiresAtomicPolicyAudit(key: string): boolean {
  return key.startsWith("loyalty.")
    || key.startsWith("welcome.store.")
    || key === "referral.reward_zar"
    || key === "referral.reward_issuing_enabled"
    || key === "delivery.high_risk_areas"
    || key === "pricing.vat.enabled" || key === "pricing.vat.rate"
    || key === "pricing.marketplace_vat.enabled" || key === "pricing.marketplace_vat.rate";
}

function valueDigest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

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

  if (requiresAtomicPolicyAudit(key)) {
    return withLedgerRetry(() => prisma.$transaction(async (tx) => {
      const actor = await tx.user.findFirst({
        where: { id: actorUserId, role: { in: ["ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE" },
        select: { id: true },
      });
      if (!actor) return { error: "An active authorized administrator is required." };
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SystemSetting" WHERE "key" = ${key} FOR UPDATE`);
      const stored = await tx.systemSetting.findUnique({ where: { key } });
      if (!stored || stored.type !== definition.type) return { error: "Setting type or availability changed. Refresh settings." };
      const currentValue = validateSettingValue(stored.type, rawValue, key);
      if (!currentValue.ok) return { error: currentValue.error };
      const updated = await tx.systemSetting.update({
        where: { key },
        data: { value: currentValue.value as Prisma.InputJsonValue },
      });
      await tx.adminActivityLog.create({
        data: {
          actorUserId,
          action: AdminActionType.UPDATE,
          entityType: "SystemSetting",
          entityId: stored.id,
          message: `Updated governed policy setting ${key}.`,
          metadata: {
            key,
            previousValueDigest: valueDigest(stored.value),
            newValueDigest: valueDigest(currentValue.value),
          },
        },
      });
      return { setting: toSystemSettingDto(updated) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
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
