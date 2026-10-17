/**
 * Automatic marketplace dispatch is fail-closed. Offers may be created by the production
 * worker only when BOTH are true:
 *   1. the operator hold `dispatch.auto_dispatch_enabled` is exactly boolean `true`
 *      (missing, null, malformed or unknown values are treated as OFF), and
 *   2. a governed, independently approved `DispatchAutomationPolicy` is ACTIVE and effective.
 * A freely mutable boolean alone never implies owner approval.
 */

/** Typed identity recorded for every system-originated dispatch action. */
export const DISPATCH_SYSTEM_ACTOR = "SYSTEM:marketplace-dispatch" as const;

export type DispatchAutomationBlockReason =
  | "AUTO_DISPATCH_SETTING_OFF"
  | "NO_APPROVED_POLICY"
  | "POLICY_NOT_ACTIVE"
  | "POLICY_NOT_EFFECTIVE"
  | "POLICY_EVIDENCE_INCOMPLETE"
  | "POLICY_SCOPE_INVALID";

export type DispatchAutomationDecision =
  | Readonly<{
      allowed: true;
      policyReference: string;
      policyVersion: number;
      approvedByUserId: string;
      approvedAt: string;
      regionIds: readonly string[];
      maxOfferAttempts: number;
    }>
  | Readonly<{ allowed: false; reason: DispatchAutomationBlockReason }>;

/** Only an exact boolean `true` (or the exact string "true") enables the operator hold. */
export function parseAutoDispatchSetting(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === "string") return value.trim() === "true";
  return false;
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

/** Pure evaluation of the persisted policy row. Anything unexpected blocks. */
export function evaluateDispatchAutomationPolicy(row: unknown, now: Date): DispatchAutomationDecision {
  if (!row || typeof row !== "object") return { allowed: false, reason: "NO_APPROVED_POLICY" };
  const policy = row as Record<string, unknown>;
  if (policy.status !== "ACTIVE") return { allowed: false, reason: "POLICY_NOT_ACTIVE" };

  const approvedAt = asDate(policy.approvedAt);
  const activatedAt = asDate(policy.activatedAt);
  if (
    !nonEmpty(policy.publicReference) ||
    !nonEmpty(policy.createdByUserId) ||
    !nonEmpty(policy.approvedByUserId) ||
    !nonEmpty(policy.activatedByUserId) ||
    !approvedAt ||
    !activatedAt ||
    policy.approvedByUserId === policy.createdByUserId
  ) {
    return { allowed: false, reason: "POLICY_EVIDENCE_INCOMPLETE" };
  }

  const effectiveFrom = asDate(policy.effectiveFrom);
  const effectiveUntil = policy.effectiveUntil === null || policy.effectiveUntil === undefined ? null : asDate(policy.effectiveUntil);
  if (!effectiveFrom || (policy.effectiveUntil != null && !effectiveUntil)) return { allowed: false, reason: "POLICY_NOT_EFFECTIVE" };
  if (effectiveFrom.getTime() > now.getTime() || (effectiveUntil && effectiveUntil.getTime() <= now.getTime())) {
    return { allowed: false, reason: "POLICY_NOT_EFFECTIVE" };
  }

  const regionIds = Array.isArray(policy.regionIds) ? policy.regionIds.filter(nonEmpty) : [];
  const attempts = policy.maxOfferAttempts;
  if (
    !Array.isArray(policy.regionIds) ||
    regionIds.length === 0 ||
    regionIds.length !== policy.regionIds.length ||
    typeof attempts !== "number" ||
    !Number.isInteger(attempts) ||
    attempts < 1 ||
    attempts > 10 ||
    typeof policy.versionNumber !== "number" ||
    !Number.isInteger(policy.versionNumber)
  ) {
    return { allowed: false, reason: "POLICY_SCOPE_INVALID" };
  }

  return Object.freeze({
    allowed: true as const,
    policyReference: policy.publicReference,
    policyVersion: policy.versionNumber,
    approvedByUserId: policy.approvedByUserId,
    approvedAt: approvedAt.toISOString(),
    regionIds: Object.freeze([...regionIds]),
    maxOfferAttempts: attempts,
  });
}

/** Combines the operator hold and the governed policy. Both must permit offers. */
export function decideDispatchAutomation(input: Readonly<{ settingValue: unknown; policyRow: unknown; now: Date }>): DispatchAutomationDecision {
  if (!parseAutoDispatchSetting(input.settingValue)) return { allowed: false, reason: "AUTO_DISPATCH_SETTING_OFF" };
  return evaluateDispatchAutomationPolicy(input.policyRow, input.now);
}

export function dispatchPolicyAllowsRegion(decision: DispatchAutomationDecision, regionId: string | null): boolean {
  return decision.allowed && !!regionId && decision.regionIds.includes(regionId);
}

/** Safe, operator-facing explanation and next step for each manual-queue reason. */
export const MANUAL_DISPATCH_REASONS: Readonly<Record<string, Readonly<{ label: string; nextStep: string }>>> = Object.freeze({
  AUTO_DISPATCH_DISABLED_BY_POLICY: { label: "Automatic dispatch is not approved or is held off.", nextStep: "Select a compliant driver manually, or have an authorised owner approve the dispatch automation policy." },
  AUTO_DISPATCH_SETTING_OFF: { label: "Automatic dispatch is held off by the operator setting.", nextStep: "Select a compliant driver manually." },
  NO_APPROVED_POLICY: { label: "No approved automatic dispatch policy exists.", nextStep: "Select a compliant driver manually, or review the dispatch automation policy." },
  POLICY_NOT_ACTIVE: { label: "The dispatch automation policy is not active.", nextStep: "Select a compliant driver manually, or complete policy approval and activation." },
  POLICY_NOT_EFFECTIVE: { label: "The dispatch automation policy is outside its effective period.", nextStep: "Select a compliant driver manually, or review the policy dates." },
  POLICY_EVIDENCE_INCOMPLETE: { label: "The dispatch automation policy lacks complete independent approval evidence.", nextStep: "Review the policy approval record before enabling automation." },
  POLICY_SCOPE_INVALID: { label: "The dispatch automation policy scope is invalid.", nextStep: "Review the policy regions and attempt limit." },
  ORDER_REGION_OUTSIDE_POLICY_SCOPE: { label: "This delivery region is not covered by the approved automation policy.", nextStep: "Select a compliant driver manually, or review the policy scope." },
  NO_ELIGIBLE_DRIVERS_AVAILABLE: { label: "No compliant, available driver qualified for this delivery.", nextStep: "Contact operations to recruit or free capacity, then select a driver manually." },
  MAX_OFFER_ATTEMPTS_EXCEEDED: { label: "Automatic offers were declined or expired the approved number of times.", nextStep: "Select a compliant driver manually." },
  SYSTEM_ACTOR_UNAVAILABLE: { label: "A valid system actor could not be established, so no automatic offer was made.", nextStep: "Contact engineering; select a compliant driver manually meanwhile." },
});

export function describeManualDispatchReason(reason: unknown): Readonly<{ code: string; label: string; nextStep: string }> {
  const code = typeof reason === "string" && reason in MANUAL_DISPATCH_REASONS ? reason : "UNKNOWN";
  const known = MANUAL_DISPATCH_REASONS[code];
  return Object.freeze({
    code,
    label: known?.label ?? "Automatic routing stopped for an unrecorded reason.",
    nextStep: known?.nextStep ?? "Select a compliant driver manually or contact operations.",
  });
}
