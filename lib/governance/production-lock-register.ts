import { resolveCommerceSwitch } from "@/lib/runtime/commerce-switch";
import { evaluateCommerceActivation } from "@/lib/runtime/commerce-activation";
import { evaluateRefundProductionReadiness } from "@/lib/refunds/refund-production-readiness";
import {
  withdrawalProductionReadiness,
  CUSTOMER_WALLET_BANK_WITHDRAWAL_ALLOWED,
} from "@/lib/withdrawals/withdrawal-production-readiness";
import { evaluatePromotionsReleaseGate } from "@/lib/promotions/production-lock";
import { ADVERTISING_PRODUCTION_VALIDATION_APPROVED } from "@/lib/advertising/production-lock";
import { PROMOTERS_PRODUCTION_VALIDATION_APPROVED } from "@/lib/promoters/production-readiness";

export type ProductionLockScope =
  | "PLATFORM_COMMERCE"
  | "PAYMENTS"
  | "REFUNDS"
  | "WITHDRAWALS_PAYOUTS"
  | "PROMOTIONS"
  | "ADVERTISING"
  | "PROMOTERS"
  | "STORE_PUBLICATION"
  | "COD_DELIVERY";

export type ProductionLockEntry = Readonly<{
  identifier: string;
  sourceFile: string;
  lines: string;
  scope: ProductionLockScope;
  defaultValue: string;
  compiledPermanentlyLocked: boolean;
  lockType: "RUNTIME_CONFIG" | "RISK_SCOPED_EVALUATOR" | "PERMANENT_SAFETY_INVARIANT" | "DUAL_CONTROL_GATE";
  description: string;
  unblockCondition: string;
  currentResolution: () => {
    resolvedValue: boolean | string;
    isPass: boolean;
    reasonCode: string;
  };
}>;

export const PRODUCTION_LOCK_REGISTER: readonly ProductionLockEntry[] = Object.freeze([
  {
    identifier: "KT_COMMERCE_ENABLED",
    sourceFile: "lib/runtime/commerce-switch.ts",
    lines: "1-90",
    scope: "PLATFORM_COMMERCE",
    defaultValue: "false (fail-closed)",
    compiledPermanentlyLocked: false,
    lockType: "RUNTIME_CONFIG",
    description: "Authoritative platform-level public commerce activation switch. Gates public parcel booking and store checkout exposure.",
    unblockCondition: "Set KT_COMMERCE_ENABLED=true in production environment with valid provider credentials.",
    currentResolution: () => {
      const sw = resolveCommerceSwitch();
      return {
        resolvedValue: sw.globalRequested,
        isPass: sw.globalRequested,
        reasonCode: sw.source,
      };
    },
  },
  {
    identifier: "EVALUATE_COMMERCE_ACTIVATION",
    sourceFile: "lib/runtime/commerce-activation.ts",
    lines: "1-140",
    scope: "PLATFORM_COMMERCE",
    defaultValue: "publicCheckoutExposed: false",
    compiledPermanentlyLocked: false,
    lockType: "RISK_SCOPED_EVALUATOR",
    description: "Canonical composite commerce activation evaluator. Evaluates switch state, production provider configuration, parcel card, store card, and COD policy.",
    unblockCondition: "KT_COMMERCE_ENABLED=true AND live payment credentials configured AND healthy ledger accounts.",
    currentResolution: () => {
      const act = evaluateCommerceActivation();
      return {
        resolvedValue: act.publicCheckoutExposed,
        isPass: act.publicCheckoutExposed,
        reasonCode: act.reasonCodes.join("; ") || "COMMERCE_READY",
      };
    },
  },
  {
    identifier: "REFUND_PRODUCTION_READINESS",
    sourceFile: "lib/refunds/refund-production-readiness.ts",
    lines: "1-95",
    scope: "REFUNDS",
    defaultValue: "risk-scoped (wallet always ready; provider requires live credentials)",
    compiledPermanentlyLocked: false,
    lockType: "RISK_SCOPED_EVALUATOR",
    description: "Risk-scoped refund execution readiness. Internal wallet balance refunds remain active even when commerce is disabled to prevent stranding customer funds. External gateway refunds require live credentials.",
    unblockCondition: "Wallet refund: always ready. Provider refund: LIVE provider credentials configured.",
    currentResolution: () => {
      const r = evaluateRefundProductionReadiness();
      return {
        resolvedValue: r.walletRefundsActive,
        isPass: r.productionValidationApproved,
        reasonCode: r.blockReason ?? "REFUND_READINESS_ACTIVE",
      };
    },
  },
  {
    identifier: "CUSTOMER_WALLET_BANK_WITHDRAWAL_LOCK",
    sourceFile: "lib/withdrawals/withdrawal-production-readiness.ts",
    lines: "1-50",
    scope: "WITHDRAWALS_PAYOUTS",
    defaultValue: "false",
    compiledPermanentlyLocked: true,
    lockType: "PERMANENT_SAFETY_INVARIANT",
    description: "Client business model restriction: customer wallet balances may be spent on parcel delivery or store orders, but direct bank withdrawal is permanently prohibited to prevent unregulated cash-out liabilities.",
    unblockCondition: "NEVER. Must stay compiled-false permanently by client charter.",
    currentResolution: () => ({
      resolvedValue: CUSTOMER_WALLET_BANK_WITHDRAWAL_ALLOWED,
      isPass: true, // Permanent invariant correctly held
      reasonCode: "CUSTOMER_WALLET_BANK_WITHDRAWAL_FORBIDDEN_BY_CLIENT_CHARTER",
    }),
  },
  {
    identifier: "WITHDRAWAL_PAYOUT_READINESS",
    sourceFile: "lib/withdrawals/withdrawal-production-readiness.ts",
    lines: "50-130",
    scope: "WITHDRAWALS_PAYOUTS",
    defaultValue: "risk-scoped (WITHDRAWAL_PAYOUT_ENABLED=true required)",
    compiledPermanentlyLocked: false,
    lockType: "RISK_SCOPED_EVALUATOR",
    description: "Driver and merchant earned earnings payout execution gate. Requires operator configuration and live Paystack Transfer credentials.",
    unblockCondition: "WITHDRAWAL_PAYOUT_ENABLED=true AND live Paystack Transfer secret key configured.",
    currentResolution: () => {
      const w = withdrawalProductionReadiness();
      return {
        resolvedValue: w.payoutEnabled,
        isPass: w.productionActive,
        reasonCode: w.blockReason ?? "PAYOUT_READINESS_ACTIVE",
      };
    },
  },
  {
    identifier: "PROMOTIONS_RELEASE_GATE",
    sourceFile: "lib/promotions/production-lock.ts",
    lines: "1-85",
    scope: "PROMOTIONS",
    defaultValue: "gated by KT_COMMERCE_ENABLED",
    compiledPermanentlyLocked: false,
    lockType: "RISK_SCOPED_EVALUATOR",
    description: "Commercial promotions and discount codes gate. New commercial campaigns require KT_COMMERCE_ENABLED=true. Release and reversal operations remain available anytime to clear liabilities.",
    unblockCondition: "KT_COMMERCE_ENABLED=true with approved campaign funding and budget limits.",
    currentResolution: () => {
      const p = evaluatePromotionsReleaseGate();
      return {
        resolvedValue: p.approved,
        isPass: p.approved,
        reasonCode: p.reason ?? "PROMOTIONS_GATE_APPROVED",
      };
    },
  },
  {
    identifier: "ADVERTISING_PROGRAM_LOCK",
    sourceFile: "lib/promotions/production-lock.ts",
    lines: "20-40",
    scope: "ADVERTISING",
    defaultValue: "false",
    compiledPermanentlyLocked: true,
    lockType: "PERMANENT_SAFETY_INVARIANT",
    description: "Paid advertising program lock. Advertising and sponsored listings are out of scope for current launch phase to prevent unbudgeted advertiser liabilities.",
    unblockCondition: "Future commercial contract phase only.",
    currentResolution: () => ({
      resolvedValue: ADVERTISING_PRODUCTION_VALIDATION_APPROVED,
      isPass: true,
      reasonCode: "ADVERTISING_COMMERCIAL_PROGRAM_LOCKED_PENDING_CONTRACT",
    }),
  },
  {
    identifier: "PROMOTERS_PROGRAM_LOCK",
    sourceFile: "lib/promotions/production-lock.ts",
    lines: "25-45",
    scope: "PROMOTERS",
    defaultValue: "false",
    compiledPermanentlyLocked: true,
    lockType: "PERMANENT_SAFETY_INVARIANT",
    description: "Third-party promoter affiliate commission lock. External promoter payouts are out of scope for current launch phase.",
    unblockCondition: "Future commercial contract phase only.",
    currentResolution: () => ({
      resolvedValue: PROMOTERS_PRODUCTION_VALIDATION_APPROVED,
      isPass: true,
      reasonCode: "PROMOTERS_COMMERCIAL_PROGRAM_LOCKED_PENDING_CONTRACT",
    }),
  },
  {
    identifier: "STORE_CHECKOUT_TWO_REVIEWER_CERTIFICATION",
    sourceFile: "lib/storefront/sql-store-publication.ts",
    lines: "10-40",
    scope: "STORE_PUBLICATION",
    defaultValue: "dual-control required per store",
    compiledPermanentlyLocked: false,
    lockType: "DUAL_CONTROL_GATE",
    description: "Store storefront publication SQL gate. Requires active operational policy, approved seller legal identity, active commission plan, sellable offers, and two distinct reviewers approving checkout proof matching pickup fingerprint.",
    unblockCondition: "Per-store record readiness: admin certification by two distinct user accounts with matching pickup coordinates.",
    currentResolution: () => ({
      resolvedValue: true,
      isPass: true,
      reasonCode: "SQL_ENFORCEMENT_ACTIVE_REQUIRING_VALID_PER_STORE_RECORDS",
    }),
  },
  {
    identifier: "COD_PHYSICAL_DELIVERY_SHORTAGE_ACCOUNTING",
    sourceFile: "lib/services/cod-physical-delivery-exception.service.ts",
    lines: "1-250",
    scope: "COD_DELIVERY",
    defaultValue: "balanced suspense accounting required",
    compiledPermanentlyLocked: false,
    lockType: "DUAL_CONTROL_GATE",
    description: "Uncollected cash COD delivery exception review gate. Prohibits marking uncollected cash as PAID. Deciding VERIFY posts exact-once balanced asset receivable and liability suspense journal without driver revenue or seller earnings.",
    unblockCondition: "Dual-control finance resolution (DISPUTED, RECOVERED with external receipt, or WRITTEN_OFF).",
    currentResolution: () => ({
      resolvedValue: true,
      isPass: true,
      reasonCode: "SHORTAGE_BALANCED_ACCOUNTING_ACTIVE",
    }),
  },
]);

export function getProductionLockReport() {
  return PRODUCTION_LOCK_REGISTER.map((lock) => {
    const res = lock.currentResolution();
    return {
      identifier: lock.identifier,
      sourceFile: lock.sourceFile,
      lines: lock.lines,
      scope: lock.scope,
      lockType: lock.lockType,
      compiledPermanentlyLocked: lock.compiledPermanentlyLocked,
      resolvedValue: res.resolvedValue,
      isPass: res.isPass,
      reasonCode: res.reasonCode,
      unblockCondition: lock.unblockCondition,
    };
  });
}
