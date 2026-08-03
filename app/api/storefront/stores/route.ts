import { type NextRequest } from "next/server";
import { assertStorefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";
import { storefrontError, storefrontJson } from "@/lib/storefront/storefront-api-policy";
import { listStorefrontStores } from "@/lib/services/storefront-catalog.service";
export async function GET(request: NextRequest) { try { assertStorefrontPublicExposureAllowed(); const q = request.nextUrl.searchParams.get("q") ?? undefined; if (q && q.length > 80) return storefrontJson({ error: "Store query is too long." }, 422, { private: true }); return storefrontJson({ stores: await listStorefrontStores({ query: q, category: request.nextUrl.searchParams.get("category") ?? undefined, fulfilment: request.nextUrl.searchParams.get("fulfilment") ?? undefined, limit: Number(request.nextUrl.searchParams.get("pageSize")) || undefined }) }); } catch (error) { return storefrontError(error); } }

