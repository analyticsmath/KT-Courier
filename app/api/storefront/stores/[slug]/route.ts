import { assertStorefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";
import { storefrontError, storefrontJson, storefrontNotFound } from "@/lib/storefront/storefront-api-policy";
import { getStorefrontStore } from "@/lib/services/storefront-catalog.service";
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) { try { assertStorefrontPublicExposureAllowed(); const store = await getStorefrontStore((await params).slug); return store ? storefrontJson(store) : storefrontNotFound(); } catch (error) { return storefrontError(error); } }

