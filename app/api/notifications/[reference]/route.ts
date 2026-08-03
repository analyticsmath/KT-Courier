import { NextResponse } from "next/server";
import { resolveNotificationProductionComposition } from "@/lib/notifications/composition-root";
import { requireNotificationUser, notificationInboxDto } from "@/lib/notifications/api-policy";

export async function GET(request: Request, context: RouteContext<"/api/notifications/[reference]">) {
  const access = await requireNotificationUser(request);
  if ("response" in access) return access.response;
  const { reference } = await context.params;
  const { items } = await resolveNotificationProductionComposition().services.inbox.list(access.user.id, 0, 1_000);
  const item = items.find((candidate: { publicReference: string }) => candidate.publicReference === reference);
  return item ? NextResponse.json({ data: notificationInboxDto(item) }) : NextResponse.json({ error: "Notification not found." }, { status: 404 });
}
