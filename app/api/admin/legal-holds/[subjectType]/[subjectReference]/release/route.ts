import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { notFound, ok } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { releaseRetentionHold } from "@/lib/retention/hold-evaluator";
export async function POST(request: NextRequest, { params }: { params: Promise<{ subjectType: string; subjectReference: string }> }) { const origin = await enforceSameOriginRequest(request); if (origin) return origin; const auth = await requireAdminApiPermission(PERMISSIONS.LEGAL_HOLDS_MANAGE, { request }); if (auth.response) return auth.response; const target = await params; const data = await releaseRetentionHold({ ...target, actorUserId: auth.user.id }); return data ? ok({ data }) : notFound("Legal hold not found."); }
