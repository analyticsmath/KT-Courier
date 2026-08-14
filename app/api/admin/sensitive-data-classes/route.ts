import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { created, ok, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { registerSensitiveDataClass, SENSITIVE_DATA_CODES } from "@/lib/privacy/sensitive-data.service";
import { phase5Repository } from "@/lib/operations/phase5-repository";
const schema = z.object({ code: z.enum(SENSITIVE_DATA_CODES), classificationLevel: z.string().trim().min(2).max(40), storageRequirement: z.enum(["PRIVATE_MEDIA", "DATABASE_RESTRICTED", "REDACTED_LOG_ONLY"]), loggingRule: z.string().trim().min(2).max(80), retentionDataClass: z.string().trim().max(80).optional(), accessAuditRequired: z.boolean().optional(), exportable: z.boolean().optional(), allowedPurposes: z.array(z.string().trim().min(1).max(80)).min(1).max(20) }).strict();
export async function GET(request: NextRequest) { const auth = await requireAdminApiPermission(PERMISSIONS.SENSITIVE_DATA_POLICY_READ, { request }); if (auth.response) return auth.response; return ok({ data: await phase5Repository.sensitiveDataClass.findMany({ orderBy: { code: "asc" }, take: 100 }) }); }
export async function POST(request: NextRequest) { const origin = await enforceSameOriginRequest(request); if (origin) return origin; const auth = await requireAdminApiPermission(PERMISSIONS.SENSITIVE_DATA_POLICY_MANAGE, { request }); if (auth.response) return auth.response; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return unprocessable("Sensitive data class validation failed."); return created({ data: await registerSensitiveDataClass({ actorUserId: auth.user.id, ...parsed.data }) }); }
