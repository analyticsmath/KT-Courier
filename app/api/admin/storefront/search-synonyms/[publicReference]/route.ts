import { type NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { StorefrontSynonymService } from "@/lib/services/storefront-synonym.service";
import { storefrontAdminRead, synonymUpdate } from "@/lib/storefront/storefront-admin-route-handlers";
export async function GET(_request: NextRequest, { params }: { params: Promise<{ publicReference: string }> }) { const publicReference = (await params).publicReference; return storefrontAdminRead(PERMISSIONS.STOREFRONT_SEARCH_SYNONYMS_READ, async () => ({ synonymSet: await new StorefrontSynonymService().get(publicReference) })); }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ publicReference: string }> }) { return synonymUpdate(request, (await params).publicReference); }
