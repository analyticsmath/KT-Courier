import { Prisma } from "@prisma/client";
import { z } from "zod";
import { PROVINCES } from "@/lib/client-platform/contracts";
import { MarketplaceCheckoutError } from "./errors";

const money = z.string().regex(/^\d+\.\d{2}$/).refine((v) => Number(v) <= 1000000);
export const MarketplaceDeliveryRuleSchema = z.object({
  key: z.string().regex(/^[A-Z0-9_-]{2,60}$/),
  sizeClass: z.enum(["SMALL", "MEDIUM", "LARGE", "ANY"]),
  minDistanceKm: z.number().finite().nonnegative().max(500),
  maxDistanceKm: z.number().finite().positive().max(500),
  province: z.enum(PROVINCES).nullable(), regionId: z.string().cuid().nullable(), storeId: z.string().cuid().nullable(),
  fee: money, highRiskSurcharge: money, minimumFee: money, maximumFee: money.nullable(),
}).strict().superRefine((v, context) => {
  if (!v.province && !v.regionId) context.addIssue({ code: "custom", message: "A province or region scope is required." });
  if (v.maxDistanceKm <= v.minDistanceKm) context.addIssue({ code: "custom", message: "Distance band end must exceed start." });
  if (v.maximumFee && Number(v.maximumFee) < Number(v.minimumFee)) context.addIssue({ code: "custom", message: "Maximum fee must not be below minimum." });
});
export const MarketplaceDeliveryMatrixSchema = z.object({
  effectiveFrom: z.iso.datetime(), effectiveTo: z.iso.datetime().nullable(),
  rules: z.array(MarketplaceDeliveryRuleSchema).min(1).max(500),
}).strict().superRefine((v, c) => {
  if (v.effectiveTo && v.effectiveTo <= v.effectiveFrom) c.addIssue({ code: "custom", message: "Effective end must follow start." });
  if (new Set(v.rules.map((r) => r.key)).size !== v.rules.length) c.addIssue({ code: "custom", message: "Rule keys must be unique." });
});
export type MarketplaceDeliveryMatrix = z.infer<typeof MarketplaceDeliveryMatrixSchema>;
export type DeliveryPolicyVersion = MarketplaceDeliveryMatrix & { version: number; status: "DRAFT" | "APPROVED" | "ACTIVE" | "RETIRED"; createdByUserId: string; approvedByUserId: string | null; approvedAt: string | null };
export const DeliveryPolicyVersionSchema = MarketplaceDeliveryMatrixSchema.safeExtend({
  version: z.number().int().positive(), status: z.enum(["DRAFT", "APPROVED", "ACTIVE", "RETIRED"]),
  createdByUserId: z.string().min(1), approvedByUserId: z.string().min(1).nullable(), approvedAt: z.iso.datetime().nullable(),
});
export type DeliveryPolicyContext = { sizeClass: "SMALL" | "MEDIUM" | "LARGE" | null; distanceKm: number; province: string; regionId: string; storeId: string; highRisk: boolean; now?: Date };

export function selectMarketplaceDeliveryPolicy(versions: DeliveryPolicyVersion[], context: DeliveryPolicyContext) {
  const now = context.now ?? new Date();
  if (!Number.isFinite(context.distanceKm) || context.distanceKm < 0) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Verified route distance is required.");
  const candidates = versions.filter((v) => v.status === "ACTIVE" && v.approvedAt && v.approvedByUserId && v.approvedByUserId !== v.createdByUserId && new Date(v.effectiveFrom) <= now && (!v.effectiveTo || new Date(v.effectiveTo) > now));
  const current = candidates.sort((a, b) => b.version - a.version)[0];
  if (!current) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Marketplace delivery pricing awaits an approved production matrix. Please contact support.");
  const ranked = current.rules.filter((r) => (r.sizeClass === "ANY" || r.sizeClass === context.sizeClass) && context.distanceKm >= r.minDistanceKm && context.distanceKm < r.maxDistanceKm && (!r.province || r.province === context.province) && (!r.regionId || r.regionId === context.regionId) && (!r.storeId || r.storeId === context.storeId)).map((rule) => ({ rule, rank: (rule.storeId ? 8 : 0) + (rule.regionId ? 4 : 0) + (rule.province ? 2 : 0) + (rule.sizeClass !== "ANY" ? 1 : 0) })).sort((a, b) => b.rank - a.rank);
  if (!ranked.length) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "No approved marketplace delivery tariff applies to this parcel and route.");
  if (ranked[1]?.rank === ranked[0].rank) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Overlapping marketplace delivery tariffs require administrator review.");
  const rule = ranked[0].rule;
  let fee = new Prisma.Decimal(rule.fee).add(context.highRisk ? rule.highRiskSurcharge : "0");
  fee = Prisma.Decimal.max(fee, rule.minimumFee);
  if (rule.maximumFee) fee = Prisma.Decimal.min(fee, rule.maximumFee);
  return { fee: fee.toFixed(2), policyVersion: current.version, ruleKey: rule.key, highRiskApplied: context.highRisk, minimumFee: rule.minimumFee, maximumFee: rule.maximumFee };
}
