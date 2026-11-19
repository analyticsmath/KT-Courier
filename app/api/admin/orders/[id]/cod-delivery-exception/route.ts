import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { badRequest, serverError, tooManyRequests } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, getClientIp, RATE_LIMITS } from "@/lib/security/rate-limit";
import { CodPhysicalDeliveryExceptionError, reportCodPhysicalDeliveryException, reviewCodPhysicalDeliveryException } from "@/lib/services/cod-physical-delivery-exception.service";

const common = { operationId: z.string().regex(/^[A-Za-z0-9:_-]{8,120}$/), reason: z.string().trim().min(1).max(1000) };
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("REPORT"), ...common, evidenceReference: z.string().trim().min(1).max(160) }).strict(),
  z.object({ action: z.literal("REVIEW"), ...common, decision: z.enum(["VERIFY", "REJECT"]) }).strict(),
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;
  const rate = await checkIpRateLimit(req, `admin:cod-exception:${getClientIp(req)}`, RATE_LIMITS.ADMIN_DELIVERY_MANUAL);
  if (!rate.ok) return tooManyRequests(rate.retryAfterSeconds);
  const auth = await requireAdminApiPermission(PERMISSIONS.COD_OPERATIONS_MANAGE, { request: req });
  if (auth.response) return auth.response;
  let raw: unknown;
  try { raw = await req.json(); } catch { return badRequest("Invalid JSON body."); }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return badRequest("A valid action, reason, operation reference and required evidence are needed.");
  const { id } = await params;
  try {
    const result = parsed.data.action === "REPORT"
      ? await reportCodPhysicalDeliveryException(auth.user, id, parsed.data)
      : await reviewCodPhysicalDeliveryException(auth.user, id, parsed.data);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof CodPhysicalDeliveryExceptionError) return Response.json({ error: error.message, code: error.code }, { status: error.code === "FORBIDDEN" ? 403 : error.code === "INVALID_INPUT" || error.code === "EVIDENCE_REQUIRED" ? 400 : 409, headers: { "Cache-Control": "no-store" } });
    return serverError();
  }
}
