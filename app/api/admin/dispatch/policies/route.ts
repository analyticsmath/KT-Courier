import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ok, created, badRequest, unprocessable, serverError, tooManyRequests } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS, getClientIp } from "@/lib/security/rate-limit";
import { formatZodErrors } from "@/lib/validation/auth";
import {
  createDispatchAutomationPolicyDraft,
  listDispatchAutomationPolicies,
  DispatchPolicyError,
} from "@/lib/dispatch/automation-policy.service";

const CreateDispatchAutomationPolicySchema = z.object({
  versionNumber: z.number().int().positive("Version number must be a positive integer."),
  regionIds: z.array(z.string().min(1)).min(1, "At least one region must be specified."),
  maxOfferAttempts: z.number().int().min(1).max(10, "Max offer attempts must be between 1 and 10."),
  effectiveFrom: z.string().datetime("Effective from must be a valid ISO datetime string."),
  effectiveUntil: z.string().datetime("Effective until must be a valid ISO datetime string.").optional().nullable(),
});

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.DISPATCH_MANAGE, { request: req });
  if (auth.response) return auth.response;

  try {
    const policies = await listDispatchAutomationPolicies();
    return ok({ policies });
  } catch (err) {
    console.error("[admin/dispatch/policies GET]", err);
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const ip = getClientIp(req);
  const rl = await checkIpRateLimit(req, `dispatch:policy:create:${ip}`, RATE_LIMITS.DISPATCH_ASSIGN);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

  const auth = await requireAdminApiPermission(PERMISSIONS.DISPATCH_MANAGE, { request: req });
  if (auth.response) return auth.response;
  const user = auth.user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = CreateDispatchAutomationPolicySchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  try {
    const policy = await createDispatchAutomationPolicyDraft({
      versionNumber: parsed.data.versionNumber,
      regionIds: parsed.data.regionIds,
      maxOfferAttempts: parsed.data.maxOfferAttempts,
      effectiveFrom: new Date(parsed.data.effectiveFrom),
      effectiveUntil: parsed.data.effectiveUntil ? new Date(parsed.data.effectiveUntil) : null,
      createdByUserId: user.id,
    });
    return created({ policy });
  } catch (err) {
    if (err instanceof DispatchPolicyError) return badRequest(err.message);
    console.error("[admin/dispatch/policies POST]", err);
    return serverError();
  }
}
