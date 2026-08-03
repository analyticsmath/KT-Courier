/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { newSubscriptionReference } from "@/lib/subscriptions/subscription-plan.service";
import { subscriptionApiError, subscriptionJson } from "@/lib/subscriptions/api-policy";

export async function GET(request: NextRequest) { const auth = await requireAdminApiPermission(PERMISSIONS.SUBSCRIPTION_PROGRAMS_READ, { request }); if (auth.response) return auth.response; try { return subscriptionJson({ programs: await (prisma as any).subscriptionProgram.findMany({ orderBy: { createdAt: "desc" } }) }); } catch (error) { return subscriptionApiError(error); } }
export async function POST(request: NextRequest) { const auth = await requireAdminApiPermission(PERMISSIONS.SUBSCRIPTION_PROGRAMS_MANAGE, { request }); if (auth.response) return auth.response; try { const body = await request.json() as Record<string, unknown>; if (typeof body.code !== "string" || typeof body.name !== "string" || !["CUSTOMER", "STORE"].includes(String(body.subjectType))) return subscriptionJson({ error: "Invalid subscription program draft." }, 422); const program = await (prisma as any).subscriptionProgram.create({ data: { publicReference: newSubscriptionReference("subprog"), code: body.code.trim(), subjectType: body.subjectType, name: body.name.trim(), description: typeof body.description === "string" ? body.description.trim() : null, status: "DRAFT" } }); return subscriptionJson({ program }, 201); } catch (error) { return subscriptionApiError(error); } }
