import type { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { subscriptionRecoveryRoute } from "@/lib/subscriptions/admin-route";
export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) { const { reference } = await context.params; return subscriptionRecoveryRoute(request, reference, PERMISSIONS.SUBSCRIPTION_CONTRACTS_RECONCILE, "retry-provider-sync"); }
