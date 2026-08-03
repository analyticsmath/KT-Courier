/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma Client generation is deferred to Phase 30. */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "@/lib/api/response";
import { requireNotificationUser } from "@/lib/notifications/api-policy";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

export async function DELETE(request: Request, context: RouteContext<"/api/notifications/endpoints/[reference]">) {
  const access = await requireNotificationUser(request, true, PERMISSIONS.NOTIFICATION_MANAGE_OWN_PUSH_ENDPOINTS);
  if ("response" in access) return access.response;
  const { reference } = await context.params;
  const endpoint: any = (prisma as any).notificationEndpoint;
  const item = await endpoint.findFirst({ where: { publicReference: reference, ownerUserId: access.user.id } });
  if (!item) return notFound();
  await endpoint.update({ where: { id: item.id }, data: { status: "REVOKED" } });
  return NextResponse.json({ data: { reference, status: "REVOKED" } });
}
