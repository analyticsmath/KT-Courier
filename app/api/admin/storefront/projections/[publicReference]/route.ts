import { type NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { StorefrontReconciliationService } from "@/lib/services/storefront-reconciliation.service";
import { storefrontAdminRead } from "@/lib/storefront/storefront-admin-route-handlers";
export async function GET(_request: NextRequest, { params }: { params: Promise<{ publicReference: string }> }) { const publicReference = (await params).publicReference; return storefrontAdminRead(PERMISSIONS.STOREFRONT_PROJECTIONS_READ, async () => ({ projectionCase: await new StorefrontReconciliationService().inspect(publicReference) })); }
