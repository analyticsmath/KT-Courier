import { type NextRequest, NextResponse } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { notFound, serverError } from "@/lib/api/response";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { diagnoseStoreOffersSellability } from "@/lib/admin/store-offer-diagnostics.service";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiPermission(PERMISSIONS.STORES_READ, { request: req });
  if (auth.response) return auth.response;

  const rate = await checkIpRateLimit(
    req,
    `store-offer-diagnostics:${auth.user.id}`,
    RATE_LIMITS.PAYMENT_STATUS,
  );
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded." },
      { status: rate.failClosed ? 503 : 429 },
    );
  }

  try {
    const { id } = await params;
    const report = await diagnoseStoreOffersSellability(id);
    if (!report) return notFound("Store not found.");
    return NextResponse.json(report, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return serverError("Offer sellability diagnostics are temporarily unavailable.");
  }
}
