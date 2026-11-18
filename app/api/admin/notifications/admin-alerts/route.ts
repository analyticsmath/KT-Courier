import { type NextRequest } from "next/server";
import { notificationAdminAccess } from "@/lib/notifications/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ok, serverError } from "@/lib/api/response";
import { listAdminAlertOverview } from "@/lib/notifications/admin-alert-dispatch.service";
import {
  ADMIN_ALERT_EVENT_TYPES,
  ADMIN_ALERT_EVENT_LABELS,
} from "@/lib/settings/admin-alert-recipient-policy";

export async function GET(request: NextRequest) {
  const access = await notificationAdminAccess(request, PERMISSIONS.NOTIFICATION_AUDIT_READ, false);
  if (access.response) return access.response;

  const { searchParams } = new URL(request.url);
  const eventType = searchParams.get("eventType")?.trim() || null;
  const deliveryStatus = searchParams.get("deliveryStatus")?.trim() || null;

  try {
    const overview = await listAdminAlertOverview({
      eventType,
      deliveryStatus,
      limit: 60,
    });
    return ok({
      ...overview,
      availableEventTypes: ADMIN_ALERT_EVENT_TYPES.map((type) => ({
        type,
        label: ADMIN_ALERT_EVENT_LABELS[type],
      })),
    });
  } catch {
    return serverError();
  }
}
