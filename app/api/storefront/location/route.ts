import { type NextRequest } from "next/server";
import { enforceStorefrontRateLimit, storefrontJson } from "@/lib/storefront/storefront-api-policy";
import { STOREFRONT_LOCATION_COOKIE, STOREFRONT_LOCATION_COOKIE_OPTIONS } from "@/lib/storefront/storefront-location.service";
export async function DELETE(request: NextRequest) { const limited = enforceStorefrontRateLimit(request, "location"); if (limited) return limited; const response = storefrontJson({ context: { serviceAreaReference: null, resolutionStatus: "UNKNOWN" } }, 200, { private: true }); response.cookies.set(STOREFRONT_LOCATION_COOKIE, "", { ...STOREFRONT_LOCATION_COOKIE_OPTIONS, maxAge: 0 }); return response; }

