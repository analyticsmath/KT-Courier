import { Prisma, PricingQuoteOwnerType, PricingQuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuthenticatedUser } from "@/types/domain";
import { calculateRoute } from "@/lib/maps/routes.service";
import { checkDeliveryZone, matchRegionByCity } from "@/lib/maps/delivery-zone.service";
import { calculateDeliveryPrice } from "@/lib/pricing/calculator";
import { getPricingConfiguration, PRICING_CALCULATION_VERSION } from "@/lib/pricing/config";
import { pricingError } from "@/lib/pricing/errors";
import { hashPricingInput, pricingInputSnapshot } from "@/lib/pricing/input-hash";
import { Decimal } from "@/lib/pricing/money";
import { selectPricingRule } from "@/lib/pricing/rule-selector";
import type { NormalizedPricingInput, PricingRuleSnapshot } from "@/lib/pricing/types";
import type { PricingQuoteRequestInput } from "@/lib/validation/pricing";
import { activeCommercialSurcharges, commercialSurchargeSnapshot } from "@/lib/commercial/configuration.service";

async function ownerFor(user: AuthenticatedUser) {
  if (user.role === "CUSTOMER") return { ownerType: PricingQuoteOwnerType.CUSTOMER, ownerId: user.id, storeId: null };
  if (user.role === "STORE") {
    const store = await prisma.store.findFirst({ where: { ownerUserId: user.id }, select: { id: true } });
    if (!store) throw new Error("No store found for this account.");
    return { ownerType: PricingQuoteOwnerType.STORE, ownerId: user.id, storeId: store.id };
  }
  throw new Error("Only customers and store accounts can request pricing quotes.");
}

async function regionFor(address: PricingQuoteRequestInput["dropoffAddress"]) {
  if (address.latitude !== undefined && address.longitude !== undefined) {
    const zone = await checkDeliveryZone(address.latitude, address.longitude);
    if (zone.regionId) return zone.regionId;
  }
  return (await matchRegionByCity(address.city ?? null, address.province ?? null)).regionId;
}

function snapshotRule(rule: PricingRuleSnapshot) {
  return Object.fromEntries(Object.entries(rule).map(([key, value]) => [key, value instanceof Decimal ? value.toString() : value]));
}

/** Orchestrates trusted route data, deterministic rule selection, and quote persistence. */
export async function createPricingQuoteForTrustedOwner(
  owner: Readonly<{ ownerType: PricingQuoteOwnerType; ownerId: string; storeId: string | null }>,
  input: PricingQuoteRequestInput,
) {
  const coordinates = [input.pickupAddress.latitude, input.pickupAddress.longitude, input.dropoffAddress.latitude, input.dropoffAddress.longitude];
  if (coordinates.some((value) => value === null)) throw pricingError.route();
  const route = await calculateRoute(coordinates[0]!, coordinates[1]!, coordinates[2]!, coordinates[3]!);
  if (!route.ok || route.route.distanceMeters <= 0) throw pricingError.route();
  const [originRegionId, destinationRegionId, config] = await Promise.all([regionFor(input.pickupAddress), regionFor(input.dropoffAddress), getPricingConfiguration()]);
  const regions = await prisma.deliveryRegion.findMany({ where: { id: { in: [originRegionId, destinationRegionId].filter((id): id is string => !!id) }, active: true }, select: { id: true, highRiskSurcharge: true, pricingEnabled: true } });
  const byId = new Map(regions.map((region) => [region.id, region]));
  const destination = destinationRegionId ? byId.get(destinationRegionId) ?? null : null;
  if (destination && !destination.pricingEnabled) throw pricingError.noRule();
  const normalized: NormalizedPricingInput = { deliveryType: input.deliveryType, distanceMeters: route.route.distanceMeters, durationSeconds: route.route.durationSeconds, vehicleClass: input.vehicleClass ?? null, actualWeightKg: input.actualWeightKg ? new Decimal(input.actualWeightKg) : null, lengthCm: input.lengthCm ? new Decimal(input.lengthCm) : null, widthCm: input.widthCm ? new Decimal(input.widthCm) : null, heightCm: input.heightCm ? new Decimal(input.heightCm) : null };
  const rules = await prisma.pricingRule.findMany({ where: { active: true, archivedAt: null, currency: "ZAR", OR: [{ regionId: destinationRegionId }, { regionId: null }] } });
  const rawDistanceKm = new Decimal(route.route.distanceMeters.toString()).div("1000");
  const selected = selectPricingRule({ rules, deliveryType: normalized.deliveryType, regionId: destinationRegionId, vehicleClass: normalized.vehicleClass, weightKg: normalized.actualWeightKg, distanceKm: rawDistanceKm, now: new Date() });
  const rule: PricingRuleSnapshot = { id: selected.id, revision: selected.revision, currency: "ZAR", deliveryType: selected.deliveryType, regionId: selected.regionId, baseFee: selected.baseFee, perKmRate: selected.perKmRate, includedDistanceKm: selected.includedDistanceKm, distanceIncrementKm: selected.distanceIncrementKm, minimumCharge: selected.minimumCharge, flatSurcharge: selected.flatSurcharge, vehicleClass: selected.vehicleClass, vehicleSurcharge: selected.vehicleSurcharge, includedWeightKg: selected.includedWeightKg, perAdditionalKgRate: selected.perAdditionalKgRate, maximumWeightKg: selected.maximumWeightKg, weightIncrementKg: selected.weightIncrementKg, dimensionalPricingEnabled: selected.dimensionalPricingEnabled, volumetricDivisor: selected.volumetricDivisor, maxDistanceKm: selected.maxDistanceKm };
  const configuredSurcharges = await activeCommercialSurcharges({ serviceKey: input.deliveryType, regionId: destinationRegionId });
  const calculation = calculateDeliveryPrice({ input: normalized, rule, regionContext: { origin: originRegionId ? byId.get(originRegionId) ?? null : null, destination }, taxConfig: config.tax, calculationVersion: PRICING_CALCULATION_VERSION, configuredSurcharges });
  const inputSnapshot = pricingInputSnapshot(input);
  const expiresAt = new Date(Date.now() + config.quoteTtlMinutes * 60_000);
  const quote = await prisma.pricingQuote.create({ data: { ...owner, deliveryType: input.deliveryType, currency: "ZAR", calculationVersion: PRICING_CALCULATION_VERSION, inputHash: hashPricingInput(inputSnapshot), distanceMeters: route.route.distanceMeters, durationSeconds: route.route.durationSeconds, routeProvider: route.route.provider, originRegionId, destinationRegionId, ruleId: selected.id, rawDistanceKm: calculation.rawDistanceKm, billableDistanceKm: calculation.billableDistanceKm, subtotal: calculation.subtotal, taxRate: calculation.taxRate, taxAmount: calculation.taxAmount, total: calculation.total, inputSnapshot: inputSnapshot as Prisma.InputJsonValue, ruleSnapshot: snapshotRule(rule) as Prisma.InputJsonValue, regionSnapshot: { originRegionId, destinationRegionId, highRiskRegionIds: calculation.lineItems.find((item) => item.code === "HIGH_RISK_SURCHARGE")?.metadata?.triggeringRegionIds ?? [] } as Prisma.InputJsonValue, taxSnapshot: { enabled: config.tax.enabled, rate: calculation.taxRate.toString(), amount: calculation.taxAmount.toFixed(2), source: config.tax.source } as Prisma.InputJsonValue, metadata: { routeSummary: route.route.routeSummary, commercialSurcharges: commercialSurchargeSnapshot(configuredSurcharges) } as Prisma.InputJsonValue, expiresAt, lineItems: { create: calculation.lineItems.map((item) => ({ code: item.code, label: item.label, quantity: item.quantity, unitRate: item.unitRate, amount: item.amount, currency: "ZAR", metadata: (item.metadata ?? undefined) as Prisma.InputJsonValue | undefined })) } }, include: { lineItems: true } });
  return toQuoteDto(quote);
}

/** Public Phase 6 entry point retained for existing customer and store APIs. */
export async function createPricingQuote(user: AuthenticatedUser, input: PricingQuoteRequestInput) {
  return createPricingQuoteForTrustedOwner(await ownerFor(user), input);
}

export function toQuoteDto(quote: { id: string; currency: string; expiresAt: Date; distanceMeters: number; durationSeconds: number | null; subtotal: Prisma.Decimal; taxAmount: Prisma.Decimal; taxRate: Prisma.Decimal; total: Prisma.Decimal; lineItems: { code: string; label: string; quantity: Prisma.Decimal | null; unitRate: Prisma.Decimal | null; amount: Prisma.Decimal }[] }) {
  return { id: quote.id, currency: quote.currency, expiresAt: quote.expiresAt, distanceMeters: quote.distanceMeters, durationSeconds: quote.durationSeconds, subtotal: quote.subtotal.toFixed(2), taxRate: quote.taxRate.toFixed(4), taxAmount: quote.taxAmount.toFixed(2), total: quote.total.toFixed(2), lineItems: quote.lineItems.map((item) => ({ code: item.code, label: item.label, quantity: item.quantity?.toString() ?? null, unitRate: item.unitRate?.toString() ?? null, amount: item.amount.toFixed(2) })) };
}

export async function ownedActiveQuoteForOrder(tx: Prisma.TransactionClient, user: AuthenticatedUser, quoteId: string, inputHash: string) {
  const owner = user.role === "CUSTOMER" ? { ownerType: PricingQuoteOwnerType.CUSTOMER, ownerId: user.id } : { ownerType: PricingQuoteOwnerType.STORE, ownerId: user.id };
  const quote = await tx.pricingQuote.findFirst({ where: { id: quoteId, ...owner }, include: { lineItems: true } });
  if (!quote) throw pricingError.quoteOwner();
  if (quote.status === PricingQuoteStatus.USED) throw pricingError.quoteUsed();
  if (quote.status !== PricingQuoteStatus.ACTIVE || quote.expiresAt <= new Date()) throw pricingError.quoteExpired();
  if (quote.inputHash !== inputHash) throw pricingError.quoteInput();
  const claimed = await tx.pricingQuote.updateMany({ where: { id: quoteId, status: PricingQuoteStatus.ACTIVE, expiresAt: { gt: new Date() } }, data: { status: PricingQuoteStatus.USED, usedAt: new Date() } });
  if (claimed.count !== 1) throw pricingError.quoteUsed();
  return quote;
}
