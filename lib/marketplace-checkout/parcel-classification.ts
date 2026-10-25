import { z } from "zod";

const fourDecimals = (value: number) => Math.abs(value * 10000 - Math.round(value * 10000)) < 0.00000001;
const measurement = z.number().finite().positive().max(1000).refine(fourDecimals, "Use at most four decimal places.");
export const TrustedPackageSchema = z.object({
  storeId: z.string().min(1).max(100), offerReference: z.string().min(1).max(100),
  variantReference: z.string().min(1).max(100), publicationVersion: z.string().min(1).max(160),
  // An exact modifier selection binds the measured package, including quantities.
  modifiers: z.array(z.object({ optionReference: z.string().min(1).max(100), quantity: z.number().int().positive().max(100) }).strict()).max(100),
  packingRule: z.literal("SINGLE_PREPACKAGED_UNIT"),
  lengthCm: measurement, widthCm: measurement, heightCm: measurement,
  weightKg: z.number().finite().positive().max(10000).refine(fourDecimals, "Use at most four decimal places."),
  authorityReference: z.string().trim().min(10).max(300),
}).strict().refine(value => new Set(value.modifiers.map(option => option.optionReference)).size === value.modifiers.length,
  "A selected modifier may only appear once per packaged unit.");
// An independently measured, sealed consignment is not the sum of catalog
// weights or a guessed packing geometry. Every source line and quantity must
// match a reviewed bundle exactly, including current offer revisions.
const TrustedBundleLineSchema = z.object({
  offerReference: z.string().min(1).max(100), variantReference: z.string().min(1).max(100),
  publicationVersion: z.string().min(1).max(160), quantity: z.number().int().positive().max(10000),
  modifiers: TrustedPackageSchema.shape.modifiers,
}).strict().refine(line => new Set(line.modifiers.map(option => option.optionReference)).size === line.modifiers.length,
  "A selected modifier may only appear once per product line.");
export const TrustedConsignmentSchema = z.object({
  storeId: z.string().min(1).max(100), packingRule: z.literal("MEASURED_SEALED_CONSIGNMENT"),
  lines: z.array(TrustedBundleLineSchema).min(1).max(50),
  lengthCm: measurement, widthCm: measurement, heightCm: measurement,
  weightKg: TrustedPackageSchema.shape.weightKg,
  authorityReference: z.string().trim().min(10).max(300),
}).strict().refine(value => value.lines.length > 1 || value.lines.some(line => line.quantity > 1),
  "A consignment must contain multiple units; use SINGLE_PREPACKAGED_UNIT for one unit.")
  .refine(value => new Set(value.lines.map(line => JSON.stringify([
    line.offerReference, line.variantReference, line.publicationVersion, selection(line.modifiers),
  ]))).size === value.lines.length, "Duplicate product selections must be combined into one measured quantity.");
export const TrustedPackageVersionSchema = z.object({
  version: z.number().int().positive(), status: z.enum(["DRAFT", "APPROVED", "ACTIVE", "RETIRED"]),
  effectiveFrom: z.iso.datetime(), effectiveTo: z.iso.datetime().nullable(),
  createdByUserId: z.string().min(1), approvedByUserId: z.string().min(1).nullable(), approvedAt: z.iso.datetime().nullable(),
  packages: z.array(TrustedPackageSchema).max(500),
  bundles: z.array(TrustedConsignmentSchema).max(100).optional(),
}).strict().refine((value) => !value.effectiveTo || value.effectiveTo > value.effectiveFrom, "Effective end must follow start.")
  .refine(value => value.packages.length > 0 || (value.bundles?.length ?? 0) > 0, "At least one reviewed package or measured consignment is required.")
  .refine(value => {
    const identifiers = value.packages.map(entry => JSON.stringify([
      entry.storeId, entry.offerReference, entry.variantReference,
      entry.publicationVersion, selection(entry.modifiers),
    ]));
    return new Set(identifiers).size === identifiers.length;
  }, "A single-packaged product selection may have only one reviewed measurement per version.")
  .refine(value => {
    const identifiers = (value.bundles ?? []).map(bundle => JSON.stringify([
      bundle.storeId, consignmentSignature(bundle.lines),
    ]));
    return new Set(identifiers).size === identifiers.length;
  }, "A sealed consignment selection must have one unambiguous measured record per version.");
export type TrustedPackageVersion = z.infer<typeof TrustedPackageVersionSchema>;
export type ParcelClass = "SMALL" | "MEDIUM" | "LARGE";
export type ParcelLimits = { id: string; stableKey: string; versionNumber: number; lengthCm: number; widthCm: number; heightCm: number; maximumWeightKg: number };
export type ParcelSourceLine = { offerReference: string; variantReference: string; publicationVersion: string; quantity: number; modifiers: readonly { optionReference: string; quantity: number }[] };
export type TrustedParcelClassification = { sizeClass: ParcelClass | null; status: "CLASSIFIED" | "UNKNOWN" | "UNSUPPORTED"; reason: string; packageVersion: number | null; profileId: string | null; profileVersion: number | null; weightKg?: number };

function consignmentSignature(lines: readonly ParcelSourceLine[]) {
  return JSON.stringify(lines.map(line => ({
    offerReference: line.offerReference, variantReference: line.variantReference,
    publicationVersion: line.publicationVersion, quantity: line.quantity,
    modifiers: selection(line.modifiers),
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}

function selection(modifiers: readonly { optionReference: string; quantity: number }[]) {
  return JSON.stringify(modifiers.map(({ optionReference, quantity }) => ({ optionReference, quantity })).sort((a, b) => a.optionReference.localeCompare(b.optionReference)));
}

/** The only supported packing rule is an independently reviewed complete unit.
 * Multiple units stay UNKNOWN until operations supplies an approved packing rule.
 * No shopper field, catalog product weight, volume guess or line count sets class. */
export function classifyTrustedMarketplaceParcel(input: { storeId: string; lines: readonly ParcelSourceLine[]; versions: readonly TrustedPackageVersion[]; profiles: readonly ParcelLimits[]; now?: Date }): TrustedParcelClassification {
  const unknown = (reason: string): TrustedParcelClassification => ({ sizeClass: null, status: "UNKNOWN", reason, packageVersion: null, profileId: null, profileVersion: null });
  if (input.lines.some((line) => !Number.isSafeInteger(line.quantity) || line.quantity <= 0 || line.modifiers.some((modifier) => !Number.isSafeInteger(modifier.quantity) || modifier.quantity <= 0))) return { ...unknown("INVALID_SOURCE_QUANTITY"), status: "UNSUPPORTED" };
  const isAggregate = input.lines.length !== 1 || input.lines[0].quantity !== 1;
  if (!input.lines.length) return unknown("AGGREGATE_PACKING_APPROVAL_REQUIRED");
  const now = input.now ?? new Date();
  const active = input.versions.filter((version) => version.status === "ACTIVE" && version.approvedByUserId && version.approvedByUserId !== version.createdByUserId && version.approvedAt && new Date(version.effectiveFrom) <= now && (!version.effectiveTo || new Date(version.effectiveTo) > now)).sort((a, b) => b.version - a.version);
  const version = active[0];
  if (!version || active[1]?.version === version.version) return unknown("TRUSTED_PACKAGING_APPROVAL_REQUIRED");
  const line = input.lines[0];
  const matches = isAggregate
    ? (version.bundles ?? []).filter(bundle => bundle.storeId === input.storeId && consignmentSignature(bundle.lines) === consignmentSignature(input.lines))
    : version.packages.filter(entry => entry.storeId === input.storeId && entry.offerReference === line.offerReference && entry.variantReference === line.variantReference && entry.publicationVersion === line.publicationVersion && selection(entry.modifiers) === selection(line.modifiers));
  if (matches.length !== 1) return unknown(matches.length ? "AMBIGUOUS_PACKAGE_EVIDENCE" : isAggregate ? "AGGREGATE_PACKING_APPROVAL_REQUIRED" : "TRUSTED_PACKAGE_SOURCE_MISSING");
  const parsed = isAggregate ? TrustedConsignmentSchema.safeParse(matches[0]) : TrustedPackageSchema.safeParse(matches[0]);
  if (!parsed.success) return unknown("INVALID_PACKAGE_EVIDENCE");
  const parcel = parsed.data; const dimensions = [parcel.lengthCm, parcel.widthCm, parcel.heightCm].sort((a, b) => a - b);
  const valid = input.profiles.filter((profile) => ["SMALL", "MEDIUM", "LARGE"].includes(profile.stableKey) && Number.isSafeInteger(profile.versionNumber) && profile.versionNumber > 0 && [profile.lengthCm, profile.widthCm, profile.heightCm].every((value) => Number.isFinite(value) && value > 0 && value <= 1000) && Number.isFinite(profile.maximumWeightKg) && profile.maximumWeightKg > 0 && profile.maximumWeightKg <= 10000);
  if (valid.length !== 3 || new Set(valid.map((profile) => profile.stableKey)).size !== 3) return unknown("COMPLETE_PARCEL_LIMITS_REQUIRED");
  const ordered = ["SMALL", "MEDIUM", "LARGE"].map((key) => valid.find((profile) => profile.stableKey === key)!);
  const sorted = ordered.map((profile) => [profile.lengthCm, profile.widthCm, profile.heightCm].sort((a, b) => a - b));
  if (ordered.some((profile, index) => index > 0 && (profile.maximumWeightKg < ordered[index - 1].maximumWeightKg || sorted[index].some((dimension, axis) => dimension < sorted[index - 1][axis])))) return unknown("NON_MONOTONIC_PARCEL_LIMITS");
  const profile = ordered.find((candidate, index) => parcel.weightKg <= candidate.maximumWeightKg && dimensions.every((dimension, axis) => dimension <= sorted[index][axis]));
  if (!profile) return { ...unknown("MEASURED_PACKAGE_UNSUPPORTED"), status: "UNSUPPORTED", packageVersion: version.version };
  return { sizeClass: profile.stableKey as ParcelClass, status: "CLASSIFIED", reason: isAggregate ? "REVIEWED_MEASURED_CONSIGNMENT" : "REVIEWED_SINGLE_PREPACKAGED_UNIT", packageVersion: version.version, profileId: profile.id, profileVersion: profile.versionNumber, weightKg: parcel.weightKg };
}
