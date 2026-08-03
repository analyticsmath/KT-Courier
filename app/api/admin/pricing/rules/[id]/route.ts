import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import {
  updatePricingRule,
  deactivatePricingRule,
} from "@/lib/services/pricing.service";
import { recordAdminActivity } from "@/lib/services/admin-activity.service";
import { PricingRuleUpdateSchema } from "@/lib/validation/pricing";
import type { PricingRuleUpdateInput } from "@/lib/validation/pricing";
import { formatZodErrors } from "@/lib/validation/auth";
import {
  ok,
  notFound,
  conflict,
  unprocessable,
  serverError,
} from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const auth = await requireAdminApiPermission(PERMISSIONS.PRICING_MANAGE, {
    request: req,
  });
  if (auth.response) return auth.response;
  const user = auth.user;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = PricingRuleUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }
  const supplied = Object.fromEntries(
    Object.entries(parsed.data).filter(([key]) =>
      typeof body === "object" && body !== null && Object.prototype.hasOwnProperty.call(body, key)
    )
  ) as PricingRuleUpdateInput;

  try {
    const rule = await updatePricingRule(id, supplied);
    if (!rule) return notFound("Pricing rule not found.");

    await recordAdminActivity({
      actorUserId: user.id,
      action: "UPDATE",
      entityType: "PricingRule",
      entityId: id,
      message: `Updated pricing rule "${rule.name}".`,
      metadata: { changes: Object.keys(supplied) },
    });

    return ok(rule);
  } catch (error) {
    if (error instanceof Error && error.message === "PRICING_RULE_CONFLICT") {
      return conflict("An equally-precedent active pricing rule already overlaps this effective period.");
    }
    if (error instanceof Error && error.message === "PRICING_RULE_STALE") {
      return conflict("This pricing rule changed. Refresh and review the latest revision.");
    }
    return serverError();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const auth = await requireAdminApiPermission(PERMISSIONS.PRICING_MANAGE, {
    request: req,
  });
  if (auth.response) return auth.response;
  const user = auth.user;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }
  const parsed = PricingRuleUpdateSchema.safeParse(body);
  if (!parsed.success) return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));

  try {
    const rule = await deactivatePricingRule(id, parsed.data.expectedRevision, parsed.data.changeReason);
    if (!rule) return notFound("Pricing rule not found.");

    await recordAdminActivity({
      actorUserId: user.id,
      action: "UPDATE",
      entityType: "PricingRule",
      entityId: id,
      message: `Deactivated pricing rule "${rule.name}".`,
    });

    return ok({ id: rule.id, active: rule.active });
  } catch (error) {
    if (error instanceof Error && error.message === "PRICING_RULE_STALE") {
      return conflict("This pricing rule changed. Refresh and review the latest revision.");
    }
    return serverError();
  }
}
