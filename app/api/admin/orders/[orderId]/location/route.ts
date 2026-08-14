import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { badRequest, ok } from "@/lib/api/response";
import { resolveLocationAccess, LocationAccessError } from "@/lib/services/location-access.service";
export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) { const historical = request.nextUrl.searchParams.get("historical") === "true"; const auth = await requireAdminApiPermission(historical ? PERMISSIONS.LOCATION_HISTORY_READ : PERMISSIONS.DISPATCH_LOCATION_READ, { request }); if (auth.response) return auth.response; try { const data = await resolveLocationAccess({ actorUserId: auth.user.id, actorRole: auth.user.role, orderId: (await params).orderId, purpose: historical ? "SAFETY_INCIDENT" : "DISPATCH", privileged: true }); return ok({ data: { latestKnownLocation: data.projection, active: data.active } }); } catch (error) { return badRequest(error instanceof LocationAccessError ? error.code : "LOCATION_ACCESS_DENIED"); } }
