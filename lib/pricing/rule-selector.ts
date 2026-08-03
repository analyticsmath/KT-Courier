import type { PricingRule, Prisma } from "@/types/db";
import { pricingError } from "./errors";

export function selectPricingRule(args: {
  rules: PricingRule[];
  deliveryType: PricingRule["deliveryType"];
  regionId: string | null;
  vehicleClass: PricingRule["vehicleClass"];
  weightKg: Prisma.Decimal | null;
  distanceKm: Prisma.Decimal;
  now: Date;
}): PricingRule {
  const candidates = args.rules.filter((rule) => {
    if (!rule.active || rule.archivedAt || rule.currency !== "ZAR") return false;
    if (rule.deliveryType && rule.deliveryType !== args.deliveryType) return false;
    if (rule.effectiveFrom && rule.effectiveFrom > args.now) return false;
    if (rule.effectiveTo && rule.effectiveTo <= args.now) return false;
    if (rule.regionId && rule.regionId !== args.regionId) return false;
    if (!rule.regionId && args.regionId && !rule.allowGlobalFallback) return false;
    if (rule.vehicleClass && rule.vehicleClass !== args.vehicleClass) return false;
    if (rule.maxDistanceKm && args.distanceKm.greaterThan(rule.maxDistanceKm)) return false;
    if (rule.maximumWeightKg && (!args.weightKg || args.weightKg.greaterThan(rule.maximumWeightKg))) return false;
    return true;
  });
  if (!candidates.length) throw pricingError.noRule();
  const ordered = [...candidates].sort((a, b) => {
    const specificity = (r: PricingRule) => ({
      region: r.regionId ? 1 : 0,
      vehicle: r.vehicleClass ? 1 : 0,
      weight: r.maximumWeightKg ? 1 : 0,
    });
    const left = specificity(a);
    const right = specificity(b);
    return right.region - left.region
      || right.vehicle - left.vehicle
      || right.weight - left.weight
      || b.priority - a.priority
      || (b.effectiveFrom?.getTime() ?? 0) - (a.effectiveFrom?.getTime() ?? 0)
      || b.revision - a.revision
      || a.id.localeCompare(b.id);
  });
  const [winner, runnerUp] = ordered;
  const rank = (r: PricingRule) => `${r.regionId ? 1 : 0}:${r.vehicleClass ? 1 : 0}:${r.maximumWeightKg ? 1 : 0}:${r.priority}:${r.effectiveFrom?.toISOString() ?? ""}:${r.revision}`;
  if (runnerUp && rank(winner) === rank(runnerUp)) throw pricingError.ambiguous();
  return winner;
}
