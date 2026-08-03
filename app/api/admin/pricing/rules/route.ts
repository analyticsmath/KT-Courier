import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getAllPricingRules, createPricingRule } from "@/lib/services/pricing.service";
import { recordAdminActivity } from "@/lib/services/admin-activity.service";
import { PricingRuleCreateSchema } from "@/lib/validation/pricing";
import { formatZodErrors } from "@/lib/validation/auth";
import {
  ok,
  created,
  conflict,
  unprocessable,
  serverError,
} from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";

export async function GET() {
  const auth = await requireAdminApiPermission(PERMISSIONS.PRICING_READ);
  if (auth.response) return auth.response;

  try {
    const rules = await getAllPricingRules();
    return ok(rules);
  } catch (error) {
    if (error instanceof Error && error.message === "PRICING_RULE_CONFLICT") {
      return conflict("An equally-precedent active pricing rule already overlaps this effective period.");
    }
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const auth = await requireAdminApiPermission(PERMISSIONS.PRICING_MANAGE, {
    request: req,
  });
  if (auth.response) return auth.response;
  const user = auth.user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = PricingRuleCreateSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  try {
    const rule = await createPricingRule(parsed.data);

    await recordAdminActivity({
      actorUserId: user.id,
      action: "CREATE",
      entityType: "PricingRule",
      entityId: rule.id,
      message: `Created pricing rule "${rule.name}".`,
      metadata: { deliveryType: rule.deliveryType, amount: rule.amount, currency: rule.currency },
    });

    return created(rule);
  } catch (error) {
    if (error instanceof Error && error.message === "PRICING_RULE_CONFLICT") {
      return conflict("An equally-precedent active pricing rule already overlaps this effective period.");
    }
    return serverError();
  }
}
