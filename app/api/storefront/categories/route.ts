import { assertStorefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";
import { storefrontError, storefrontJson } from "@/lib/storefront/storefront-api-policy";
import { listStorefrontCategories } from "@/lib/services/storefront-catalog.service";
export async function GET() { try { assertStorefrontPublicExposureAllowed(); return storefrontJson({ categories: await listStorefrontCategories() }); } catch (error) { return storefrontError(error); } }

