/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma Client generation is deferred to Phase 30. */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { badRequest } from "@/lib/api/response";
import { requireNotificationUser } from "@/lib/notifications/api-policy";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

const schema = z.object({ channel: z.enum(["EMAIL", "SMS", "WEB_PUSH", "ANDROID_PUSH"]), noticeVersion: z.string().min(1).max(120), operationId: z.string().min(8).max(160) });
export async function POST(request: Request) {
  const access = await requireNotificationUser(request, true, PERMISSIONS.NOTIFICATION_MANAGE_OWN_MARKETING_CONSENT);
  if ("response" in access) return access.response;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return badRequest("Invalid marketing consent.");
  const value = parsed.data;
  const existing = await (prisma as any).notificationConsentRecord.findFirst({ where: { userId: access.user.id, channel: value.channel, purpose: "MARKETING", status: "GRANTED" } });
  if (existing) return NextResponse.json({ data: existing, replay: true });
  const data = await (prisma as any).notificationConsentRecord.create({ data: { publicReference: `ncon_${value.operationId}`, userId: access.user.id, channel: value.channel, purpose: "MARKETING", noticeVersion: value.noticeVersion, status: "GRANTED", source: "USER_SELF_SERVICE", grantedAt: new Date(), actorUserId: access.user.id, requestEvidence: { operationId: value.operationId } } });
  return NextResponse.json({ data }, { status: 201 });
}
