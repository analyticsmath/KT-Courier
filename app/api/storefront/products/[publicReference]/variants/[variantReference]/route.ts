import { assertStorefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";
import { storefrontError, storefrontJson, storefrontNotFound } from "@/lib/storefront/storefront-api-policy";
import { getStorefrontVariant } from "@/lib/services/storefront-catalog.service";
export async function GET(_request: Request, { params }: { params: Promise<{ publicReference: string; variantReference: string }> }) { try { assertStorefrontPublicExposureAllowed(); const { publicReference, variantReference } = await params; const variant = await getStorefrontVariant(publicReference, variantReference); return variant ? storefrontJson(variant) : storefrontNotFound(); } catch (error) { return storefrontError(error); } }

