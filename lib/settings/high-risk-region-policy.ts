import { Prisma, SystemSettingType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hasHighRiskCashAreaSnapshot } from "@/lib/settings/high-risk-area-policy";

export const HIGH_RISK_REGION_IDS_SETTING_KEY = "delivery.high_risk_region_ids";
type HighRiskSettingDb = Pick<Prisma.TransactionClient, "systemSetting">;

export function parseHighRiskRegionIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) return null;
    const id = item.trim();
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

export async function getHighRiskRegionIds(db: HighRiskSettingDb = prisma): Promise<string[]> {
  const setting = await db.systemSetting.findUnique({
    where: { key: HIGH_RISK_REGION_IDS_SETTING_KEY },
    select: { type: true, value: true },
  });
  if (!setting) return [];
  if (setting.type !== SystemSettingType.JSON) throw new Error("High-risk delivery region setting must use JSON type.");
  const ids = parseHighRiskRegionIds(setting.value);
  if (!ids) throw new Error("High-risk delivery region setting must contain an array of region IDs.");
  return ids;
}

export async function setDeliveryRegionHighRisk(
  db: HighRiskSettingDb,
  regionId: string,
  highRisk: boolean,
): Promise<boolean> {
  const current = await getHighRiskRegionIds(db);
  const next = highRisk
    ? [...new Set([...current, regionId])]
    : current.filter((id) => id !== regionId);
  await db.systemSetting.upsert({
    where: { key: HIGH_RISK_REGION_IDS_SETTING_KEY },
    update: { type: SystemSettingType.JSON, value: next as Prisma.InputJsonValue },
    create: {
      key: HIGH_RISK_REGION_IDS_SETTING_KEY,
      label: "High-risk delivery regions",
      type: SystemSettingType.JSON,
      value: next as Prisma.InputJsonValue,
    },
  });
  return next.includes(regionId);
}

export function hasHighRiskRegion(
  originRegionId: string | null | undefined,
  destinationRegionId: string | null | undefined,
  highRiskRegionIds: readonly string[],
): boolean {
  return [originRegionId, destinationRegionId].some(
    (id) => typeof id === "string" && highRiskRegionIds.includes(id),
  );
}

export function isHighRiskCashPolicyEvidence(evidence: unknown): boolean {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return false;
  const record = evidence as Record<string, unknown>;
  if (hasHighRiskCashAreaSnapshot(record)) return true;
  // The marketplace courier bridge stores a frozen plan wrapper rather than
  // the flattened policy snapshot; never lose the original cash restriction.
  if (record.policyEvidence && typeof record.policyEvidence === "object"
    && !Array.isArray(record.policyEvidence)) {
    const nested = record.policyEvidence as Record<string, unknown>;
    if (hasHighRiskCashAreaSnapshot(nested)) return true;
    const nestedIds = parseHighRiskRegionIds(nested.highRiskRegionIdsAtDecision);
    if (nestedIds === null && (nested.originRegionId || nested.destinationRegionId)) return true;
    if (nestedIds && hasHighRiskRegion(
      typeof nested.originRegionId === "string" ? nested.originRegionId : null,
      typeof nested.destinationRegionId === "string" ? nested.destinationRegionId : null, nestedIds)) return true;
  }
  const origin = typeof record.originRegionId === "string" ? record.originRegionId : null;
  const destination = typeof record.destinationRegionId === "string" ? record.destinationRegionId : null;
  const regionIds = parseHighRiskRegionIds(record.highRiskRegionIdsAtDecision);
  // Region evidence without a valid risk snapshot cannot authorise a cash obligation.
  if (regionIds === null) return Boolean(origin || destination);
  return hasHighRiskRegion(origin, destination, regionIds);
}
