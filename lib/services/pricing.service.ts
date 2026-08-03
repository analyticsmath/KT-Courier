import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import type { PricingRule } from "@/types/db";
import { toPricingRuleDto, type PricingRuleDto } from "@/lib/dto/order.dto";
import type { PricingRuleCreateInput, PricingRuleUpdateInput } from "@/lib/validation/pricing";

function sameNullableDecimal(left: Prisma.Decimal | null, right: Prisma.Decimal | null) {
  return left === null ? right === null : right !== null && left.equals(right);
}

function windowsOverlap(
  leftFrom: Date | null,
  leftTo: Date | null,
  rightFrom: Date | null,
  rightTo: Date | null
) {
  return (leftFrom === null || rightTo === null || leftFrom < rightTo)
    && (rightFrom === null || leftTo === null || rightFrom < leftTo);
}

async function assertNoConflictingRule(
  tx: Prisma.TransactionClient,
  candidate: Pick<PricingRule, "id" | "deliveryType" | "regionId" | "vehicleClass" | "maximumWeightKg" | "priority" | "effectiveFrom" | "effectiveTo">,
  excludeId?: string
) {
  const rules = await tx.pricingRule.findMany({
    where: { active: true, archivedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, deliveryType: true, regionId: true, vehicleClass: true, maximumWeightKg: true, priority: true, effectiveFrom: true, effectiveTo: true },
  });
  const conflict = rules.find((rule) =>
    rule.deliveryType === candidate.deliveryType
    && rule.regionId === candidate.regionId
    && rule.vehicleClass === candidate.vehicleClass
    && sameNullableDecimal(rule.maximumWeightKg, candidate.maximumWeightKg)
    && rule.priority === candidate.priority
    && windowsOverlap(rule.effectiveFrom, rule.effectiveTo, candidate.effectiveFrom, candidate.effectiveTo)
  );
  if (conflict) throw new Error("PRICING_RULE_CONFLICT");
}

// ─── Rule fetching ────────────────────────────────────────────────────────────

export async function getActivePricingRules(): Promise<PricingRule[]> {
  return prisma.pricingRule.findMany({
    where: { active: true },
    orderBy: [{ deliveryType: "asc" }, { createdAt: "asc" }],
  });
}

export async function getAllPricingRules(): Promise<PricingRuleDto[]> {
  const rules = await prisma.pricingRule.findMany({
    orderBy: [{ active: "desc" }, { deliveryType: "asc" }, { createdAt: "asc" }],
  });
  return rules.map(toPricingRuleDto);
}

// ─── Admin CRUD ───────────────────────────────────────────────────────────────

export async function createPricingRule(input: PricingRuleCreateInput): Promise<PricingRuleDto> {
  return prisma.$transaction(async (tx) => {
    const candidate = {
      id: "new",
      deliveryType: input.deliveryType ?? null,
      regionId: input.regionId ?? null,
      vehicleClass: input.vehicleClass ?? null,
      maximumWeightKg: input.maximumWeightKg === null || input.maximumWeightKg === undefined ? null : new Prisma.Decimal(input.maximumWeightKg),
      priority: input.priority,
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
      effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
    };
    await assertNoConflictingRule(tx, candidate);
    const rule = await tx.pricingRule.create({ data: {
      name: input.name,
      type: input.type,
      deliveryType: input.deliveryType ?? null,
      amount: input.amount,
      baseFee: input.baseFee ?? input.amount,
      perKmRate: input.perKmRate,
      includedDistanceKm: input.includedDistanceKm,
      distanceIncrementKm: input.distanceIncrementKm,
      minimumCharge: input.minimumCharge ?? null,
      flatSurcharge: input.flatSurcharge ?? null,
      vehicleClass: input.vehicleClass ?? null,
      vehicleSurcharge: input.vehicleSurcharge ?? null,
      includedWeightKg: input.includedWeightKg ?? null,
      perAdditionalKgRate: input.perAdditionalKgRate ?? null,
      maximumWeightKg: input.maximumWeightKg ?? null,
      weightIncrementKg: input.weightIncrementKg ?? null,
      dimensionalPricingEnabled: input.dimensionalPricingEnabled,
      volumetricDivisor: input.volumetricDivisor ?? null,
      maxDistanceKm: input.maxDistanceKm ?? null,
      allowGlobalFallback: input.allowGlobalFallback,
      priority: input.priority,
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
      effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
      currency: input.currency,
      regionId: input.regionId ?? null,
      description: input.description ?? null,
      active: input.active ?? true,
    } });
    await tx.pricingAuditLog.create({ data: { ruleId: rule.id, calculatedAmount: rule.baseFee, currency: rule.currency, breakdown: { action: "CREATE", revision: rule.revision } as Prisma.InputJsonValue } });
    return toPricingRuleDto(rule);
  });
}

export async function updatePricingRule(
  id: string,
  input: PricingRuleUpdateInput
): Promise<PricingRuleDto | null> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.pricingRule.findUnique({ where: { id } });
    if (!existing) return null;
    if (input.expectedRevision !== existing.revision) throw new Error("PRICING_RULE_STALE");
    const candidate = {
      id,
      deliveryType: input.deliveryType === undefined ? existing.deliveryType : input.deliveryType ?? null,
      regionId: input.regionId === undefined ? existing.regionId : input.regionId ?? null,
      vehicleClass: input.vehicleClass === undefined ? existing.vehicleClass : input.vehicleClass ?? null,
      maximumWeightKg: input.maximumWeightKg === undefined
        ? existing.maximumWeightKg
        : input.maximumWeightKg === null
          ? null
          : new Prisma.Decimal(input.maximumWeightKg),
      priority: input.priority ?? existing.priority,
      effectiveFrom: input.effectiveFrom === undefined ? existing.effectiveFrom : input.effectiveFrom ? new Date(input.effectiveFrom) : null,
      effectiveTo: input.effectiveTo === undefined ? existing.effectiveTo : input.effectiveTo ? new Date(input.effectiveTo) : null,
    };
    await assertNoConflictingRule(tx, candidate, id);
    const rule = await tx.pricingRule.update({ where: { id }, data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.deliveryType !== undefined && { deliveryType: input.deliveryType ?? null }),
      ...(input.amount !== undefined && { amount: input.amount }),
      ...(input.baseFee !== undefined && { baseFee: input.baseFee }),
      ...(input.perKmRate !== undefined && { perKmRate: input.perKmRate }),
      ...(input.includedDistanceKm !== undefined && { includedDistanceKm: input.includedDistanceKm }),
      ...(input.distanceIncrementKm !== undefined && { distanceIncrementKm: input.distanceIncrementKm }),
      ...(input.minimumCharge !== undefined && { minimumCharge: input.minimumCharge }),
      ...(input.flatSurcharge !== undefined && { flatSurcharge: input.flatSurcharge }),
      ...(input.vehicleClass !== undefined && { vehicleClass: input.vehicleClass }),
      ...(input.vehicleSurcharge !== undefined && { vehicleSurcharge: input.vehicleSurcharge }),
      ...(input.includedWeightKg !== undefined && { includedWeightKg: input.includedWeightKg }),
      ...(input.perAdditionalKgRate !== undefined && { perAdditionalKgRate: input.perAdditionalKgRate }),
      ...(input.maximumWeightKg !== undefined && { maximumWeightKg: input.maximumWeightKg }),
      ...(input.weightIncrementKg !== undefined && { weightIncrementKg: input.weightIncrementKg }),
      ...(input.dimensionalPricingEnabled !== undefined && { dimensionalPricingEnabled: input.dimensionalPricingEnabled }),
      ...(input.volumetricDivisor !== undefined && { volumetricDivisor: input.volumetricDivisor }),
      ...(input.maxDistanceKm !== undefined && { maxDistanceKm: input.maxDistanceKm }),
      ...(input.allowGlobalFallback !== undefined && { allowGlobalFallback: input.allowGlobalFallback }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.effectiveFrom !== undefined && { effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null }),
      ...(input.effectiveTo !== undefined && { effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null }),
      revision: { increment: 1 },
      ...(input.currency !== undefined && { currency: input.currency }),
      ...(input.regionId !== undefined && { regionId: input.regionId ?? null }),
      ...(input.description !== undefined && { description: input.description ?? null }),
      ...(input.active !== undefined && { active: input.active }),
    } });
    await tx.pricingAuditLog.create({ data: { ruleId: id, calculatedAmount: rule.baseFee, currency: rule.currency, breakdown: { action: "UPDATE", reason: input.changeReason, previousRevision: existing.revision, newRevision: rule.revision, previous: toPricingRuleDto(existing), next: toPricingRuleDto(rule) } as unknown as Prisma.InputJsonValue } });
    return toPricingRuleDto(rule);
  });
}

export async function deactivatePricingRule(id: string, expectedRevision: number, changeReason: string): Promise<PricingRuleDto | null> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.pricingRule.findUnique({ where: { id } });
    if (!existing) return null;
    if (existing.revision !== expectedRevision) throw new Error("PRICING_RULE_STALE");
    const rule = await tx.pricingRule.update({
      where: { id },
      data: { active: false, archivedAt: new Date(), revision: { increment: 1 } },
    });
    await tx.pricingAuditLog.create({ data: { ruleId: id, calculatedAmount: rule.baseFee, currency: rule.currency, breakdown: { action: "ARCHIVE", reason: changeReason, previousRevision: existing.revision, newRevision: rule.revision } as Prisma.InputJsonValue } });
    return toPricingRuleDto(rule);
  });
}
