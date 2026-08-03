/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is intentionally deferred. */
import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { notificationAdminAccess } from "@/lib/notifications/admin-api";
export async function GET(request: Request, context: RouteContext<"/api/admin/notifications/deliveries/[reference]">) { const access = await notificationAdminAccess(request, PERMISSIONS.NOTIFICATION_DELIVERY_READ); if ("response" in access) return access.response; const { reference } = await context.params; const item = await (prisma as any).notificationDelivery.findUnique({ where: { publicReference: reference }, select: { publicReference: true, channel: true, status: true, eligibilityReason: true, provider: true, providerMessageReference: true, nextAttemptAt: true, expiresAt: true, createdAt: true, updatedAt: true } }); return item ? NextResponse.json({ data: item }) : NextResponse.json({ error: "Delivery not found." }, { status: 404 }); }
