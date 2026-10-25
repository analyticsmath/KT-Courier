import { type NextRequest } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/admin-api";
import { prepareCatalogMutation, catalogApiError, catalogJson } from "@/lib/catalog/catalog-api-policy";
import { createManagedModifierGroup } from "@/lib/super-admin/modifier.service";
import { importManagedCatalogDrafts } from "@/lib/super-admin/bulk-catalog";
import { createManagedStoreInvitation } from "@/lib/super-admin/store-invitation";
import { ManagedCommerceError, createManagedStore, createManagedProduct, createManagedOffer, createManagedPrice } from "@/lib/super-admin/commerce.service";

/** Super Admin authoring is separate from seller, catalog and finance approval. */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdminApi({ request });
  if (auth.response) return auth.response;
  const prepared = await prepareCatalogMutation(request, auth.user.id, "/api/admin/super-admin/commerce");
  if ("response" in prepared) return prepared.response;
  const body = prepared.body;
  if (!body || typeof body !== "object" || Array.isArray(body) || !("action" in body) || !("data" in body))
    return catalogJson({ error: "Select an authorized Super Admin operation." }, 422);
  const { action, data } = body as { action: unknown; data: unknown };
  try {
    switch (action) {
      case "INVITE_STORE_OWNER": return catalogJson({ invitation: await createManagedStoreInvitation(auth.user.id,data) },201);
      case "CREATE_STORE": return catalogJson({ store: await createManagedStore(auth.user.id, data) }, 201);
      case "CREATE_PRODUCT_DRAFT": return catalogJson({ product: await createManagedProduct(auth.user.id, data) }, 201);
      case "CREATE_OFFER_DRAFT": return catalogJson({ offer: await createManagedOffer(auth.user.id, data) }, 201);
      case "CREATE_PRICE_DRAFT": return catalogJson({ price: await createManagedPrice(auth.user.id, data) }, 201);
      case "CREATE_PRICED_ATTRIBUTES": return catalogJson({ modifierGroup: await createManagedModifierGroup(auth.user.id, data) }, 201);
      case "IMPORT_PRODUCT_DRAFTS": return catalogJson({ batch: await importManagedCatalogDrafts(auth.user.id, data) });
      default: return catalogJson({ error: "Unknown or unsupported operation." }, 422);
    }
  } catch (error) {
    if (error instanceof ManagedCommerceError) return catalogJson({ error: error.message, code: error.code }, error.status);
    return catalogApiError(error);
  }
}
