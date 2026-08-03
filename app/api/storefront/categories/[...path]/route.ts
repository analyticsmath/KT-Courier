import { assertStorefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";
import { storefrontError, storefrontJson, storefrontNotFound } from "@/lib/storefront/storefront-api-policy";
import { getStorefrontCategory } from "@/lib/services/storefront-catalog.service";
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) { try { assertStorefrontPublicExposureAllowed(); const category = await getStorefrontCategory((await params).path.join("/")); return category ? storefrontJson(category) : storefrontNotFound(); } catch (error) { return storefrontError(error); } }

