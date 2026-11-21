/**
 * KT Couriers — Single Authoritative Public Commerce Switch Parser
 *
 * Canonical variable: `KT_COMMERCE_ENABLED`
 * Legacy rolling-deploy fallback: `CHECKOUT_PUBLIC_ENABLED` (used ONLY when
 * `KT_COMMERCE_ENABLED` is completely absent/blank).
 *
 * Security invariants:
 * - Never defaults to `true`.
 * - Never authorizes payment SUCCEEDED, ledger journals, webhooks, payouts,
 *   merchant approval, or high-risk overrides.
 * - Never logs or echoes credential values.
 */

export type CommerceSwitchSource =
  | "KT_COMMERCE_ENABLED"
  | "LEGACY_CHECKOUT_PUBLIC_ENABLED"
  | "UNSET";

export type CommerceSwitchResolution = Readonly<{
  globalRequested: boolean;
  source: CommerceSwitchSource;
  hasConflictingLegacySwitch: boolean;
  warnings: readonly string[];
}>;

export type EnvironmentRecord = Readonly<Record<string, string | undefined>>;

function parseExplicitBoolean(raw: string | undefined): boolean | null {
  if (raw === undefined) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "") return null;
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  // Any unrecognized non-empty value fails closed as false while still being
  // treated as explicitly defined (preventing silent legacy fallback).
  return false;
}

/**
 * Resolves the single authoritative platform-level public commerce switch.
 *
 * During rolling deployment:
 * - Reads `KT_COMMERCE_ENABLED` whenever defined (non-empty).
 * - Only if `KT_COMMERCE_ENABLED` is absent/empty, preserves the prior
 *   `CHECKOUT_PUBLIC_ENABLED` value and emits a safe deprecation warning.
 * - If both are defined with conflicting boolean values, `KT_COMMERCE_ENABLED`
 *   wins unconditionally and a safe conflict warning is emitted.
 */
export function resolveCommerceSwitch(
  source: EnvironmentRecord = process.env,
): CommerceSwitchResolution {
  const canonical = parseExplicitBoolean(source.KT_COMMERCE_ENABLED);
  const legacy = parseExplicitBoolean(source.CHECKOUT_PUBLIC_ENABLED);

  if (canonical !== null) {
    const conflicting = legacy !== null && legacy !== canonical;
    const warnings: string[] = [];
    if (conflicting) {
      warnings.push("CONFLICTING_COMMERCE_SWITCH_DEFINITIONS");
    }
    return Object.freeze({
      globalRequested: canonical,
      source: "KT_COMMERCE_ENABLED",
      hasConflictingLegacySwitch: conflicting,
      warnings: Object.freeze(warnings),
    });
  }

  if (legacy !== null) {
    return Object.freeze({
      globalRequested: legacy,
      source: "LEGACY_CHECKOUT_PUBLIC_ENABLED",
      hasConflictingLegacySwitch: false,
      warnings: Object.freeze(["LEGACY_SWITCH_FALLBACK_ACTIVE"]),
    });
  }

  return Object.freeze({
    globalRequested: false,
    source: "UNSET",
    hasConflictingLegacySwitch: false,
    warnings: Object.freeze([]),
  });
}
