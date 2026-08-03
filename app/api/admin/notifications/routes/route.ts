import { NextResponse } from "next/server";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { notificationAdminAccess, notificationFailure, parseNotificationBody } from "@/lib/notifications/admin-api";
const body = z.object({ key: z.string().regex(/^[A-Z][A-Z0-9_]{2,79}$/), sourceAuthority: z.string().min(1).max(160), sourceEventType: z.string().min(1).max(160) });
export async function GET(request: Request) { const access = await notificationAdminAccess(request, PERMISSIONS.NOTIFICATION_ROUTE_READ); if ("response" in access) return access.response; return NextResponse.json({ data: await access.authority.routes.list() }); }
export async function POST(request: Request) { const access = await notificationAdminAccess(request, PERMISSIONS.NOTIFICATION_ROUTE_MANAGE, true); if ("response" in access) return access.response; const parsed = await parseNotificationBody(request, body); if ("response" in parsed) return parsed.response; try { return NextResponse.json({ data: await access.authority.routes.create(parsed.data) }, { status: 201 }); } catch (error) { return notificationFailure(error); } }
