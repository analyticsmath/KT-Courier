import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { storefrontJson } from "@/lib/storefront/storefront-api-policy";
import { StorefrontCollectionService } from "@/lib/services/storefront-collection.service";
import { collectionCreate } from "@/lib/storefront/storefront-admin-route-handlers";
export async function GET(request: NextRequest) { const auth = await requireAdminApiPermission(PERMISSIONS.STOREFRONT_COLLECTIONS_READ, { request }); if ("response" in auth) return auth.response; return storefrontJson({ collections: await new StorefrontCollectionService().list() }, 200, { private: true }); }
export async function POST(request: NextRequest) { return collectionCreate(request); }
