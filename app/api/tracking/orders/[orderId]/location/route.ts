import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { forbidden, ok, unauthorized } from "@/lib/api/response";
import { resolveLocationAccess, LocationAccessError } from "@/lib/services/location-access.service";
export async function GET(_request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) { const user = await getCurrentUser(); if (!user) return unauthorized(); try { const data = await resolveLocationAccess({ actorUserId: user.id, actorRole: user.role, orderId: (await params).orderId, purpose: "ACTIVE_DELIVERY_TRACKING" }); return ok({ data: { latestKnownLocation: data.projection, active: data.active } }); } catch (error) { return forbidden(error instanceof LocationAccessError ? error.code : "LOCATION_ACCESS_DENIED"); } }
