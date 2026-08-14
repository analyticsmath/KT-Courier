import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ok, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { createRetentionHold } from "@/lib/retention/hold-evaluator";
import { phase5Repository } from "@/lib/operations/phase5-repository";
const schema = z.object({ subjectType: z.string().trim().min(1).max(64), subjectReference: z.string().trim().min(1).max(160), reasonCode: z.string().trim().min(2).max(80) }).strict();
export async function GET(request: NextRequest) { const auth = await requireAdminApiPermission(PERMISSIONS.LEGAL_HOLDS_READ, { request }); if (auth.response) return auth.response; return ok({ data: await phase5Repository.retentionHold.findMany({ orderBy: { createdAt: "desc" }, take: 200 }) }); }
export async function POST(request: NextRequest) { const origin = await enforceSameOriginRequest(request); if (origin) return origin; const auth = await requireAdminApiPermission(PERMISSIONS.LEGAL_HOLDS_MANAGE, { request }); if (auth.response) return auth.response; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return unprocessable("Legal hold validation failed."); return ok({ data: await createRetentionHold({ ...parsed.data, actorUserId: auth.user.id }) }); }
