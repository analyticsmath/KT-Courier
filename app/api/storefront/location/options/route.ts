import { type NextRequest } from "next/server";
import { enforceStorefrontRateLimit, storefrontError, storefrontJson } from "@/lib/storefront/storefront-api-policy";
import { listStorefrontLocationOptions } from "@/lib/storefront/storefront-location.service";
export async function GET(request: NextRequest) { const limited = await enforceStorefrontRateLimit(request, "location"); if (limited) return limited; try { return storefrontJson({ options: await listStorefrontLocationOptions() }, 200, { private: true }); } catch (error) { return storefrontError(error); } }

