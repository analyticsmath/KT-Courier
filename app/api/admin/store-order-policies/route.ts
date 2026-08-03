/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 21 client generation is deferred. */
import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { createStoreOrderOperationalPolicy, activateStoreOrderOperationalPolicy, approveStoreOrderOperationalPolicy, rejectStoreOrderOperationalPolicy, submitStoreOrderOperationalPolicy } from "@/lib/store-orders/operational-policy.service";
import { exactKeys, enforceStoreOrderMutation, integer, storeOrderBody, storeOrderError, storeOrderJson, text } from "@/lib/store-orders/api-policy";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission("store_orders.read", { request }); if (auth.response) return auth.response;
  try { return storeOrderJson({ policies: await (prisma as any).storeOrderOperationalPolicy.findMany({ orderBy: [{ name: "asc" }, { versionNumber: "desc" }] }) }); } catch (error) { return storeOrderError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const blocked = await enforceStoreOrderMutation(request, "store"); if (blocked) return blocked;
    const auth = await requireAdminApiPermission("store_order_policies.manage", { request }); if (auth.response) return auth.response;
    const body = await storeOrderBody(request); const action = text(body, "action", 3, 20);
    if (action === "create") { exactKeys(body, ["action", "name", "versionNumber", "acceptanceWindowSeconds", "customerDecisionWindowSeconds", "maximumPrepMinutes", "maximumPrepExtensionMinutes", "maximumIssueCount", "maximumSubstitutionProposalsPerLine", "substitutionMode", "effectiveFrom", "effectiveUntil"]); const policy = await createStoreOrderOperationalPolicy({ name: text(body, "name", 3, 120), versionNumber: integer(body, "versionNumber"), acceptanceWindowSeconds: integer(body, "acceptanceWindowSeconds"), customerDecisionWindowSeconds: integer(body, "customerDecisionWindowSeconds"), maximumPrepMinutes: integer(body, "maximumPrepMinutes"), maximumPrepExtensionMinutes: integer(body, "maximumPrepExtensionMinutes"), maximumIssueCount: integer(body, "maximumIssueCount"), maximumSubstitutionProposalsPerLine: integer(body, "maximumSubstitutionProposalsPerLine"), substitutionMode: text(body, "substitutionMode", 3, 40) as "REFUND_ONLY" | "CUSTOMER_APPROVAL_REQUIRED" | "PREAPPROVED_CHOICES_ONLY", effectiveFrom: new Date(text(body, "effectiveFrom", 20, 40)), effectiveUntil: typeof body.effectiveUntil === "string" && body.effectiveUntil ? new Date(body.effectiveUntil) : null }); return storeOrderJson({ policy }, 201); }
    if (action === "submit") { exactKeys(body, ["action", "reference"]); return storeOrderJson({ policy: await submitStoreOrderOperationalPolicy(text(body, "reference", 5, 128)) }); }
    if (action === "approve") { exactKeys(body, ["action", "reference"]); const approval = await requireAdminApiPermission("store_order_policies.approve", { request }); if (approval.response) return approval.response; return storeOrderJson({ policy: await approveStoreOrderOperationalPolicy({ publicReference: text(body, "reference", 5, 128), approvedByUserId: approval.user.id }) }); }
    if (action === "reject") { exactKeys(body, ["action", "reference", "reasonCode", "operationId"]); const approval = await requireAdminApiPermission("store_order_policies.approve", { request }); if (approval.response) return approval.response; return storeOrderJson({ policy: await rejectStoreOrderOperationalPolicy({ publicReference: text(body, "reference", 5, 128), rejectedByUserId: approval.user.id, reasonCode: text(body, "reasonCode", 3, 80), operationId: text(body, "operationId", 12, 160) }) }); }
    if (action === "activate") { exactKeys(body, ["action", "reference"]); const approval = await requireAdminApiPermission("store_order_policies.approve", { request }); if (approval.response) return approval.response; return storeOrderJson({ policy: await activateStoreOrderOperationalPolicy({ publicReference: text(body, "reference", 5, 128) }) }); }
    return storeOrderJson({ error: "Unsupported policy action." }, 422);
  } catch (error) { return storeOrderError(error); }
}
