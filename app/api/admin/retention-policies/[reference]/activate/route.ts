import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { badRequest, ok } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { activateRetentionPolicy, RetentionError } from "@/lib/retention/privacy-retention.service";
export async function POST(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) { const origin = await enforceSameOriginRequest(request); if (origin) return origin; const auth = await requireAdminApiPermission(PERMISSIONS.RETENTION_POLICIES_MANAGE, { request }); if (auth.response) return auth.response; try { return ok({ data: await activateRetentionPolicy({ publicReference: (await params).reference, actorUserId: auth.user.id }) }); } catch (error) { return badRequest(error instanceof RetentionError ? error.code : "RETENTION_POLICY_ACTIVATE_FAILED"); } }
