import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { failure, json, mutation } from "@/lib/client-platform/api";
import {
  ModuleActivationError,
  ModuleActivationRequestSchema,
  ModuleActivationReviewSchema,
} from "@/lib/governance/module-activation";
import {
  requestDeveloperApiActivation,
  resolveDeveloperApiActivationState,
  reviewDeveloperApiActivation,
} from "@/lib/developer-api/activation";
import {
  requestReportingActivation,
  resolveReportingActivationState,
  reviewReportingActivation,
} from "@/lib/reporting/activation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function activationFailure(error: unknown) {
  if (error instanceof ModuleActivationError) {
    return json({ error: error.message, code: error.code }, error.status);
  }
  return failure(error);
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.SYSTEM_READINESS_READ, { request });
  if (auth.response) return auth.response;

  const [reporting, developerApi] = await Promise.all([
    resolveReportingActivationState(),
    resolveDeveloperApiActivationState(),
  ]);
  return json({ reporting, developerApi });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.SYSTEM_READINESS_MANAGE, { request });
  if (auth.response) return auth.response;

  const body = await mutation(request, `module-activation-request:${auth.user.id}`);
  if ("response" in body) return body.response;

  const parsed = ModuleActivationRequestSchema.safeParse(body.body);
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "Invalid activation request." }, 422);
  }

  try {
    const state =
      parsed.data.moduleKey === "REPORTING"
        ? await requestReportingActivation(auth.user.id, parsed.data)
        : await requestDeveloperApiActivation(auth.user.id, parsed.data);
    return json(state, 201);
  } catch (error) {
    return activationFailure(error);
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.SYSTEM_READINESS_MANAGE, { request });
  if (auth.response) return auth.response;

  const body = await mutation(request, `module-activation-review:${auth.user.id}`);
  if ("response" in body) return body.response;

  const parsed = ModuleActivationReviewSchema.safeParse(body.body);
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "Invalid activation review." }, 422);
  }

  try {
    const state =
      parsed.data.moduleKey === "REPORTING"
        ? await reviewReportingActivation(auth.user.id, parsed.data)
        : await reviewDeveloperApiActivation(auth.user.id, parsed.data);
    return json(state, 200);
  } catch (error) {
    return activationFailure(error);
  }
}
