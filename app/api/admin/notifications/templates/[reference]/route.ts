import { NextResponse } from "next/server";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { notificationAdminAccess, notificationFailure, parseNotificationBody } from "@/lib/notifications/admin-api";
const body = z.object({ categoryKey: z.string().regex(/^[A-Z][A-Z0-9_]{2,79}$/) });
export async function GET(request: Request, context: RouteContext<"/api/admin/notifications/templates/[reference]">) { const access = await notificationAdminAccess(request, PERMISSIONS.NOTIFICATION_TEMPLATE_READ); if ("response" in access) return access.response; const { reference } = await context.params; try { return NextResponse.json({ data: await access.authority.templates.get(reference) }); } catch (error) { return notificationFailure(error); } }
export async function PATCH(request: Request, context: RouteContext<"/api/admin/notifications/templates/[reference]">) { const access = await notificationAdminAccess(request, PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE, true); if ("response" in access) return access.response; const parsed = await parseNotificationBody(request, body); if ("response" in parsed) return parsed.response; const { reference } = await context.params; try { return NextResponse.json({ data: await access.authority.templates.update(reference, parsed.data) }); } catch (error) { return notificationFailure(error); } }
