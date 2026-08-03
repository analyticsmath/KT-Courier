import { NextResponse } from "next/server";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { notificationAdminAccess, notificationFailure, parseNotificationBody } from "@/lib/notifications/admin-api";
const body = z.object({ action: z.literal("retire") });
export async function PATCH(request: Request, context: RouteContext<"/api/admin/notifications/categories/[reference]">) { const access = await notificationAdminAccess(request, PERMISSIONS.NOTIFICATION_CATEGORY_MANAGE, true); if ("response" in access) return access.response; const parsed = await parseNotificationBody(request, body); if ("response" in parsed) return parsed.response; const { reference } = await context.params; try { return NextResponse.json({ data: await access.authority.categories.retire(reference) }); } catch (error) { return notificationFailure(error); } }
