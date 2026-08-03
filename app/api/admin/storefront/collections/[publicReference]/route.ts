import { type NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { StorefrontCollectionService } from "@/lib/services/storefront-collection.service";
import { storefrontAdminRead } from "@/lib/storefront/storefront-admin-route-handlers";
import { collectionUpdate } from "@/lib/storefront/storefront-admin-route-handlers";
export async function GET(_request: NextRequest, { params }: { params: Promise<{ publicReference: string }> }) { const publicReference = (await params).publicReference; return storefrontAdminRead(PERMISSIONS.STOREFRONT_COLLECTIONS_READ, async () => ({ collection: await new StorefrontCollectionService().get(publicReference) })); }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ publicReference: string }> }) { return collectionUpdate(request, (await params).publicReference); }
