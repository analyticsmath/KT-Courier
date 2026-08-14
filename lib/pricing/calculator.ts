import type { Prisma } from "@/types/db";
import { PricingLineItemCode } from "@/types/db";
import { pricingError } from "./errors";
import { Decimal, ZERO, assertNonNegative, roundMoney } from "./money";
import type {
  NormalizedPricingInput,
  PricingCalculationLineItem,
  PricingCalculationResult,
  PricingRegionContext,
  PricingRuleSnapshot,
  PricingTaxConfig,
} from "./types";
import type { AppliedCommercialSurcharge } from "@/lib/commercial/configuration.service";

function ceilToIncrement(value: Prisma.Decimal, increment: Prisma.Decimal): Prisma.Decimal {
  if (increment.lessThanOrEqualTo(ZERO)) throw pricingError.invalidRule("Billing increment must be greater than zero.");
  return value.div(increment).ceil().mul(increment);
}

function line(
  code: PricingLineItemCode,
  label: string,
  amount: Prisma.Decimal,
  quantity: Prisma.Decimal | null = null,
  unitRate: Prisma.Decimal | null = null,
  metadata?: PricingCalculationLineItem["metadata"]
): PricingCalculationLineItem {
  return { code, label, amount: assertNonNegative(roundMoney(amount), label), quantity, unitRate, metadata };
}

/** Pure deterministic calculator. It has no database, request, maps, or environment dependencies. */
export function calculateDeliveryPrice(args: {
  input: NormalizedPricingInput;
  rule: PricingRuleSnapshot;
  regionContext: PricingRegionContext;
  taxConfig: PricingTaxConfig;
  calculationVersion: string;
  configuredSurcharges?: readonly AppliedCommercialSurcharge[];
}): PricingCalculationResult {
  const { input, rule, regionContext, taxConfig } = args;
  if (rule.currency !== "ZAR") throw pricingError.invalidRule("Only ZAR rules are supported.");
  if (!Number.isSafeInteger(input.distanceMeters) || input.distanceMeters <= 0) {
    throw new Error("distanceMeters must be a positive safe integer.");
  }
  const configured = [rule.baseFee, rule.perKmRate, rule.includedDistanceKm, rule.distanceIncrementKm, rule.minimumCharge, rule.flatSurcharge, rule.vehicleSurcharge, rule.includedWeightKg, rule.perAdditionalKgRate, rule.maximumWeightKg, rule.weightIncrementKg, rule.volumetricDivisor, rule.maxDistanceKm];
  configured.filter((value): value is Prisma.Decimal => value !== null).forEach((value) => assertNonNegative(value, "Rule value"));

  const rawDistanceKm = new Decimal(input.distanceMeters.toString()).div("1000");
  if (rule.maxDistanceKm && rawDistanceKm.greaterThan(rule.maxDistanceKm)) throw pricingError.invalidRule("Route exceeds the rule's maximum distance.");
  const excessDistanceKm = Decimal.max(rawDistanceKm.minus(rule.includedDistanceKm), ZERO);
  const billableDistanceKm = ceilToIncrement(excessDistanceKm, rule.distanceIncrementKm);
  const items: PricingCalculationLineItem[] = [line(PricingLineItemCode.BASE_FEE, "Base delivery fee", rule.baseFee)];
  if (billableDistanceKm.greaterThan(ZERO) && rule.perKmRate.greaterThan(ZERO)) {
    items.push(line(PricingLineItemCode.DISTANCE_FEE, "Distance fee", billableDistanceKm.mul(rule.perKmRate), billableDistanceKm, rule.perKmRate, { incrementKm: rule.distanceIncrementKm.toString() }));
  }
  if (rule.flatSurcharge?.greaterThan(ZERO)) items.push(line(PricingLineItemCode.RULE_SURCHARGE, "Delivery surcharge", rule.flatSurcharge));
  const riskRegions = [regionContext.origin, regionContext.destination].filter((r): r is NonNullable<typeof r> => !!r && !!r.highRiskSurcharge?.greaterThan(ZERO));
  if (riskRegions.length) {
    const amount = riskRegions.reduce((max, r) => Decimal.max(max, r.highRiskSurcharge!), ZERO);
    items.push(line(PricingLineItemCode.HIGH_RISK_SURCHARGE, "High-risk area surcharge", amount, null, null, { triggeringRegionIds: riskRegions.map((r) => r.id) }));
  }
  if (input.vehicleClass && rule.vehicleClass === input.vehicleClass && rule.vehicleSurcharge?.greaterThan(ZERO)) {
    items.push(line(PricingLineItemCode.VEHICLE_SURCHARGE, "Vehicle class surcharge", rule.vehicleSurcharge));
  }
  let volumetricWeightKg: Prisma.Decimal | null = null;
  if (rule.dimensionalPricingEnabled && rule.volumetricDivisor?.greaterThan(ZERO) && input.lengthCm && input.widthCm && input.heightCm) {
    volumetricWeightKg = input.lengthCm.mul(input.widthCm).mul(input.heightCm).div(rule.volumetricDivisor);
  }
  const chargeableWeightKg = input.actualWeightKg && volumetricWeightKg ? Decimal.max(input.actualWeightKg, volumetricWeightKg) : input.actualWeightKg ?? volumetricWeightKg;
  if (rule.maximumWeightKg && (!chargeableWeightKg || chargeableWeightKg.greaterThan(rule.maximumWeightKg))) throw pricingError.invalidRule("Package weight is not supported by this rule.");
  if (rule.perAdditionalKgRate && rule.perAdditionalKgRate.greaterThan(ZERO)) {
    if (!chargeableWeightKg) throw pricingError.invalidRule("Package weight is required by this rule.");
    if (!rule.includedWeightKg || !rule.weightIncrementKg) throw pricingError.invalidRule("Weight pricing configuration is incomplete.");
    const extra = Decimal.max(chargeableWeightKg.minus(rule.includedWeightKg), ZERO);
    const billable = ceilToIncrement(extra, rule.weightIncrementKg);
    if (billable.greaterThan(ZERO)) items.push(line(PricingLineItemCode.WEIGHT_SURCHARGE, "Additional weight surcharge", billable.mul(rule.perAdditionalKgRate), billable, rule.perAdditionalKgRate));
  }
  const configuredSubtotal = items.reduce((sum, item) => sum.plus(item.amount), ZERO);
  for (const surcharge of args.configuredSurcharges ?? []) {
    const amount = surcharge.calculationType === "PERCENTAGE"
      ? configuredSubtotal.mul(surcharge.value)
      : surcharge.value;
    if (amount.greaterThan(ZERO)) {
      items.push(line(PricingLineItemCode.RULE_SURCHARGE, surcharge.customerMessage ?? surcharge.reason, amount, null, surcharge.value, {
        commercialSurchargeId: surcharge.id,
        stableKey: surcharge.stableKey,
        versionNumber: String(surcharge.versionNumber),
        calculationType: surcharge.calculationType,
      }));
    }
  }
  let subtotal = items.reduce((sum, item) => sum.plus(item.amount), ZERO);
  if (rule.minimumCharge && subtotal.lessThan(rule.minimumCharge)) {
    items.push(line(PricingLineItemCode.MINIMUM_CHARGE_ADJUSTMENT, "Minimum charge adjustment", rule.minimumCharge.minus(subtotal)));
    subtotal = rule.minimumCharge;
  }
  subtotal = roundMoney(subtotal);
  const taxRate = taxConfig.enabled ? taxConfig.rate : ZERO;
  assertNonNegative(taxRate, "Tax rate");
  const taxAmount = taxConfig.enabled ? roundMoney(subtotal.mul(taxRate)) : ZERO;
  if (taxConfig.enabled) items.push(line(PricingLineItemCode.VAT, "VAT", taxAmount, null, taxRate));
  const total = roundMoney(subtotal.plus(taxAmount));
  const recomputedSubtotal = items.filter((item) => item.code !== PricingLineItemCode.VAT).reduce((sum, item) => sum.plus(item.amount), ZERO);
  if (!recomputedSubtotal.equals(subtotal) || !subtotal.plus(taxAmount).equals(total)) throw new Error("Pricing calculation invariant failed.");
  return { calculationVersion: args.calculationVersion, currency: "ZAR", rawDistanceKm, billableDistanceKm, actualWeightKg: input.actualWeightKg, volumetricWeightKg, chargeableWeightKg, lineItems: items, subtotal, taxRate, taxAmount, total };
}
