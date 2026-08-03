import type { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { transitionPlanRoute } from "@/lib/subscriptions/admin-route";
export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) { const { reference } = await context.params; return transitionPlanRoute(request, reference, PERMISSIONS.SUBSCRIPTION_PLANS_REVIEW, "UNDER_REVIEW"); }
