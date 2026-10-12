import { type NextRequest } from "next/server";
import { requireCatalogAdminPermission } from "@/lib/catalog/catalog-auth";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { catalogApiError, catalogJson, prepareCatalogMutation } from "@/lib/catalog/catalog-api-policy";
import { CatalogListingPublishSchema } from "@/lib/validation/catalog-publication";
import { publishApprovedCatalogListing } from "@/lib/services/catalog-listing-publication.service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCatalogAdminPermission(PERMISSIONS.CATALOG_MODERATION_APPROVE, request);
  if ("response" in auth) return auth.response ?? catalogJson({ error: "Catalog publication access denied." }, 403);
  const pricing = await requireCatalogAdminPermission(PERMISSIONS.CATALOG_PRICING_MANAGE, request);
  if ("response" in pricing) return pricing.response ?? catalogJson({ error: "Catalog pricing access denied." }, 403);
  if (pricing.user.id !== auth.user.id) return catalogJson({ error: "Session changed; sign in again." }, 403);
  const { id } = await params;
  const prepared = await prepareCatalogMutation(request, auth.user.id, `/api/admin/catalog/offers/${id}/publish`);
  if ("response" in prepared) return prepared.response;
  const parsed = CatalogListingPublishSchema.safeParse(prepared.body);
  if (!parsed.success) return catalogJson({ error: "Review the exact product, offer, price version and publication reason." }, 422);
  try { return catalogJson(await publishApprovedCatalogListing(id, auth.user.id, parsed.data)); }
  catch (error) { return catalogApiError(error); }
}
