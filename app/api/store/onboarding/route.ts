import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { storeAccess } from "@/lib/client-platform/store-access";
import { getCurrentUser } from "@/lib/auth/current-user";
import { json, failure } from "@/lib/client-platform/api";
import { PlatformError } from "@/lib/client-platform/contracts";
import { getStoreOnboardingByStoreId } from "@/lib/services/store-onboarding.service";

const endpoint = "/api/store/onboarding";

export async function GET() {
  const denied = await requireBusinessApi(endpoint);
  if (denied) return denied;
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new PlatformError(
        "AUTHENTICATION_REQUIRED",
        "Authentication required.",
        401,
      );
    }
    const access = await storeAccess(user.id);
    if (!access.owner) {
      throw new PlatformError(
        "STORE_ONBOARDING_OWNER_REQUIRED",
        "Only the business owner may view shop onboarding readiness.",
        403,
      );
    }
    const onboarding = await getStoreOnboardingByStoreId(access.store.id);
    if (!onboarding) {
      throw new PlatformError("STORE_NOT_FOUND", "Store was not found.", 404);
    }
    return json({ onboarding });
  } catch (error) {
    return failure(error);
  }
}
