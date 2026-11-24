import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { badRequest, ok, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { RetentionError, reviewRetentionPolicyVersion } from "@/lib/retention/privacy-retention.service";

const schema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().trim().min(20).max(512),
  sourceReference: z.string().trim().min(3).max(160).optional(),
  attested: z.literal(true),
}).strict();

export async function POST(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  const origin = await enforceSameOriginRequest(request);
  if (origin) return origin;
  const auth = await requireAdminApiPermission(PERMISSIONS.RETENTION_POLICIES_REVIEW, { request });
  if (auth.response) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return unprocessable("Retention policy review evidence is incomplete.");
  try {
    const { reference } = await params;
    return ok({ data: await reviewRetentionPolicyVersion({ publicReference: reference, ...parsed.data, actorUserId: auth.user.id }) });
  } catch (error) {
    return badRequest(error instanceof RetentionError ? error.code : "RETENTION_POLICY_REVIEW_FAILED");
  }
}
