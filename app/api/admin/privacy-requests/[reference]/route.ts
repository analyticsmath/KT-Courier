import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { badRequest, notFound, ok, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { getPrivacyRequest, transitionPrivacyRequest } from "@/lib/services/privacy-requests.service";

const schema = z
  .object({
    nextStatus: z.enum([
      "IDENTITY_VERIFICATION_REQUIRED",
      "VERIFIED",
      "IN_REVIEW",
      "FULFILMENT_IN_PROGRESS",
      "COMPLETED",
      "REJECTED_WITH_REASON",
      "CANCELLED",
    ]),
    reasonCode: z.string().trim().min(2).max(80),
    identityVerified: z.boolean().optional(),
    operationId: z.string().regex(/^PRIVOP-[A-Z0-9-]{12,80}$/),
    confirmStatus: z.string().trim().min(2).max(32),
  })
  .strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> },
) {
  const auth = await requireAdminApiPermission(PERMISSIONS.PRIVACY_REQUESTS_READ, { request });
  if (auth.response) return auth.response;

  const { reference } = await params;
  const req = await getPrivacyRequest(reference);
  if (!req) return notFound("Privacy request not found.");
  return ok({ data: req });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> },
) {
  const originFailure = await enforceSameOriginRequest(request);
  if (originFailure) return originFailure;

  const auth = await requireAdminApiPermission(PERMISSIONS.PRIVACY_REQUESTS_MANAGE, { request });
  if (auth.response) return auth.response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.confirmStatus !== parsed.data.nextStatus) {
    return unprocessable("Privacy request transition confirmation is invalid.");
  }

  const { reference } = await params;
  try {
    return ok({ data: await transitionPrivacyRequest({ actorUserId: auth.user.id, publicReference: reference, ...parsed.data }) });
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Privacy request transition could not be completed.");
  }
}
