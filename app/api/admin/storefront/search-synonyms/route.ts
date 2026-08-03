import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { storefrontJson } from "@/lib/storefront/storefront-api-policy";
import { StorefrontSynonymService } from "@/lib/services/storefront-synonym.service";
import { synonymCreate } from "@/lib/storefront/storefront-admin-route-handlers";
export async function GET(request: NextRequest) { const auth = await requireAdminApiPermission(PERMISSIONS.STOREFRONT_SEARCH_SYNONYMS_READ, { request }); if ("response" in auth) return auth.response; return storefrontJson({ synonymSets: await new StorefrontSynonymService().list() }, 200, { private: true }); }
export async function POST(request: NextRequest) { return synonymCreate(request); }
