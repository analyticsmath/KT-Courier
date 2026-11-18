import { type NextRequest } from "next/server";
import { notificationAdminAccess } from "@/lib/notifications/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ok, serverError } from "@/lib/api/response";
import { retryPendingAdminAlertDeliveries } from "@/lib/notifications/admin-alert-dispatch.service";

export async function POST(request: NextRequest) {
  const access = await notificationAdminAccess(request, PERMISSIONS.NOTIFICATION_DELIVERY_RETRY, true);
  if (access.response) return access.response;

  try {
    const result = await retryPendingAdminAlertDeliveries({ limit: 50 });
    return ok(result);
  } catch {
    return serverError();
  }
}
