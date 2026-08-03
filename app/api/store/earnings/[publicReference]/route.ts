import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getStoreEarningForOwner } from "@/lib/services/store-earning-query.service";
import { storeEarningApiError, storeEarningNoStoreJson } from "@/lib/store-earnings/api-policy";
import { StoreEarningPublicReferenceParamsSchema } from "@/lib/validation/store-earnings";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ publicReference: string }> }) {
  const user = await getCurrentUser();
  if (!user) return storeEarningNoStoreJson({ error: "Authentication required." }, 401);
  if (user.role !== "STORE" || user.status !== "ACTIVE") return storeEarningNoStoreJson({ error: "Store earnings are unavailable for this account." }, 403);
  const parsed = StoreEarningPublicReferenceParamsSchema.safeParse(await params);
  if (!parsed.success) return storeEarningNoStoreJson({ error: "Store earning was not found." }, 404);
  try { const earning = await getStoreEarningForOwner(user.id, parsed.data.publicReference); return earning ? storeEarningNoStoreJson({ earning }) : storeEarningNoStoreJson({ error: "Store earning was not found." }, 404); }
  catch (error) { return storeEarningApiError(error); }
}
