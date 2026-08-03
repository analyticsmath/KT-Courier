import { z } from "zod";
import { DeliveryType, PricingRuleType, VehicleType } from "@/types/db";
import { AddressInputSchema } from "./address";

const decimalText = z.string().regex(/^\d+(\.\d{1,4})?$/, "Must be a non-negative decimal");

const PricingRuleBase = z.object({
  name: z.string().min(1, "Name is required").max(150).trim(),
  type: z.nativeEnum(PricingRuleType, { error: "Invalid rule type" }),
  deliveryType: z.nativeEnum(DeliveryType).optional(),
  amount: z
    .number({ error: "Amount must be a number" })
    .positive("Amount must be greater than 0")
    .max(99_999.99, "Amount is too large"),
  currency: z.string().length(3, "Currency must be a 3-letter ISO code").trim().default("ZAR"),
  regionId: z.string().cuid("Invalid region ID").optional(),
  description: z.string().trim().max(500).optional(),
  active: z.boolean().default(true),
  baseFee: z.number().min(0).max(99_999.99).optional(),
  perKmRate: z.number().min(0).max(9_999.9999).default(0),
  includedDistanceKm: z.number().min(0).max(9_999.9999).default(0),
  distanceIncrementKm: z.number().positive().max(100).default(0.1),
  minimumCharge: z.number().min(0).max(99_999.99).nullable().optional(),
  flatSurcharge: z.number().min(0).max(99_999.99).nullable().optional(),
  vehicleClass: z.nativeEnum(VehicleType).nullable().optional(),
  vehicleSurcharge: z.number().min(0).max(99_999.99).nullable().optional(),
  includedWeightKg: z.number().min(0).max(9_999.9999).nullable().optional(),
  perAdditionalKgRate: z.number().min(0).max(9_999.9999).nullable().optional(),
  maximumWeightKg: z.number().positive().max(9_999.9999).nullable().optional(),
  weightIncrementKg: z.number().positive().max(1_000).nullable().optional(),
  dimensionalPricingEnabled: z.boolean().default(false),
  volumetricDivisor: z.number().positive().max(100_000).nullable().optional(),
  maxDistanceKm: z.number().positive().max(9_999.9999).nullable().optional(),
  allowGlobalFallback: z.boolean().default(true),
  priority: z.number().int().min(-1_000).max(1_000).default(0),
  effectiveFrom: z.string().datetime().nullable().optional(),
  effectiveTo: z.string().datetime().nullable().optional(),
});

export const PricingRuleCreateSchema = PricingRuleBase.superRefine((input, ctx) => {
  if (input.currency !== "ZAR") ctx.addIssue({ code: "custom", path: ["currency"], message: "Pricing Engine v1 supports ZAR only." });
  if (input.effectiveFrom && input.effectiveTo && new Date(input.effectiveFrom) >= new Date(input.effectiveTo)) ctx.addIssue({ code: "custom", path: ["effectiveTo"], message: "Effective end must be after effective start." });
  if (input.perAdditionalKgRate && (input.includedWeightKg === null || input.includedWeightKg === undefined || !input.weightIncrementKg)) ctx.addIssue({ code: "custom", path: ["weightIncrementKg"], message: "Included weight and weight increment are required for weight pricing." });
  if (input.dimensionalPricingEnabled && !input.volumetricDivisor) ctx.addIssue({ code: "custom", path: ["volumetricDivisor"], message: "A volumetric divisor is required when dimensional pricing is enabled." });
});

export const PricingRuleUpdateSchema = PricingRuleBase.partial().extend({
  active: z.boolean().optional(),
  changeReason: z.string().trim().min(3, "A change reason is required").max(500),
  expectedRevision: z.number().int().positive("Current revision is required"),
}).superRefine((input, ctx) => {
  if (input.currency !== undefined && input.currency !== "ZAR") ctx.addIssue({ code: "custom", path: ["currency"], message: "Pricing Engine v1 supports ZAR only." });
  if (input.effectiveFrom && input.effectiveTo && new Date(input.effectiveFrom) >= new Date(input.effectiveTo)) ctx.addIssue({ code: "custom", path: ["effectiveTo"], message: "Effective end must be after effective start." });
  if (input.dimensionalPricingEnabled && !input.volumetricDivisor) ctx.addIssue({ code: "custom", path: ["volumetricDivisor"], message: "A volumetric divisor is required when dimensional pricing is enabled." });
});

export type PricingRuleCreateInput = z.infer<typeof PricingRuleCreateSchema>;
export type PricingRuleUpdateInput = z.infer<typeof PricingRuleUpdateSchema>;

/** Inputs that influence a quote. Totals, rates and route values are intentionally absent. */
export const PricingQuoteRequestSchema = z
  .object({
    deliveryType: z.nativeEnum(DeliveryType),
    pickupAddress: AddressInputSchema,
    dropoffAddress: AddressInputSchema,
    vehicleClass: z.nativeEnum(VehicleType).optional(),
    actualWeightKg: decimalText.optional(),
    lengthCm: decimalText.optional(),
    widthCm: decimalText.optional(),
    heightCm: decimalText.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    for (const field of ["latitude", "longitude"] as const) {
      if (value.pickupAddress[field] === undefined || value.dropoffAddress[field] === undefined) {
        ctx.addIssue({ code: "custom", path: ["pickupAddress", field], message: "Mapped pickup and dropoff coordinates are required for a quote." });
        return;
      }
    }
    const dimensions = [value.lengthCm, value.widthCm, value.heightCm];
    if (dimensions.some(Boolean) && !dimensions.every(Boolean)) ctx.addIssue({ code: "custom", path: ["lengthCm"], message: "All three dimensions are required together." });
  });

export type PricingQuoteRequestInput = z.infer<typeof PricingQuoteRequestSchema>;
