/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is intentionally deferred. */
import { parsePagination, paginated } from "@/lib/api/response";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { notificationAdminAccess } from "@/lib/notifications/admin-api";
export async function GET(request: Request) { const access = await notificationAdminAccess(request, PERMISSIONS.NOTIFICATION_DELIVERY_READ); if ("response" in access) return access.response; const { page, pageSize, skip } = parsePagination(new URL(request.url).searchParams); const db: any = prisma; const [data, total] = await Promise.all([db.notificationDelivery.findMany({ orderBy: { createdAt: "desc" }, skip, take: pageSize, select: { publicReference: true, channel: true, status: true, eligibilityReason: true, provider: true, providerMessageReference: true, nextAttemptAt: true, expiresAt: true, createdAt: true, updatedAt: true } }), db.notificationDelivery.count()]); return paginated(data, total, page, pageSize); }
