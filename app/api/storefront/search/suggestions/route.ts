import { type NextRequest } from "next/server";
import { enforceStorefrontRateLimit, storefrontError, storefrontJson } from "@/lib/storefront/storefront-api-policy";
import { PostgresStorefrontSearchAdapter } from "@/lib/storefront/search/storefront-search-adapter";
import { StorefrontSearchService } from "@/lib/storefront/search/storefront-search.service";
import { loadActiveStorefrontSynonymTerms } from "@/lib/services/storefront-synonym.service";
import { assertStorefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";

export async function GET(request: NextRequest) {
  const limited = await enforceStorefrontRateLimit(request, "suggestions"); if (limited) return limited;
  try {
    assertStorefrontPublicExposureAllowed();
    const query = request.nextUrl.searchParams.get("q") ?? "";
    if (query.length > 160) return storefrontJson({ error: "Search query is too long." }, 422, { private: true });
    return storefrontJson(await new StorefrontSearchService(new PostgresStorefrontSearchAdapter(), { synonymTerms: await loadActiveStorefrontSynonymTerms() }).suggest(query));
  } catch (error) { return storefrontError(error); }
}
