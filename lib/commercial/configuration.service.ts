import { CommercialSurchargeCalculationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type AppliedCommercialSurcharge = Readonly<{
  id: string;
  stableKey: string;
  versionNumber: number;
  calculationType: CommercialSurchargeCalculationType;
  value: Prisma.Decimal;
  reason: string;
  customerMessage: string | null;
  priority: number;
}>;

function hasScope(scope: unknown, value: string | null | undefined) {
  if (!Array.isArray(scope) || scope.length === 0) return true;
  return !!value && scope.some((entry) => entry === value);
}

/** Returns only effective, enabled surcharges; it never modifies their base pricing rule. */
export async function activeCommercialSurcharges(input: {
  serviceKey?: string | null;
  moduleId?: string | null;
  regionId?: string | null;
  now?: Date;
}): Promise<AppliedCommercialSurcharge[]> {
  const now = input.now ?? new Date();
  const candidates = await prisma.commercialSurcharge.findMany({
    where: {
      enabled: true,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    orderBy: [{ priority: "asc" }, { stableKey: "asc" }, { versionNumber: "desc" }],
  });
  return candidates
    .filter((surcharge) => hasScope(surcharge.serviceScope, input.serviceKey))
    .filter((surcharge) => hasScope(surcharge.moduleScope, input.moduleId))
    .filter((surcharge) => hasScope(surcharge.regionScope, input.regionId))
    .map((surcharge) => ({
      id: surcharge.id,
      stableKey: surcharge.stableKey,
      versionNumber: surcharge.versionNumber,
      calculationType: surcharge.calculationType,
      value: surcharge.value,
      reason: surcharge.reason,
      customerMessage: surcharge.customerMessage,
      priority: surcharge.priority,
    }));
}

/** JSON-safe evidence to persist with an accepted quote/order. */
export function commercialSurchargeSnapshot(surcharges: readonly AppliedCommercialSurcharge[]) {
  return surcharges.map((surcharge) => ({
    id: surcharge.id,
    stableKey: surcharge.stableKey,
    versionNumber: surcharge.versionNumber,
    calculationType: surcharge.calculationType,
    value: surcharge.value.toString(),
    reason: surcharge.reason,
    customerMessage: surcharge.customerMessage,
    priority: surcharge.priority,
  }));
}
