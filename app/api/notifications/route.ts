import { parsePagination, paginated } from "@/lib/api/response";
import { notificationInboxDto, requireNotificationUser } from "@/lib/notifications/api-policy";
import { resolveNotificationProductionComposition } from "@/lib/notifications/composition-root";

export async function GET(request: Request) {
  const access = await requireNotificationUser(request);
  if ("response" in access) return access.response;
  const { page, pageSize, skip } = parsePagination(new URL(request.url).searchParams);
  const { items, total } = await resolveNotificationProductionComposition().services.inbox.list(access.user.id, skip, pageSize);
  return paginated(items.map(notificationInboxDto), total, page, pageSize);
}
