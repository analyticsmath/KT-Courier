import { type NextRequest } from "next/server";
import { z } from "zod";
import { QaAcceptanceRole } from "@prisma/client";
import { requireSuperAdminApi } from "@/lib/auth/admin-api";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { forbidden } from "@/lib/api/response";
import { noStoreJson } from "@/lib/payments/customer-api-policy";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import {
  enrollQaAcceptancePrincipal,
  getQaAcceptanceDashboard,
  QaAcceptanceError,
  startQaAcceptanceRun,
} from "@/lib/qa-acceptance/service";

const PostActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("ENROLL_PRINCIPAL"),
    userIdentifier: z.string().trim().min(1).max(200),
    role: z.nativeEnum(QaAcceptanceRole),
    storeIdentifier: z.string().trim().max(200).optional(),
    label: z.string().trim().max(160).optional(),
    notes: z.string().trim().max(500).optional(),
  }),
  z.object({
    action: z.literal("START_RUN"),
    title: z.string().trim().min(1).max(160),
    storeId: z.string().trim().max(100).nullable().optional(),
    customerUserId: z.string().trim().max(100).nullable().optional(),
    driverProfileId: z.string().trim().max(100).nullable().optional(),
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
  return noStoreJson({ error: "QA acceptance request could not be completed safely." }, 500);
}

export async function GET(request: NextRequest) {
  const auth = await authorizeQaAdminApi(request);
  if ("error" in auth) return auth.error;

  const rate = await checkIpRateLimit(request, `qa-acceptance-read:${auth.user.id}`, RATE_LIMITS.PAYMENT_STATUS);
  if (!rate.ok) return noStoreJson({ error: "Too many QA acceptance requests." }, 429);

  const q = request.nextUrl.searchParams.get("q")?.slice(0, 120) ?? undefined;
  try {
    const dashboard = await getQaAcceptanceDashboard(q);
    return noStoreJson({ dashboard });
  } catch (error) {
    return mapQaError(error);
  }
}

export async function POST(request: NextRequest) {
  const originFailure = await enforceSameOriginRequest(request, { path: "/api/admin/qa-acceptance" });
  if (originFailure) return originFailure;

  const auth = await authorizeQaAdminApi(request);
  if ("error" in auth) return auth.error;

  const rate = await checkIpRateLimit(
    request,
    `qa-acceptance-write:${auth.user.id}`,
    RATE_LIMITS.QA_ACCEPTANCE_MUTATION,
  );
  if (!rate.ok) {
    return rate.failClosed
      ? noStoreJson({ error: "Service temporarily unavailable." }, 503)
      : noStoreJson({ error: "QA acceptance write rate limit reached." }, 429);
  }

  let rawBody: unknown;
  try {
    const text = await request.text();
    if (!text || text.length > 8192) {
      return noStoreJson({ error: "Request body is missing or exceeds size limit." }, 413);
    }
    rawBody = JSON.parse(text);
  } catch {
    return noStoreJson({ error: "Invalid JSON payload." }, 422);
  }

  const parsed = PostActionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.issues[0]?.message ?? "Invalid QA acceptance payload." }, 422);
  }

  try {
    if (parsed.data.action === "ENROLL_PRINCIPAL") {
      const principal = await enrollQaAcceptancePrincipal({
        actorUserId: auth.user.id,
        userIdentifier: parsed.data.userIdentifier,
        role: parsed.data.role,
        ...(parsed.data.storeIdentifier ? { storeIdentifier: parsed.data.storeIdentifier } : {}),
        ...(parsed.data.label ? { label: parsed.data.label } : {}),
        ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
      });
      return noStoreJson({ principal }, 201);
    }

    const run = await startQaAcceptanceRun({
      actorUserId: auth.user.id,
      title: parsed.data.title,
      storeId: parsed.data.storeId ?? null,
      customerUserId: parsed.data.customerUserId ?? null,
      driverProfileId: parsed.data.driverProfileId ?? null,
    });
    return noStoreJson({ run }, 201);
  } catch (error) {
    return mapQaError(error);
  }
}
