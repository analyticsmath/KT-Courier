import { z } from "zod";

const optionalIdentifierSchema = z.string().trim().min(1).nullable().optional();

export const campaignCreateInputSchema = z.object({
  name: z.string().trim().min(1),
});

export const campaignUpdateInputSchema = z.object({
  name: z.string().trim().min(1).optional(),
});

export const campaignFundingInputSchema = z.object({
  campaignVersionId: z.string().trim().min(1),
  amount: z.coerce.number().finite(),
  operationId: z.string().trim().min(1).optional(),
  requestHash: z.string().trim().min(1).optional(),
});

export const campaignVersionInputSchema = z.object({
  sponsoredObjectType: z.enum(["PRODUCT", "STORE"]),
  sponsoredProductId: optionalIdentifierSchema,
  sponsoredStoreId: optionalIdentifierSchema,
  placementDefinitionId: z.string().trim().min(1),
  rateCardVersionId: z.string().trim().min(1),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  dailyBudget: z.coerce.number().finite(),
  totalBudget: z.coerce.number().finite(),
  attributionWindowDays: z.coerce.number().int().positive().optional(),
  frequencyCapPerSession: z.coerce.number().int().positive().nullable().optional(),
  frequencyCapPerDay: z.coerce.number().int().positive().nullable().optional(),
  targetingPolicyVersion: z.string().trim().min(1).default("1.0"),
  measurementPolicyVersion: z.string().trim().min(1).default("1.0"),
  invalidTrafficPolicyVersion: z.string().trim().min(1).default("1.0"),
  attributionPolicyVersion: z.string().trim().min(1).default("1.0"),
  legalTermsVersion: z.string().trim().min(1).default("1.0"),
  targets: z.array(z.object({
    targetType: z.string().trim().min(1),
    value: z.string().trim().min(1),
    effect: z.enum(["INCLUDE", "EXCLUDE"]),
  })).default([]),
  creative: z.object({
    creativeType: z.enum(["CANONICAL_PRODUCT_CARD", "CANONICAL_STORE_CARD"]),
    productId: optionalIdentifierSchema,
    productVersionReference: optionalIdentifierSchema,
    offerReference: optionalIdentifierSchema,
    storeId: optionalIdentifierSchema,
    title: z.string().trim().min(1),
    imageAssetReference: z.string().trim().min(1),
    safePriceSnapshot: z.coerce.number().finite().nullable().optional(),
    storeDisplayName: z.string().trim().min(1),
    disclosureLabel: z.string().trim().min(1).optional(),
    destinationType: z.string().trim().min(1),
    destinationReference: z.string().trim().min(1),
  }),
});
