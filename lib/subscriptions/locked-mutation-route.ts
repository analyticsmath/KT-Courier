import { subscriptionJson } from "@/lib/subscriptions/api-policy";
import { SUBSCRIPTIONS_PRODUCTION_BLOCK_REASON } from "@/lib/subscriptions/production-lock";
/** A declared Phase 22 surface that remains fail-closed until the canonical provider/change composition is validated. */
export function subscriptionMutationSourceLocked() { return subscriptionJson({ error: "This membership mutation awaits consolidated validation.", code: SUBSCRIPTIONS_PRODUCTION_BLOCK_REASON }, 503); }
