import { assertStorefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";
import { storefrontError, storefrontJson, storefrontNotFound } from "@/lib/storefront/storefront-api-policy";
import { getStorefrontProduct } from "@/lib/services/storefront-catalog.service";
export async function GET(_request: Request, { params }: { params: Promise<{ publicReference: string }> }) { try { assertStorefrontPublicExposureAllowed(); const product = await getStorefrontProduct((await params).publicReference); return product ? storefrontJson(product) : storefrontNotFound(); } catch (error) { return storefrontError(error); } }

