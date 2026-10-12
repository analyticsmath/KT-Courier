import type { NextRequest } from "next/server";
import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { storeAccess } from "@/lib/client-platform/store-access";
import { getCurrentUser } from "@/lib/auth/current-user";
import { json, failure, mutation } from "@/lib/client-platform/api";
import { PlatformError } from "@/lib/client-platform/contracts";
import { StoreSellerIdentityProposalSchema } from "@/lib/validation/store-seller-identity";
import { getStoreSellerIdentityState, submitStoreSellerIdentity } from "@/lib/services/store-seller-identity.service";
const endpoint = "/api/store/seller-identity";
async function owner() {
  const user = await getCurrentUser();
  if (!user) throw new PlatformError("AUTHENTICATION_REQUIRED", "Authentication required.", 401);
  const access = await storeAccess(user.id);
  if (!access.owner) throw new PlatformError("SELLER_OWNER_REQUIRED", "Only the store owner may supply legal seller details.", 403);
  return { user, store: access.store };
}
export async function GET() {
  const denied = await requireBusinessApi(endpoint); if (denied) return denied;
  try { const access = await owner(); return json(await getStoreSellerIdentityState(access.store.id)); } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  const denied = await requireBusinessApi(endpoint); if (denied) return denied;
  try {
    const access = await owner(); const prepared = await mutation(request, `${endpoint}:${access.user.id}`); if ("response" in prepared) return prepared.response;
    const input = StoreSellerIdentityProposalSchema.parse(prepared.body);
    return json({ proposal: await submitStoreSellerIdentity(access.store.id, access.user.id, input) }, 201);
  } catch (error) { return failure(error); }
}
