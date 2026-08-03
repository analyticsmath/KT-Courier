/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma Client generation is deferred to Phase 30. */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { badRequest } from "@/lib/api/response";
import { requireNotificationUser } from "@/lib/notifications/api-policy";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

const schema = z.object({ channel: z.enum(["EMAIL", "SMS", "WEB_PUSH", "ANDROID_PUSH"]), operationId: z.string().min(8).max(160) });
export async function POST(request: Request) {
  const access = await requireNotificationUser(request, true, PERMISSIONS.NOTIFICATION_MANAGE_OWN_MARKETING_CONSENT);
  if ("response" in access) return access.response;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return badRequest("Invalid consent revocation.");
  const value = parsed.data;
  const suppressionReference = `nsup_${value.operationId}`;
  const replay = await (prisma as any).notificationSuppression.findUnique({ where: { publicReference: suppressionReference } });
  if (replay) return NextResponse.json({ revoked: 0, replay: true });
  const result = await (prisma as any).notificationConsentRecord.updateMany({ where: { userId: access.user.id, channel: value.channel, purpose: "MARKETING", status: "GRANTED" }, data: { status: "REVOKED", revokedAt: new Date(), actorUserId: access.user.id } });
  await (prisma as any).notificationSuppression.create({ data: { publicReference: suppressionReference, userId: access.user.id, channel: value.channel, purpose: "MARKETING", reason: "MARKETING_CONSENT_REVOKED", evidence: { operationId: value.operationId } } });
  return NextResponse.json({ revoked: result.count });
}
