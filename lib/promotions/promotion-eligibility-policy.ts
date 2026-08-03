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
}

export interface RuleDefinition {
  rule: PromotionEligibilityRule;
  allowlistUserIds?: string[];
  region?: string;
  minimumSpendAmount?: Decimal;
  serviceType?: string;
}

export function evaluateEligibilityRule(ruleDef: RuleDefinition, context: EligibilityContext): boolean {
  switch (ruleDef.rule) {
    case "ALL_CUSTOMERS":
      return true;
    case "AUTHENTICATED_CUSTOMERS":
      return !context.isGuest && !!context.userId;
    case "FIRST_MARKETPLACE_ORDER":
      return !context.isGuest && context.priorCompletedOrdersCount === 0;
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
