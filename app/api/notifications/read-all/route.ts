import { NextResponse } from "next/server";
import { requireNotificationUser } from "@/lib/notifications/api-policy";
import { resolveNotificationProductionComposition } from "@/lib/notifications/composition-root";

export async function POST(request: Request) {
  const access = await requireNotificationUser(request, true);
  if ("response" in access) return access.response;
  const result = await resolveNotificationProductionComposition().services.inbox.readAll(access.user.id);
  return NextResponse.json({ updated: result.count });
}
