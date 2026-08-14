import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { badRequest, ok, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { transitionProviderReview, ProviderGovernanceError } from "@/lib/privacy/provider-governance.service";
const schema = z.object({ nextStatus: z.enum(["ACTIVE", "INACTIVE", "REVIEW_REQUIRED", "DISABLED"]), operationId: z.string().regex(/^PPGOP-[A-Z0-9-]{12,80}$/), safeNote: z.string().trim().max(512).optional() }).strict();
export async function POST(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) { const origin = await enforceSameOriginRequest(request); if (origin) return origin; const auth = await requireAdminApiPermission(PERMISSIONS.PROVIDER_PRIVACY_REVIEW, { request }); if (auth.response) return auth.response; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return unprocessable("Provider review validation failed."); try { return ok({ data: await transitionProviderReview({ actorUserId: auth.user.id, publicReference: (await params).reference, ...parsed.data }) }); } catch (error) { return badRequest(error instanceof ProviderGovernanceError ? error.code : "PROVIDER_REVIEW_FAILED"); } }
