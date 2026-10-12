import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { failure, json, mutation } from "@/lib/client-platform/api";
import { StoreSellerIdentityReviewSchema } from "@/lib/validation/store-seller-identity";
import { reviewStoreSellerIdentity } from "@/lib/services/store-seller-identity.service";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiPermission([PERMISSIONS.STORES_APPROVE, PERMISSIONS.LEGAL_DOCUMENTS_PUBLISH], { request }); if (auth.response) return auth.response;
  const prepared = await mutation(request, `seller-identity-review:${auth.user.id}`); if ("response" in prepared) return prepared.response;
  try { const { id } = await params; return json({ proposal: await reviewStoreSellerIdentity(id, auth.user.id, StoreSellerIdentityReviewSchema.parse(prepared.body)) }); } catch (error) { return failure(error); }
}
