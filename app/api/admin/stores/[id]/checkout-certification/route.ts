import { z } from "zod";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { badRequest, conflict, notFound, ok, serverError, unprocessable } from "@/lib/api/response";
import {
  prepareStoreCheckoutCertification, approveStoreCheckoutCertification,
  StoreCertificationError,
} from "@/lib/admin/store-checkout-certification.service";

const evidence = z.object({
  routeEvidenceReference: z.string().trim().min(12).max(160),
  routeEvidenceDigest: z.string().regex(/^[a-f0-9]{64}$/),
  checkoutEvidenceReference: z.string().trim().min(12).max(160),
  checkoutEvidenceDigest: z.string().regex(/^[a-f0-9]{64}$/),
  reviewNote: z.string().trim().min(24).max(2000),
}).strict();
const approval = z.object({ expectedRevision: z.number().int().nonnegative() }).strict();

async function reviewer(request: NextRequest) {
  const store = await requireAdminApiPermission(PERMISSIONS.STORES_APPROVE, { request });
  if (store.response) return store;
  const finance = await requireAdminApiPermission(PERMISSIONS.ORDERS_READ, { request });
  return finance.response ? finance : store;
}

function errorResponse(error: unknown) {
  if (error instanceof StoreCertificationError) {
    if (error.code === "STORE_NOT_FOUND") return notFound(error.message);
    if (["CERTIFICATION_VERSION_CONFLICT", "STORE_PICKUP_CHANGED", "CERTIFICATION_ALREADY_APPROVED"].includes(error.code)) return conflict(error.message);
    return unprocessable(error.message);
  }
  return serverError();
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiPermission(PERMISSIONS.STORES_READ, { request });
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const cert = await prisma.storeCheckoutCertification.findUnique({
    where: { storeId: id },
    select: {
      status: true, revision: true, preparedAt: true, approvedAt: true, expiresAt: true,
      routeEvidenceReference: true, checkoutEvidenceReference: true,
      pickupAddressId: true, coverageRegionId: true, reviewNote: true,
      preparedByUserId: true, approvedByUserId: true,
    },
  });
  return ok({ certification: cert });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const origin = await enforceSameOriginRequest(request);
  if (origin) return origin;
  const auth = await reviewer(request);
  if (auth.response) return auth.response;
  let raw: unknown;
  try { raw = await request.json(); } catch { return badRequest("Invalid JSON body."); }
  const parsed = evidence.safeParse(raw);
  if (!parsed.success) return unprocessable("Two staging receipt references, digests and review notes are required.");
  try {
    const { id } = await context.params;
    return ok(await prepareStoreCheckoutCertification(id, auth.user.id, parsed.data));
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const origin = await enforceSameOriginRequest(request);
  if (origin) return origin;
  const auth = await reviewer(request);
  if (auth.response) return auth.response;
  let raw: unknown;
  try { raw = await request.json(); } catch { return badRequest("Invalid JSON body."); }
  const parsed = approval.safeParse(raw);
  if (!parsed.success) return unprocessable("The current certificate revision is required.");
  try {
    const { id } = await context.params;
    return ok(await approveStoreCheckoutCertification(id, auth.user.id, parsed.data.expectedRevision));
  } catch (error) { return errorResponse(error); }
}
