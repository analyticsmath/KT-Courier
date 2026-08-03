import { getActivePricingRules } from "@/lib/services/pricing.service";
import { toPricingRuleDto } from "@/lib/dto/order.dto";
import { ok, serverError } from "@/lib/api/response";

// Public endpoint — returns active pricing rules for display (no auth required)
export async function GET() {
  try {
    const rules = await getActivePricingRules();
    return ok(rules.map(toPricingRuleDto));
  } catch {
    return serverError();
  }
}
