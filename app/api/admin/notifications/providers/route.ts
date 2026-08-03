import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { notificationAdminAccess } from "@/lib/notifications/admin-api";
import { resolveNotificationProductionComposition } from "@/lib/notifications/composition-root";
export async function GET(request: Request) { const access = await notificationAdminAccess(request, PERMISSIONS.NOTIFICATION_PROVIDER_STATUS_READ); if ("response" in access) return access.response; const composition = resolveNotificationProductionComposition(); return NextResponse.json({ data: Array.from(composition.providers.entries()).map(([channel, provider]) => ({ channel, name: provider.name, ready: false })), production: { status: composition.status, code: composition.status === "LOCKED" ? composition.code : undefined } }); }
