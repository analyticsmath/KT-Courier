import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ok, forbidden, unprocessable, notFound } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { checkIpRateLimit } from "@/lib/security/rate-limit";
import { AdvertisingReconciliationService } from "@/lib/advertising/reconciliation.service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ caseRef: string }> }) {
  // 1. Authenticate and authorize
  const auth = await requireAdminApiPermission(PERMISSIONS.ADVERTISING_RECONCILIATION_MANAGE, { request });
  if (auth.response) return auth.response;

  // 2. Enforce explicit DENY
  const override = await prisma.userPermission.findFirst({
    where: { userId: auth.user.id, permission: { key: PERMISSIONS.ADVERTISING_RECONCILIATION_MANAGE } },
    select: { effect: true }
  });
  if (override?.effect === "DENY") {
    return forbidden("Explicit DENY is active for this permission.");
  }

  // 3. Enforce same-origin policy
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && !origin.includes(host || "")) {
    return forbidden("Same-origin policy violation.");
  }

  // 4. Rate limiting
  const rateLimit = checkIpRateLimit(request, "ad-reconciliation:rescan", { max: 30, windowMs: 10 * 60 * 1000 });
  if (!rateLimit.ok) {
    return new Response(JSON.stringify({ error: "Too many requests." }), { status: 429 });
  }

  try {
    const { caseRef } = await params;
    const existing = await prisma.advertisingReconciliationCase.findUnique({
      where: { publicReference: caseRef }
    });
    if (!existing) return notFound("Reconciliation case not found.");

    // Call canonical service
    const service = new AdvertisingReconciliationService();
    const result = await service.scanForReconciliationDiscrepancies();

    return ok({ message: "Rescan completed", result });
  } catch (error: any) {
    return unprocessable(error.message || "Failed to run reconciliation rescan.");
  }
}
