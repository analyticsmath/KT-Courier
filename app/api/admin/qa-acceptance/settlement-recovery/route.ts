import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { hasPermission } from "@/lib/auth/permissions";
import { forbidden } from "@/lib/api/response";
import { noStoreJson } from "@/lib/payments/customer-api-policy";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { prisma } from "@/lib/db/prisma";
import {
  listAllQaSettlementRecoveries,
  prepareQaSettlementRecovery,
  QaSettlementRecoveryError,
  reviewQaSettlementRecovery,
} from "@/lib/qa-acceptance/settlement-recovery";
import {
  diagnoseDriverSettlementReadiness,
  produceDriverSettlementsBatch,
} from "@/lib/services/driver-settlement-producer.service";

const PrepareSchema = z
  .object({
    orderId: z.string().trim().min(1).max(100),
    planPublicReference: z.string().trim().min(4).max(100),
    reason: z.string().trim().min(10).max(500),
  })
  .strict();

const ReviewOrBatchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.enum(["APPROVE", "REVOKE"]),
    orderId: z.string().trim().min(1).max(100),
    expectedVersion: z.number().int().positive(),
    reason: z.string().trim().min(10).max(500),
    settleImmediately: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("RUN_BATCH"),
    mode: z.enum(["DRY_RUN", "APPLY"]).default("APPLY"),
  }),
]);

async function authorizeFinanceOrCommissionAdmin(
  request: NextRequest,
  requiredPermission: string,
) {
  const auth = await requireAdminApiPermission(requiredPermission, { request });
  if (auth.response) return { error: auth.response } as const;
  const hasFinanceReadOrManage = await hasPermission({
    userId: auth.user.id,
    role: auth.user.role,
    permissionKey: PERMISSIONS.FINANCE_READ,
  });
  if (!hasFinanceReadOrManage) {
    return { error: forbidden() } as const;
  }
  return { user: auth.user } as const;
}

function mapRecoveryError(error: unknown) {
  if (error instanceof QaSettlementRecoveryError) {
    const status =
      error.code === "QA_RECOVERY_INVALID_INPUT"
        ? 422
        : error.code === "QA_RECOVERY_NOT_FOUND"
          ? 404
          : error.code === "QA_RECOVERY_CONFIG_UNAVAILABLE"
            ? 503
            : error.code === "QA_RECOVERY_INDEPENDENT_REVIEW_REQUIRED"
              ? 403
              : 409;
    return noStoreJson({ error: error.message, code: error.code }, status);
  }
  return noStoreJson(
    {
      error: error instanceof Error ? error.message : "QA settlement recovery failed.",
      code: typeof (error as { code?: unknown })?.code === "string" ? (error as { code: string }).code : undefined,
    },
    409,
  );
}

export async function GET(request: NextRequest) {
  const auth = await authorizeFinanceOrCommissionAdmin(
    request,
    PERMISSIONS.COMMISSION_PLANS_READ,
  );
  if ("error" in auth) return auth.error;

  const rate = await checkIpRateLimit(
    request,
    `qa-settlement-recovery-read:${auth.user.id}`,
    RATE_LIMITS.PAYMENT_STATUS,
  );
  if (!rate.ok) {
    return noStoreJson({ error: "Rate limit exceeded." }, rate.failClosed ? 503 : 429);
  }

  const [orders, plans, recoveries] = await Promise.all([
    prisma.order.findMany({
      where: {
        isQaAcceptance: true,
        status: { in: ["DELIVERED", "COMPLETED"] },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 30,
      select: {
        id: true,
        orderNumber: true,
        priceEstimate: true,
        pricingQuote: { select: { total: true } },
        driverEarnings: { select: { publicReference: true }, take: 1 },
      },
    }),
    prisma.commissionPlan.findMany({
      where: {
        subjectType: "COURIER_ORDER",
        scopeKey: { in: ["GLOBAL:COURIER_ORDER", "QA:COURIER_ORDER"] },
        status: "ACTIVE",
      },
      select: {
        publicReference: true,
        scopeKey: true,
        versionNumber: true,
        effectiveFrom: true,
        approvedAt: true,
      },
    }),
    listAllQaSettlementRecoveries(),
  ]);

  const byOrder = new Map(recoveries.map((r) => [r.orderId, r]));
  const items = await Promise.all(
    orders.map(async (ord) => {
      const amount = ord.pricingQuote?.total ?? ord.priceEstimate;
      return {
        orderId: ord.id,
        orderNumber: ord.orderNumber,
        totalAmountZar: amount ? amount.toFixed(2) : "0.00",
        diagnostic: await diagnoseDriverSettlementReadiness(ord.id).catch(() => null),
        recovery: byOrder.get(ord.id) ?? null,
      };
    }),
  );

  return noStoreJson({ items, plans });
}

export async function POST(request: NextRequest) {
  const originFailure = await enforceSameOriginRequest(request, {
    path: "/api/admin/qa-acceptance/settlement-recovery",
  });
  if (originFailure) return originFailure;

  const auth = await authorizeFinanceOrCommissionAdmin(
    request,
    PERMISSIONS.COMMISSION_PLANS_MANAGE,
  );
  if ("error" in auth) return auth.error;

  const rate = await checkIpRateLimit(
    request,
    `qa-settlement-recovery-write:${auth.user.id}`,
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
  const parsed = PrepareSchema.safeParse(body);
  if (!parsed.success) {
    return noStoreJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid QA settlement recovery request." },
      422,
    );
  }

  try {
    const recovery = await prepareQaSettlementRecovery({
      actorUserId: auth.user.id,
      ...parsed.data,
    });
    return noStoreJson({ recovery }, 201);
  } catch (error) {
    return mapRecoveryError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const originFailure = await enforceSameOriginRequest(request, {
    path: "/api/admin/qa-acceptance/settlement-recovery",
  });
  if (originFailure) return originFailure;

  const auth = await authorizeFinanceOrCommissionAdmin(
    request,
    PERMISSIONS.COMMISSION_PLANS_APPROVE,
  );
  if ("error" in auth) return auth.error;

  const rate = await checkIpRateLimit(
    request,
    `qa-settlement-recovery-review:${auth.user.id}`,
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
  const parsed = ReviewOrBatchSchema.safeParse(body);
  if (!parsed.success) {
    return noStoreJson(
      { error: parsed.error.issues[0]?.message ?? "Invalid QA settlement review payload." },
      422,
    );
  }

  try {
    if (parsed.data.action === "RUN_BATCH") {
      const batch = await produceDriverSettlementsBatch({ mode: parsed.data.mode });
      return noStoreJson({ batch });
    }
    const result = await reviewQaSettlementRecovery({
      actorUserId: auth.user.id,
      orderId: parsed.data.orderId,
      expectedVersion: parsed.data.expectedVersion,
      action: parsed.data.action,
      reason: parsed.data.reason,
      settleImmediately: parsed.data.settleImmediately,
    });
    return noStoreJson(result);
  } catch (error) {
    return mapRecoveryError(error);
  }
}
