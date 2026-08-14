import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { badRequest, ok, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { createRetentionPolicyVersion, RETENTION_DATA_CLASSES } from "@/lib/retention/privacy-retention.service";
import { phase5Repository } from "@/lib/operations/phase5-repository";
const schema = z.object({ dataClass: z.enum(RETENTION_DATA_CLASSES), action: z.enum(["DELETE", "ANONYMIZE", "PSEUDONYMIZE", "RETAIN", "ARCHIVE"]), retentionDays: z.number().int().nonnegative().max(36500).optional(), effectiveAt: z.string().datetime().optional() }).strict();
export async function GET(request: NextRequest) { const auth = await requireAdminApiPermission(PERMISSIONS.RETENTION_POLICIES_READ, { request }); if (auth.response) return auth.response; return ok({ data: await phase5Repository.retentionPolicyVersion.findMany({ orderBy: { createdAt: "desc" }, take: 200 }) }); }
export async function POST(request: NextRequest) { const origin = await enforceSameOriginRequest(request); if (origin) return origin; const auth = await requireAdminApiPermission(PERMISSIONS.RETENTION_POLICIES_MANAGE, { request }); if (auth.response) return auth.response; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return unprocessable("Retention policy validation failed."); try { return ok({ data: await createRetentionPolicyVersion({ ...parsed.data, effectiveAt: parsed.data.effectiveAt ? new Date(parsed.data.effectiveAt) : undefined, actorUserId: auth.user.id }) }); } catch { return badRequest("RETENTION_POLICY_CREATE_FAILED"); } }
