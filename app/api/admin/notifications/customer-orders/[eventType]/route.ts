import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { notificationAdminAccess, notificationFailure, parseNotificationBody } from "@/lib/notifications/admin-api";
import { customerOrderReviewPermissions, reviewCustomerOrderNotification } from "@/lib/notifications/customer-order-review";

const schema = z.object({ action: z.enum(["APPROVE_TEMPLATE", "PUBLISH_TEMPLATE", "APPROVE_RECIPIENT_POLICY", "PREPARE_ROUTE", "APPROVE_ROUTE", "ACTIVATE_ROUTE"]) }).strict();
export async function POST(request: Request, context: { params: Promise<{ eventType: string }> }): Promise<Response> {
  const access = await notificationAdminAccess(request, PERMISSIONS.NOTIFICATION_TEMPLATE_READ, true);
  if ("response" in access) return access.response ?? NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const parsed = await parseNotificationBody(request, schema);
  if ("response" in parsed) return parsed.response ?? NextResponse.json({ error: "Invalid notification request." }, { status: 422 });
  if (!await hasPermission({ userId: access.user.id, role: access.user.role, permissionKey: customerOrderReviewPermissions[parsed.data.action] })) return NextResponse.json({ error: "Missing required permission." }, { status: 403 });
  const { eventType } = await context.params;
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('client-customer-notification-preparation')::bigint)`);
      return reviewCustomerOrderNotification(tx, eventType, parsed.data.action, access.user.id);
    });
    return NextResponse.json({ data: result });
  } catch (error) { return notificationFailure(error); }
}
