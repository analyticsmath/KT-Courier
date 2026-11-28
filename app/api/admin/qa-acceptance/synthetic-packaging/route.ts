import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { noStoreJson } from "@/lib/payments/customer-api-policy";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { PlatformError } from "@/lib/client-platform/contracts";
import {
  QaPackagingError,
  recordQaSyntheticPackageDraft,
  reviewAndActivateQaSyntheticPackaging,
} from "@/lib/qa-acceptance/synthetic-packaging";

const DraftSchema = z
  .object({
    runId: z.string().trim().min(1).max(100),
    storeId: z.string().trim().min(1).max(100),
    offerReference: z.string().trim().min(1).max(100),
    lengthCm: z.number().finite().positive().max(1000),
    widthCm: z.number().finite().positive().max(1000),
    heightCm: z.number().finite().positive().max(1000),
    weightKg: z.number().finite().positive().max(10000),
    reason: z.string().trim().min(10).max(400),
  })
  .strict();

const ActionSchema = z
  .object({
    version: z.number().int().positive(),
    expectedUpdatedAt: z.iso.datetime(),
    action: z.enum(["APPROVE", "ACTIVATE"]),
    reason: z.string().trim().min(10).max(400),
  })
  .strict();

function mapPackagingError(error: unknown) {
  if (error instanceof QaPackagingError) {
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
  if (error instanceof PlatformError) {
    return noStoreJson({ error: error.message, code: error.code }, error.status || 409);
  }
  return noStoreJson({ error: "QA synthetic packaging operation failed." }, 500);
}

export async function POST(request: NextRequest) {
  const originFailure = await enforceSameOriginRequest(request, {
    path: "/api/admin/qa-acceptance/synthetic-packaging",
  });
  if (originFailure) return originFailure;

  const auth = await requireAdminApiPermission(PERMISSIONS.COMMERCIAL_CONFIGURATION_MANAGE, {
    request,
  });
  if (auth.response) return auth.response;

  const rate = await checkIpRateLimit(
    request,
    `qa-synthetic-pkg:${auth.user.id}`,
    RATE_LIMITS.QA_ACCEPTANCE_MUTATION,
  );
  if (!rate.ok) {
    return noStoreJson({ error: "Rate limit exceeded." }, rate.failClosed ? 503 : 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return noStoreJson({ error: "Invalid JSON payload." }, 422);
  }
  const parsed = DraftSchema.safeParse(body);
  if (!parsed.success) {
    return noStoreJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid QA synthetic packaging draft." },
      422,
    );
  }

  try {
    const version = await recordQaSyntheticPackageDraft({
      actorUserId: auth.user.id,
      ...parsed.data,
    });
    return noStoreJson({ version }, 201);
  } catch (error) {
    return mapPackagingError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const originFailure = await enforceSameOriginRequest(request, {
    path: "/api/admin/qa-acceptance/synthetic-packaging",
  });
  if (originFailure) return originFailure;

  const auth = await requireAdminApiPermission(PERMISSIONS.COMMERCIAL_CONFIGURATION_MANAGE, {
    request,
  });
  if (auth.response) return auth.response;

  const rate = await checkIpRateLimit(
    request,
    `qa-synthetic-pkg-review:${auth.user.id}`,
    RATE_LIMITS.QA_ACCEPTANCE_MUTATION,
  );
  if (!rate.ok) {
    return noStoreJson({ error: "Rate limit exceeded." }, rate.failClosed ? 503 : 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return noStoreJson({ error: "Invalid JSON payload." }, 422);
  }
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) {
    return noStoreJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid QA synthetic packaging review." },
      422,
    );
  }

  try {
    const version = await reviewAndActivateQaSyntheticPackaging({
      actorUserId: auth.user.id,
      ...parsed.data,
    });
    return noStoreJson({ version });
  } catch (error) {
    return mapPackagingError(error);
  }
}
