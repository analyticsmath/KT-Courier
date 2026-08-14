import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { created, ok, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { listProviderGovernance, registerProviderGovernance } from "@/lib/privacy/provider-governance.service";
const schema = z.object({ providerCode: z.string().trim().min(2).max(80), providerCategory: z.string().trim().min(2).max(80), servicePurpose: z.string().trim().min(2).max(80), processingRole: z.string().trim().min(2).max(80), capabilityState: z.string().trim().max(80).optional(), regionMetadata: z.record(z.string(), z.string().max(160)).optional(), documentationReference: z.string().trim().max(200).optional(), safeNotes: z.string().trim().max(512).optional(), sensitiveDataClassIds: z.array(z.string().cuid()).max(20) }).strict();
export async function GET(request: NextRequest) { const auth = await requireAdminApiPermission(PERMISSIONS.PROVIDER_PRIVACY_READ, { request }); if (auth.response) return auth.response; return ok({ data: await listProviderGovernance() }); }
export async function POST(request: NextRequest) { const origin = await enforceSameOriginRequest(request); if (origin) return origin; const auth = await requireAdminApiPermission(PERMISSIONS.PROVIDER_PRIVACY_MANAGE, { request }); if (auth.response) return auth.response; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return unprocessable("Provider governance validation failed."); return created({ data: await registerProviderGovernance({ actorUserId: auth.user.id, ...parsed.data }) }); }
