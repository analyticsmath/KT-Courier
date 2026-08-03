import { NextResponse } from "next/server";
import { requireNotificationUser } from "@/lib/notifications/api-policy";
import { resolveNotificationProductionComposition } from "@/lib/notifications/composition-root";

export async function GET(request: Request) {
  const access = await requireNotificationUser(request);
  if ("response" in access) return access.response;
  const count = await resolveNotificationProductionComposition().services.inbox.unreadCount(access.user.id);
  return NextResponse.json({ unreadCount: count });
}
