import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { storeAccess } from "@/lib/client-platform/store-access";
import { uploadNormalizedStoreImage } from "@/lib/client-platform/catalog-image-upload";
import { failure, json } from "@/lib/client-platform/api";
import { rebuildStorefrontStoreDocument } from "@/lib/services/storefront-store.service";
import { createProductionCatalogMediaDeliveryStorageAdapter } from "@/lib/catalog/media/catalog-media-storage-adapter";
import { CLOUDINARY_CATALOG_STORAGE_CODE, createCloudinaryCatalogWriteAdapter } from "@/lib/catalog/media/cloudinary-catalog-media-storage";
import { z } from "zod";
import { mutation } from "@/lib/client-platform/api";
import { CatalogMediaArchiveSchema } from "@/lib/validation/catalog-media";
import { createProductionCatalogMediaIntakeService } from "@/lib/services/catalog-media-intake.service";
import { catalogApiError } from "@/lib/catalog/catalog-api-policy";

export async function GET(request: NextRequest) {
  const denied = await requireBusinessApi("/api/store/profile-media");
  if (denied) return denied;
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: "Sign in to continue." }, 401);
    const { store } = await storeAccess(user.id, "settings");
    const reference = request.nextUrl.searchParams.get("reference");
    const where = { ownerType: "STORE" as const, ownerStoreId: store.id, status: "READY" as const, privacyInspectionPassed: true };
    const orderBy = [{ createdAt: "desc" as const }, { id: "desc" as const }];
    if (!reference) {
      const [logo, cover] = await Promise.all([
        prisma.catalogMediaAsset.findFirst({ where: { ...where, purpose: "STORE_LOGO" }, orderBy, select: { publicReference: true } }),
        prisma.catalogMediaAsset.findFirst({ where: { ...where, purpose: "STORE_HERO" }, orderBy, select: { publicReference: true } }),
      ]);
      return json({ logo: logo?.publicReference ?? null, cover: cover?.publicReference ?? null });
    }
    const assets = await prisma.catalogMediaAsset.findMany({ where: { ...where, purpose: { in: ["STORE_LOGO", "STORE_HERO"] }, publicReference: reference }, take: 1, select: { publicReference: true, purpose: true, storageKey: true, storageProvider: true, mimeType: true, byteSize: true, checksum: true } });
    const asset = assets[0];
    if (!asset?.mimeType || !["image/webp", "image/png", "image/jpeg"].includes(asset.mimeType) || !asset.byteSize || !asset.checksum) return json({ error: "Image unavailable." }, 404);
    const storage = asset.storageProvider === CLOUDINARY_CATALOG_STORAGE_CODE ? createCloudinaryCatalogWriteAdapter() : createProductionCatalogMediaDeliveryStorageAdapter();
    const target = await storage.createReadTarget({ storageKey: asset.storageKey, maximumBytes: asset.byteSize });
    if (target.byteSize !== asset.byteSize || createHash("sha256").update(target.body).digest("hex") !== asset.checksum) return json({ error: "Image verification failed." }, 409);
    return new Response(Buffer.from(target.body), { headers: { "Content-Type": asset.mimeType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  const denied = await requireBusinessApi("/api/store/profile-media");
  if (denied) return denied;
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: "Sign in to continue." }, 401);
    const { store } = await storeAccess(user.id, "settings");
    const response = await uploadNormalizedStoreImage(request, user.id, store.id, ["STORE_LOGO", "STORE_HERO"]);
    if (response.ok) await rebuildStorefrontStoreDocument(store.id);
    return response;
  } catch (error) { return failure(error); }
}

const RemoveBrandingSchema = CatalogMediaArchiveSchema.extend({ reference: z.string().regex(/^CMA-[A-Z0-9]+$/) }).strict();
export async function DELETE(request: NextRequest) {
  const denied = await requireBusinessApi("/api/store/profile-media");
  if (denied) return denied;
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: "Sign in to continue." }, 401);
    const { store } = await storeAccess(user.id, "settings");
    const prepared = await mutation(request, `store-branding-remove:${user.id}`);
    if ("response" in prepared) return prepared.response;
    const input = RemoveBrandingSchema.parse(prepared.body);
    const owned = await prisma.catalogMediaAsset.findFirst({ where: { publicReference: input.reference, ownerType: "STORE", ownerStoreId: store.id, purpose: { in: ["STORE_LOGO", "STORE_HERO"] } }, select: { id: true } });
    if (!owned) return json({ error: "Store image unavailable." }, 404);
    const service = createProductionCatalogMediaIntakeService();
    const asset = await service.archiveStoreAsset({ actorUserId: user.id, storeId: store.id, publicReference: input.reference, operationId: input.operationId });
    await rebuildStorefrontStoreDocument(store.id);
    return json({ asset });
  } catch (error) { return error instanceof z.ZodError ? failure(error) : catalogApiError(error); }
}
