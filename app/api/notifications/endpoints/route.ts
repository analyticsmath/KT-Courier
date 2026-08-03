/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma Client generation is deferred to Phase 30. */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { badRequest, conflict } from "@/lib/api/response";
import { encryptNotificationEndpoint } from "@/lib/notifications/endpoint-vault";
import { requireNotificationUser } from "@/lib/notifications/api-policy";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { isValidNotificationTimezone } from "@/lib/notifications/authority";

const schema = z.object({ type: z.enum(["WEB_PUSH", "ANDROID_PUSH"]), endpoint: z.string().min(16).max(4096), deviceLabel: z.string().max(80).optional(), platform: z.string().max(40).optional(), applicationIdentifier: z.string().max(160).optional(), locale: z.string().max(32).optional(), timezone: z.string().max(80).optional(), operationId: z.string().min(8).max(160) });
const dto = (item: any) => ({ reference: item.publicReference, type: item.type, provider: item.provider, maskedDestination: item.maskedDestination, deviceLabel: item.deviceLabel, platform: item.platform, applicationIdentifier: item.applicationIdentifier, locale: item.locale, timezone: item.timezone, status: item.status, lastRefreshedAt: item.lastRefreshedAt, lastSuccessfulDeliveryAt: item.lastSuccessfulDeliveryAt, lastFailureAt: item.lastFailureAt });

export async function GET(request: Request) {
  const access = await requireNotificationUser(request, false, PERMISSIONS.NOTIFICATION_MANAGE_OWN_PUSH_ENDPOINTS);
  if ("response" in access) return access.response;
  const items = await (prisma as any).notificationEndpoint.findMany({ where: { ownerUserId: access.user.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ data: items.map(dto) });
}

export async function POST(request: Request) {
  const access = await requireNotificationUser(request, true, PERMISSIONS.NOTIFICATION_MANAGE_OWN_PUSH_ENDPOINTS);
  if ("response" in access) return access.response;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return badRequest("Invalid push endpoint.");
  try {
    const input = parsed.data;
    if (input.timezone && !isValidNotificationTimezone(input.timezone)) return badRequest("Invalid notification timezone.");
    const secured = encryptNotificationEndpoint(input.endpoint);
    const endpoint: any = (prisma as any).notificationEndpoint;
    const existing = await endpoint.findUnique({ where: { fingerprint: secured.fingerprint } });
    if (existing && existing.ownerUserId !== access.user.id && existing.status === "ACTIVE") return conflict("This endpoint is already bound to another account.");
    const item = existing ? await endpoint.update({ where: { id: existing.id }, data: { ownerUserId: access.user.id, type: input.type, encryptedEndpoint: secured.encrypted, maskedDestination: secured.masked, deviceLabel: input.deviceLabel, platform: input.platform, applicationIdentifier: input.applicationIdentifier, locale: input.locale, timezone: input.timezone, status: "ACTIVE", lastRefreshedAt: new Date() } }) : await endpoint.create({ data: { publicReference: `nep_${input.operationId}`, ownerUserId: access.user.id, type: input.type, encryptedEndpoint: secured.encrypted, fingerprint: secured.fingerprint, maskedDestination: secured.masked, deviceLabel: input.deviceLabel, platform: input.platform, applicationIdentifier: input.applicationIdentifier, locale: input.locale, timezone: input.timezone } });
    return NextResponse.json({ data: dto(item) }, { status: existing ? 200 : 201 });
  } catch (error: any) { return NextResponse.json({ error: error?.code ?? "Unable to register endpoint." }, { status: 400 }); }
}
