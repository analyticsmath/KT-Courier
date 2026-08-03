/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma Client generation is deferred to Phase 30. */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireNotificationUser } from "@/lib/notifications/api-policy";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

export async function GET(request: Request) {
  const access = await requireNotificationUser(request, false, PERMISSIONS.NOTIFICATION_MANAGE_OWN_MARKETING_CONSENT);
  if ("response" in access) return access.response;
  const data = await (prisma as any).notificationConsentRecord.findMany({ where: { userId: access.user.id, purpose: "MARKETING" }, select: { publicReference: true, channel: true, noticeVersion: true, status: true, grantedAt: true, revokedAt: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ data });
}
