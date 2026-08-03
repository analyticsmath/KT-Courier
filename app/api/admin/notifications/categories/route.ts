import { NextResponse } from "next/server";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { notificationAdminAccess, notificationFailure, parseNotificationBody } from "@/lib/notifications/admin-api";

const category = z.object({ key: z.string().regex(/^[A-Z][A-Z0-9_]{2,79}$/), purpose: z.enum(["SECURITY", "LEGAL", "TRANSACTIONAL", "OPERATIONAL", "SERVICE_ANNOUNCEMENT", "MARKETING"]), defaultPriority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"), defaultSensitivity: z.enum(["PUBLIC", "ACCOUNT", "FINANCIAL", "SECURITY", "RESTRICTED"]).default("ACCOUNT"), mandatory: z.boolean().default(false), preferenceControlled: z.boolean().default(true), consentRequired: z.boolean().default(false), quietHoursBypass: z.boolean().default(false), digestEligible: z.boolean().default(false), retentionPolicyReference: z.string().max(160).nullable().optional() });

export async function GET(request: Request) { const access = await notificationAdminAccess(request, PERMISSIONS.NOTIFICATION_CATEGORY_READ); if ("response" in access) return access.response; return NextResponse.json({ data: await access.authority.categories.list() }); }
export async function POST(request: Request) { const access = await notificationAdminAccess(request, PERMISSIONS.NOTIFICATION_CATEGORY_MANAGE, true); if ("response" in access) return access.response; const parsed = await parseNotificationBody(request, category); if ("response" in parsed) return parsed.response; try { return NextResponse.json({ data: await access.authority.categories.create(parsed.data) }, { status: 201 }); } catch (error) { return notificationFailure(error); } }
