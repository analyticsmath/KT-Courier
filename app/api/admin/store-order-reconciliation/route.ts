/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 21 client generation is deferred. */
import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { prisma } from "@/lib/db/prisma";
import { storeOrderError, storeOrderJson } from "@/lib/store-orders/api-policy";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission("store_orders.reconcile", { request }); if (auth.response) return auth.response;
  try { const cases = await (prisma as any).marketplaceStoreOrderReconciliationCase.findMany({ orderBy: [{ priority: "desc" }, { createdAt: "asc" }], take: 100 }); return storeOrderJson({ cases }); } catch (error) { return storeOrderError(error); }
}
