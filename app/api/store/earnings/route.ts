import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listStoreEarningsForOwner } from "@/lib/services/store-earning-query.service";
import {
  storeEarningApiError,
  storeEarningNoStoreJson,
} from "@/lib/store-earnings/api-policy";
import {
  StoreEarningListQuerySchema,
  storeEarningSearchParams,
} from "@/lib/validation/store-earnings";

export async function GET(request: NextRequest) {
  const workspaceDenied = await requireBusinessApi("/api/store/earnings");
  if (workspaceDenied) return workspaceDenied;
  const user = await getCurrentUser();
  if (!user)
    return storeEarningNoStoreJson({ error: "Authentication required." }, 401);
  if (user.status !== "ACTIVE")
    return storeEarningNoStoreJson(
      { error: "Store earnings are unavailable for this account." },
      403,
    );
  const parsed = StoreEarningListQuerySchema.safeParse(
    storeEarningSearchParams(request.nextUrl.searchParams),
  );
  if (!parsed.success)
    return storeEarningNoStoreJson(
      { error: "Invalid store earning filters." },
      422,
    );
  try {
    return storeEarningNoStoreJson(
      await listStoreEarningsForOwner(user.id, parsed.data),
    );
  } catch (error) {
    return storeEarningApiError(error);
  }
}
