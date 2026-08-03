import { type NextRequest } from "next/server";
import { enforceStorefrontRateLimit, storefrontError, storefrontJson } from "@/lib/storefront/storefront-api-policy";
import { parseStorefrontFilters } from "@/lib/storefront/search/storefront-filter-url";
import { PostgresStorefrontSearchAdapter } from "@/lib/storefront/search/storefront-search-adapter";
import { StorefrontSearchService } from "@/lib/storefront/search/storefront-search.service";
import { loadActiveStorefrontSynonymTerms } from "@/lib/services/storefront-synonym.service";
import { assertStorefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";

export async function GET(request: NextRequest) {
  const limited = enforceStorefrontRateLimit(request, "search"); if (limited) return limited;
  try {
    assertStorefrontPublicExposureAllowed();
    const raw = request.nextUrl.searchParams.get("q");
    if (raw && raw.length > 160) return storefrontJson({ error: "Search query is too long." }, 422, { private: true });
    const filters = parseStorefrontFilters(request.nextUrl.searchParams);
    return storefrontJson(await new StorefrontSearchService(new PostgresStorefrontSearchAdapter(), { synonymTerms: await loadActiveStorefrontSynonymTerms() }).search(filters));
  } catch (error) { return storefrontError(error); }
}
