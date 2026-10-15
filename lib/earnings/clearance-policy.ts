import { z } from "zod";

export const CLEARANCE_POLICY_KEY = "finance.earning_clearance_policy.v1";
export const ClearancePolicyDraftSchema = z.object({
  version: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/),
  effectiveFrom: z.iso.datetime(),
  storeHoldHours: z.number().int().min(0).max(8760),
  driverHoldHours: z.number().int().min(0).max(8760),
  reason: z.string().trim().min(10).max(500),
}).strict();
export const ClearancePolicySchema = ClearancePolicyDraftSchema.extend({
  submittedByUserId: z.string().min(1), submittedAt: z.iso.datetime(),
  reviewedByUserId: z.string().min(1).nullable(), reviewedAt: z.iso.datetime().nullable(),
}).refine(p => !p.reviewedByUserId || (p.reviewedByUserId !== p.submittedByUserId && Boolean(p.reviewedAt)), "Independent review is required.");
export type EarningClearancePolicy = z.infer<typeof ClearancePolicySchema>;

/** No policy or no independent approval leaves earnings held indefinitely. A
 * later reviewed policy can cover completed work through the clearance batch. */
export function resolveEarningClearance(input: { policy: unknown; kind: "STORE" | "DRIVER"; completedAt: Date; now: Date }) {
  const parsed = ClearancePolicySchema.safeParse(input.policy);
  if (!parsed.success) return null;
  const p = parsed.data;
  if (!p.reviewedByUserId || !p.reviewedAt || new Date(p.reviewedAt) > input.now || new Date(p.effectiveFrom) > input.now || new Date(p.submittedAt) > new Date(p.reviewedAt) || !Number.isFinite(input.completedAt.valueOf()) || input.completedAt > input.now) return null;
  const hours = input.kind === "STORE" ? p.storeHoldHours : p.driverHoldHours;
  // A newly approved policy cannot retroactively bypass its effective start.
  const eligibleAt = new Date(Math.max(input.completedAt.valueOf() + hours * 3_600_000, Date.parse(p.effectiveFrom), Date.parse(p.reviewedAt)));
  return { eligibleAt, policyVersion: p.version, reviewedByUserId: p.reviewedByUserId, reviewedAt: p.reviewedAt, completedAt: input.completedAt.toISOString(), holdHours: hours };
}
