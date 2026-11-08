import { Decimal } from "@prisma/client/runtime/library";

export type PromotionEligibilityRule = 
  | "ALL_CUSTOMERS" 
  | "AUTHENTICATED_CUSTOMERS" 
  | "FIRST_MARKETPLACE_ORDER" 
  | "SPECIFIC_CUSTOMER_ALLOWLIST" 
  | "ACTIVE_SUBSCRIPTION_REQUIRED" 
  | "CUSTOMER_REGION" 
  | "MINIMUM_ELIGIBLE_SPEND" 
  | "SERVICE_TYPE";

export interface EligibilityContext {
  userId?: string;
  isGuest: boolean;
  priorCompletedOrdersCount: number;
  hasActiveSubscription: boolean;
  deliveryRegion: string;
  deliveryServiceType: string;
  subtotal: Decimal;
  customerSignedUpAt?: Date;
  evaluatedAt?: Date;
}

export interface RuleDefinition {
  rule: PromotionEligibilityRule;
  allowlistUserIds?: string[];
  region?: string;
  minimumSpendAmount?: Decimal;
  serviceType?: string;
  // When set by the campaign's admin-editable ruleValue, a welcome offer
  // expires this many days after verified customer registration.
  signupWithinDays?: number;
}

export function evaluateEligibilityRule(ruleDef: RuleDefinition, context: EligibilityContext): boolean {
  switch (ruleDef.rule) {
    case "ALL_CUSTOMERS":
      return true;
    case "AUTHENTICATED_CUSTOMERS":
      return !context.isGuest && !!context.userId;
    case "FIRST_MARKETPLACE_ORDER": {
      if (context.isGuest || !context.userId || context.priorCompletedOrdersCount !== 0) return false;
      if (ruleDef.signupWithinDays === undefined) return true;
      const days = ruleDef.signupWithinDays;
      if (!Number.isSafeInteger(days) || days <= 0 || days > 3650) return false;
      const signedUp = context.customerSignedUpAt?.getTime();
      const evaluated = context.evaluatedAt?.getTime();
      if (signedUp === undefined || evaluated === undefined
        || !Number.isFinite(signedUp) || !Number.isFinite(evaluated)
        || signedUp > evaluated) return false;
      return evaluated - signedUp <= days * 24 * 60 * 60 * 1000;
    }
    case "SPECIFIC_CUSTOMER_ALLOWLIST":
      return !context.isGuest && !!context.userId && (ruleDef.allowlistUserIds || []).includes(context.userId);
    case "ACTIVE_SUBSCRIPTION_REQUIRED":
      return !context.isGuest && context.hasActiveSubscription;
    case "CUSTOMER_REGION":
      return context.deliveryRegion === ruleDef.region;
    case "MINIMUM_ELIGIBLE_SPEND":
      return ruleDef.minimumSpendAmount ? context.subtotal.greaterThanOrEqualTo(ruleDef.minimumSpendAmount) : false;
    case "SERVICE_TYPE":
      return context.deliveryServiceType === ruleDef.serviceType;
    default:
      return false;
  }
}
