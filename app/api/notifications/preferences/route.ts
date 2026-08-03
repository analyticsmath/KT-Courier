/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma Client generation is deferred to Phase 30. */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { badRequest } from "@/lib/api/response";
import { requireNotificationUser } from "@/lib/notifications/api-policy";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { isValidNotificationTimezone } from "@/lib/notifications/authority";

const channel = z.enum(["IN_APP", "EMAIL", "SMS", "WEB_PUSH", "ANDROID_PUSH"]);
const preference = z.object({ categoryKey: z.string().regex(/^[A-Z0-9_]{3,80}$/), channel, mode: z.enum(["ENABLED", "DISABLED"]), digestMode: z.enum(["IMMEDIATE", "DAILY_DIGEST", "DISABLED"]).default("IMMEDIATE"), timezone: z.string().max(80).optional(), quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(), quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(), quietHoursDays: z.array(z.number().int().min(0).max(6)).max(7).default([]) }).refine((value) => Boolean(value.quietHoursStart) === Boolean(value.quietHoursEnd), { message: "Quiet hours require both a start and end time." });

export async function GET(request: Request) {
  const access = await requireNotificationUser(request, false, PERMISSIONS.NOTIFICATION_MANAGE_OWN_PREFERENCES);
  if ("response" in access) return access.response;
  const data = await (prisma as any).notificationPreference.findMany({ where: { userId: access.user.id }, orderBy: [{ categoryKey: "asc" }, { channel: "asc" }] });
  return NextResponse.json({ data });
}

export async function PATCH(request: Request) {
  const access = await requireNotificationUser(request, true, PERMISSIONS.NOTIFICATION_MANAGE_OWN_PREFERENCES);
  if ("response" in access) return access.response;
  const parsed = preference.safeParse(await request.json());
  if (!parsed.success) return badRequest("Invalid notification preference.");
  const input = parsed.data;
  if (input.timezone && !isValidNotificationTimezone(input.timezone)) return badRequest("Invalid notification timezone.");
  const category = await (prisma as any).notificationCategory.findUnique({ where: { key: input.categoryKey } });
  if (!category) return badRequest("Unknown notification category.");
  if ((category.mandatory || ["SECURITY", "LEGAL"].includes(category.purpose)) && input.mode === "DISABLED") return badRequest("Mandatory notifications cannot be disabled.");
  if (input.channel === "IN_APP" && input.digestMode === "DAILY_DIGEST" && !category.digestEligible) return badRequest("This category is not eligible for a digest.");
  const data = await (prisma as any).notificationPreference.upsert({ where: { userId_categoryKey_channel: { userId: access.user.id, categoryKey: input.categoryKey, channel: input.channel } }, create: { ...input, userId: access.user.id, mode: category.mandatory ? "MANDATORY" : input.mode }, update: { ...input, mode: category.mandatory ? "MANDATORY" : input.mode } });
  return NextResponse.json({ data });
}
