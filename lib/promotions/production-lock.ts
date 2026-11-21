import {
  isSafeLocalTestDatabaseUrl,
  isDisposableBrowserValidationAllowed,
} from "@/lib/testing/safe-postgres-validator";
import { classifyRuntimeEnvironment } from "@/lib/runtime/deployment-classification";
import { resolveCommerceSwitch } from "@/lib/runtime/commerce-switch";

/**
 * Risk-scoped promotions eligibility replaces the legacy blanket source lock.
 *
 * Security & financial invariants:
 * - Approved, funded, versioned in-scope promotions (first-store welcome R50
 *   offer, approved store coupons/campaigns with verified budget caps & expiry)
 *   operate under the single authoritative `KT_COMMERCE_ENABLED` switch in
 *   production.
 * - Unapproved campaigns, missing funding authority, exhausted budgets,
 *   expired windows, and self-approved campaigns are ALWAYS rejected by the
 *   domain services (`promotion-campaign.service`, `promotion-evaluation.service`,
 *   `promotion-funding.service`, `promotion-budget.service`).
 * - Chargeable advertising (`ADVERTISING_PRODUCTION_VALIDATION_APPROVED = false`)
 *   and promoter commission programs (`PROMOTERS_PRODUCTION_VALIDATION_APPROVED = false`)
 *   remain strictly locked separately and are NEVER enabled by promotions.
 * - Release/reversal/reconciliation of already-committed promotion reservations
 *   remains allowed when `KT_COMMERCE_ENABLED=false` so refunds and cancellations
 *   never strand existing liabilities.
 */
export const PROMOTIONS_PRODUCTION_VALIDATION_APPROVED = true as const;
export const PROMOTIONS_PRODUCTION_BLOCK_REASON = "COMMERCE_DISABLED_BY_GLOBAL_SWITCH" as const;

export type PromotionOperation =
  | "CAMPAIGN_CREATE"
  | "CAMPAIGN_UPDATE"
  | "CAMPAIGN_SUBMIT"
  | "CAMPAIGN_APPROVE"
  | "CAMPAIGN_ACTIVATE"
  | "CODE_GENERATE"
  | "CODE_VALIDATE"
  | "EVALUATION"
  | "RESERVATION"
  | "COMMITMENT"
  | "RELEASE"
  | "REVERSAL"
  | "BUDGET_MOVEMENT"
  | "FUNDING_JOURNAL"
  | "RECONCILIATION";

const LIABILITY_CLEANUP_OPERATIONS = new Set<PromotionOperation>([
  "RELEASE",
  "REVERSAL",
  "RECONCILIATION",
]);

export class PromotionsProductionLockedError extends Error {
  readonly code: string;
  constructor(
    readonly operation: PromotionOperation,
    code: string = PROMOTIONS_PRODUCTION_BLOCK_REASON,
  ) {
    super(`${operation} is inactive: ${code}.`);
    this.code = code;
    this.name = "PromotionsProductionLockedError";
  }
}

export type PromotionsReleaseGate = Readonly<{
  approved: boolean;
  reason: string | null;
}>;

/**
 * Detects whether the given environment is an actual production or live money environment.
 * A bare environment variable or test approval argument must NEVER turn an actual production
 * instance into an authorized test-only bypass.
 */
export function isActualProductionInstance(
  source: Record<string, string | undefined> = process.env,
): boolean {
  // Live credentials always mean production / live money
  if (source.PAYSTACK_MODE === "live" || source.PAYSTACK_SECRET_KEY?.startsWith("sk_live_")) {
    return true;
  }

  // If a database URL is present and unsafe (e.g. live, production, remote cloud), it is production
  if (source.DATABASE_URL && !isSafeLocalTestDatabaseUrl(source.DATABASE_URL)) {
    return true;
  }

  // If NODE_ENV is production and not the authenticated isolated disposable browser runtime, it is production
  if (source.NODE_ENV === "production") {
    const isDisposable = isDisposableBrowserValidationAllowed(source as NodeJS.ProcessEnv);
    if (!isDisposable) return true;
  }

  return false;
}

export function evaluatePromotionsReleaseGate(
  source: Record<string, string | undefined> = process.env,
  operation?: PromotionOperation,
): PromotionsReleaseGate {
  const classification = classifyRuntimeEnvironment(source);
  if (!classification.isValid) {
    return Object.freeze({
      approved: false,
      reason: classification.conflictReason ?? "RUNTIME_CLASSIFICATION_INVALID",
    });
  }

  const switchState = resolveCommerceSwitch(source);
  const actualProd = isActualProductionInstance(source);

  if (actualProd) {
    // Release, reversal, and reconciliation of existing promotion commitments
    // must continue to operate even when the public switch is off so refunds
    // and cancellations never strand existing customer/merchant liabilities.
    if (operation && LIABILITY_CLEANUP_OPERATIONS.has(operation)) {
      return Object.freeze({ approved: true, reason: null });
    }
    if (switchState.hasConflictingLegacySwitch) {
      return Object.freeze({
        approved: false,
        reason: "CONFLICTING_COMMERCE_SWITCH_DEFINITIONS",
      });
    }
    if (!switchState.globalRequested) {
      return Object.freeze({
        approved: false,
        reason: PROMOTIONS_PRODUCTION_BLOCK_REASON,
      });
    }
    return Object.freeze({ approved: true, reason: null });
  }

  // Outside production, explicit KT_COMMERCE_ENABLED="false" still gates new
  // promotion evaluation/creation consistently while allowing liability cleanup.
  if (
    switchState.source === "KT_COMMERCE_ENABLED" &&
    !switchState.globalRequested &&
    (!operation || !LIABILITY_CLEANUP_OPERATIONS.has(operation))
  ) {
    return Object.freeze({
      approved: false,
      reason: PROMOTIONS_PRODUCTION_BLOCK_REASON,
    });
  }

  const isAuthorizedTestOrLocalContext =
    source.NODE_ENV === "test" ||
    isDisposableBrowserValidationAllowed(source as NodeJS.ProcessEnv) ||
    switchState.globalRequested;

  return Object.freeze({
    approved: isAuthorizedTestOrLocalContext,
    reason: isAuthorizedTestOrLocalContext ? null : PROMOTIONS_PRODUCTION_BLOCK_REASON,
  });
}

/**
 * Enforces runtime + global commerce switch eligibility for promotions.
 * In actual production, requires KT_COMMERCE_ENABLED=true (testApproval cannot
 * bypass production). Liability cleanup operations remain active when the
 * switch is turned off so existing commitments can always be released/reversed.
 */
export function assertPromotionsProductionReady(
  operation: PromotionOperation,
  testApproval?: { approved: true },
  source: Record<string, string | undefined> = process.env,
): void {
  const actualProd = isActualProductionInstance(source);
  if (actualProd) {
    const gate = evaluatePromotionsReleaseGate(source, operation);
    if (!gate.approved) {
      throw new PromotionsProductionLockedError(operation, gate.reason ?? PROMOTIONS_PRODUCTION_BLOCK_REASON);
    }
    return;
  }

  if (testApproval?.approved === true) return;

  const gate = evaluatePromotionsReleaseGate(source, operation);
  if (gate.approved) return;
  throw new PromotionsProductionLockedError(operation, gate.reason ?? PROMOTIONS_PRODUCTION_BLOCK_REASON);
}

export function promotionsProductionReady(
  source: Record<string, string | undefined> = process.env,
): boolean {
  return evaluatePromotionsReleaseGate(source).approved;
}
