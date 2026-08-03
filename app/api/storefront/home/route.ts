import { assertStorefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";
import { storefrontError, storefrontJson } from "@/lib/storefront/storefront-api-policy";
import { getStorefrontHome } from "@/lib/services/storefront-catalog.service";

export async function GET() {
  try { assertStorefrontPublicExposureAllowed(); return storefrontJson(await getStorefrontHome()); }
  catch (error) { return storefrontError(error); }
}

