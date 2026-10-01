import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getStoreEarningSummaryForOwner } from "@/lib/services/store-earning-summary.service";
import {
  storeEarningApiError,
  storeEarningNoStoreJson,
} from "@/lib/store-earnings/api-policy";

export async function GET() {
  const workspaceDenied = await requireBusinessApi(
    "/api/store/earnings/summary",
  );
  if (workspaceDenied) return workspaceDenied;
  const user = await getCurrentUser();
  if (!user)
    return storeEarningNoStoreJson({ error: "Authentication required." }, 401);
  if (user.status !== "ACTIVE")
    return storeEarningNoStoreJson(
      { error: "Store earnings are unavailable for this account." },
      403,
    );
  try {
    return storeEarningNoStoreJson({
      summary: await getStoreEarningSummaryForOwner(user.id),
    });
  } catch (error) {
    return storeEarningApiError(error);
  }
}
