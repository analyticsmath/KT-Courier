import { assertStorefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";
import { storefrontError, storefrontJson, storefrontNotFound } from "@/lib/storefront/storefront-api-policy";
import { getStorefrontCollection } from "@/lib/services/storefront-catalog.service";
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) { try { assertStorefrontPublicExposureAllowed(); const collection = await getStorefrontCollection((await params).slug); return collection ? storefrontJson(collection) : storefrontNotFound(); } catch (error) { return storefrontError(error); } }

