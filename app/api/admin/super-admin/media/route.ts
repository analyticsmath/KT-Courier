import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/auth/admin-api";
import { catalogApiError, catalogJson, prepareCatalogMutation } from "@/lib/catalog/catalog-api-policy";
import { prisma } from "@/lib/db/prisma";
import { createProductionCatalogMediaIntakeService } from "@/lib/services/catalog-media-intake.service";
import { attachStoreCatalogMedia } from "@/lib/services/catalog-media-attachment.service";
import { CatalogMediaUploadIntentSchema, CatalogMediaCompleteSchema } from "@/lib/validation/catalog-media";

const intentSchema = CatalogMediaUploadIntentSchema.extend({ storeId: z.string().min(15).max(64) }).strict();
const completeSchema = CatalogMediaCompleteSchema.extend({
  storeId: z.string().min(15).max(64), uploadReference: z.string().regex(/^CMU-[A-F0-9]{32}$/),
  productReference: z.string().regex(/^CP-[A-F0-9]{32}$/), productVersion: z.number().int().positive(),
  altText: z.string().trim().min(3).max(240),
}).strict();
const attachSchema = z.object({
 storeId: z.string().min(15).max(64), productReference: z.string().regex(/^CP-[A-F0-9]{32}$/),
 productVersion: z.number().int().positive(), assetPublicReference: z.string().regex(/^CMA-[A-F0-9]{32}$/),
 altText: z.string().trim().min(3).max(240),operationId:z.string().min(8).max(160),
}).strict();
const service = createProductionCatalogMediaIntakeService();

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdminApi({ request });
  if (auth.response) return auth.response;
  const prepared = await prepareCatalogMutation(request, auth.user.id, "/api/admin/super-admin/media");
  if ("response" in prepared) return prepared.response;
  const body = prepared.body as { action?: unknown; data?: unknown } | null;
  if (!body || typeof body !== "object") return catalogJson({ error: "Select a valid upload action." }, 422);
  try {
    if (body.action === "ATTACH_READY_MEDIA") {
      const parsed = attachSchema.safeParse(body.data);
      if (!parsed.success) return catalogJson({ error: "Invalid media attachment input." }, 422);
      const d = parsed.data;
      const asset = await service.getStoreAsset(d.storeId,d.assetPublicReference);
      if (asset.status !== "READY") return catalogJson({ error: "Only inspected READY assets may be attached to catalog products." }, 409);
      const attached = await attachStoreCatalogMedia(d.storeId,d.productReference,auth.user.id,{ assetPublicReference: d.assetPublicReference, productVersion: d.productVersion,role:"PRIMARY",altText:d.altText,displayOrder:0,operationId:d.operationId });
      return catalogJson({asset,attached},201);
    }
    if (body.action === "START_MEDIA_UPLOAD") {
      const params = intentSchema.safeParse(body.data);
      if (!params.success) return catalogJson({ error: "Invalid media upload request." }, 422);
      const { storeId, ...data } = params.data;
      const store = await prisma.store.findFirst({ where: { id: storeId, status: { in: ["ACTIVE", "PENDING"] } }, select: { id: true } });
      if (!store) return catalogJson({ error: "Store is not eligible for catalog authoring." }, 409);
      return catalogJson(await service.createUploadIntent({ ...data, actorUserId: auth.user.id, ownerType: "STORE", storeId }), 201);
    }
    if (body.action === "COMPLETE_AND_ATTACH_MEDIA") {
      const params = completeSchema.safeParse(body.data);
      if (!params.success) return catalogJson({ error: "Invalid media attachment request." }, 422);
      const { storeId, uploadReference, productReference, productVersion, altText, operationId } = params.data;
      // Completion verifies bytes and rejects unsafe media. Attachment enforces ownership and DRAFT status.
      const completed = await service.completeUpload({ actorUserId: auth.user.id, storeId, uploadReference, operationId });
      if (completed.asset.status !== "READY") return catalogJson({ error: "Media must pass content inspection before association." }, 409);
      const attached = await attachStoreCatalogMedia(storeId, productReference, auth.user.id, {
        assetPublicReference: completed.asset.publicReference, productVersion, role: "PRIMARY", altText, displayOrder: 0,
        operationId: `${operationId}-attach`,
      });
      return catalogJson({ asset: completed.asset, attached }, 201);
    }
    return catalogJson({ error: "Unsupported media action." }, 422);
  } catch (error) { return catalogApiError(error); }
}
