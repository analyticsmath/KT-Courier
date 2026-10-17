import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ok, badRequest, notFound, conflict, unprocessable, serverError, tooManyRequests } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS, getClientIp } from "@/lib/security/rate-limit";
import { formatZodErrors } from "@/lib/validation/auth";
import {
  submitDispatchAutomationPolicy,
  approveDispatchAutomationPolicy,
  rejectDispatchAutomationPolicy,
  activateDispatchAutomationPolicy,
  retireDispatchAutomationPolicy,
  DispatchPolicyError,
} from "@/lib/dispatch/automation-policy.service";

const RejectPolicySchema = z.object({
  reasonCode: z.string().regex(/^[A-Z][A-Z0-9_]{2,79}$/, "A valid uppercase structured rejection reason is required."),
});

const ALLOWED_ACTIONS = ["submit", "approve", "reject", "activate", "retire"] as const;
type Action = typeof ALLOWED_ACTIONS[number];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const ip = getClientIp(req);
  const rl = await checkIpRateLimit(req, `dispatch:policy:action:${ip}`, RATE_LIMITS.DISPATCH_ASSIGN);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

  const auth = await requireAdminApiPermission(PERMISSIONS.DISPATCH_MANAGE, { request: req });
  if (auth.response) return auth.response;
  const user = auth.user;

  const { id: publicReference, action } = await params;
  if (!ALLOWED_ACTIONS.includes(action as Action)) {
    return notFound(`Unknown policy action: ${action}`);
  }

  try {
    let policy;
    switch (action as Action) {
      case "submit":
        policy = await submitDispatchAutomationPolicy(publicReference, user.id);
        break;
      case "approve":
        policy = await approveDispatchAutomationPolicy({ publicReference, approvedByUserId: user.id });
        break;
      case "reject": {
        let body: unknown;
        try {
          body = await req.json();
        } catch {
          return unprocessable("Invalid request body.");
        }
        const parsed = RejectPolicySchema.safeParse(body);
        if (!parsed.success) {
          return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
        }
        policy = await rejectDispatchAutomationPolicy({
          publicReference,
          rejectedByUserId: user.id,
          reasonCode: parsed.data.reasonCode,
        });
        break;
      }
      case "activate":
        policy = await activateDispatchAutomationPolicy({ publicReference, activatedByUserId: user.id });
        break;
      case "retire":
        policy = await retireDispatchAutomationPolicy(publicReference, user.id);
        break;
    }
    return ok({ policy });
  } catch (err) {
    if (err instanceof DispatchPolicyError) {
      if (err.code === "DISPATCH_POLICY_SELF_APPROVAL") return conflict(err.message);
      if (err.code === "DISPATCH_POLICY_INVALID_STATE") return conflict(err.message);
      return badRequest(err.message);
    }
    console.error(`[admin/dispatch/policies/${publicReference}/${action} POST]`, err);
    return serverError();
  }
}
