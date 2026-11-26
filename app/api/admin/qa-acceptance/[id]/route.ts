import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/auth/admin-api";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { forbidden } from "@/lib/api/response";
import { noStoreJson } from "@/lib/payments/customer-api-policy";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import {
  QaAcceptanceError,
  revokeQaAcceptancePrincipal,
  updateQaAcceptanceRunLifecycle,
} from "@/lib/qa-acceptance/service";

const PatchActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("REVOKE_PRINCIPAL"),
    reason: z.string().trim().max(300).optional(),
  }),
  z.object({
    action: z.literal("COMPLETE_RUN"),
  }),
  z.object({
    action: z.literal("ARCHIVE_AND_TEARDOWN"),
    reason: z.string().trim().max(300).optional(),
  }),
]);

async function authorizeQaAdminApi(request: NextRequest) {
  const auth = await requireSuperAdminApi({ request });
  if (auth.response || !auth.user) {
    return { error: auth.response ?? forbidden() } as const;
  }
  const allowed = await hasPermission({
    userId: auth.user.id,
    role: auth.user.role,
    permissionKey: PERMISSIONS.SYSTEM_READINESS_MANAGE,
  });
  if (!allowed && auth.user.role !== "SUPER_ADMIN") {
    return { error: forbidden() } as const;
  }
  return { user: auth.user } as const;
}

function mapQaError(error: unknown) {
  if (error instanceof QaAcceptanceError) {
    const status =
      error.code === "QA_INVALID_INPUT"
        ? 422
        : error.code === "QA_NOT_FOUND"
          ? 404
          : error.code === "QA_CONFIG_UNAVAILABLE"
            ? 503
            : 409;
    return noStoreJson({ error: error.message, code: error.code }, status);
  }
  return noStoreJson({ error: "QA acceptance mutation could not be completed safely." }, 500);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const originFailure = await enforceSameOriginRequest(request, {
    path: request.nextUrl.pathname || "/api/admin/qa-acceptance/[id]",
  });
  if (originFailure) return originFailure;

  const auth = await authorizeQaAdminApi(request);
  if ("error" in auth) return auth.error;

  const rate = await checkIpRateLimit(
    request,
    `qa-acceptance-mutate:${auth.user.id}`,
    RATE_LIMITS.QA_ACCEPTANCE_MUTATION,
  );
  if (!rate.ok) {
    return rate.failClosed
      ? noStoreJson({ error: "Service temporarily unavailable." }, 503)
      : noStoreJson({ error: "QA acceptance rate limit reached." }, 429);
  }

  const { id } = await context.params;
  if (!id || id.length > 100) {
    return noStoreJson({ error: "Invalid identifier." }, 422);
  }

  let rawBody: unknown;
  try {
    const text = await request.text();
    if (!text || text.length > 4096) {
      return noStoreJson({ error: "Request body is missing or exceeds size limit." }, 413);
    }
    rawBody = JSON.parse(text);
  } catch {
    return noStoreJson({ error: "Invalid JSON payload." }, 422);
  }

  const parsed = PatchActionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.issues[0]?.message ?? "Invalid action payload." }, 422);
  }

  try {
    if (parsed.data.action === "REVOKE_PRINCIPAL") {
      const principal = await revokeQaAcceptancePrincipal({
        actorUserId: auth.user.id,
        principalId: id,
        reason: parsed.data.reason ?? "Revoked via QA acceptance control center",
      });
      return noStoreJson({ principal });
    }

    const run = await updateQaAcceptanceRunLifecycle({
      actorUserId: auth.user.id,
      runId: id,
      action: parsed.data.action === "COMPLETE_RUN" ? "COMPLETE" : "ARCHIVE_AND_TEARDOWN",
      ...(parsed.data.action === "ARCHIVE_AND_TEARDOWN" && parsed.data.reason
        ? { reason: parsed.data.reason }
        : {}),
    });
    return noStoreJson({ run });
  } catch (error) {
    return mapQaError(error);
  }
}
