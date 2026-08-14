import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { badRequest, ok, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { getProviderGovernance, ProviderGovernanceError, updateProviderGovernance } from "@/lib/privacy/provider-governance.service";
const schema = z.object({ documentationReference: z.string().trim().max(200).optional(), safeNotes: z.string().trim().max(512).optional(), regionMetadata: z.record(z.string(), z.string().max(160)).optional(), capabilityState: z.string().trim().max(80).optional() }).strict();
export async function GET(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) { const auth = await requireAdminApiPermission(PERMISSIONS.PROVIDER_PRIVACY_READ, { request }); if (auth.response) return auth.response; try { return ok({ data: await getProviderGovernance((await params).reference) }); } catch { return badRequest("PROVIDER_GOVERNANCE_NOT_FOUND"); } }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) { const origin = await enforceSameOriginRequest(request); if (origin) return origin; const auth = await requireAdminApiPermission(PERMISSIONS.PROVIDER_PRIVACY_MANAGE, { request }); if (auth.response) return auth.response; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return unprocessable("Provider metadata validation failed."); try { return ok({ data: await updateProviderGovernance({ actorUserId: auth.user.id, publicReference: (await params).reference, ...parsed.data }) }); } catch (error) { return badRequest(error instanceof ProviderGovernanceError ? error.code : "PROVIDER_GOVERNANCE_UPDATE_FAILED"); } }
