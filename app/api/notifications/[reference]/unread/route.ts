import { NextResponse } from "next/server";
import { resolveNotificationProductionComposition } from "@/lib/notifications/composition-root";
import { requireNotificationUser } from "@/lib/notifications/api-policy";
import { NotificationPolicyError } from "@/lib/notifications/contracts";

export async function POST(request: Request, context: RouteContext<"/api/notifications/[reference]/unread">) {
  const access = await requireNotificationUser(request, true);
  if ("response" in access) return access.response;
  const { reference } = await context.params;
  try { const data = await resolveNotificationProductionComposition().services.inbox.changeState(access.user.id, reference, "UNREAD"); return NextResponse.json({ data: { reference: data.publicReference, state: data.state } }); }
  catch (error) { return NextResponse.json({ error: error instanceof NotificationPolicyError ? error.code : "Notification cannot be marked unread." }, { status: 409 }); }
}
