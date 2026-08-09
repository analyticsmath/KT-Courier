import { type Prisma } from "@prisma/client";
import { catalogPublicReference } from "@/lib/catalog/catalog-normalization";
import { catalogRequestHash } from "@/lib/catalog/catalog-normalization";
import { toInputJsonObject } from "@/lib/json/input-json";

export async function recordCatalogEvidence(
  tx: Prisma.TransactionClient,
  args: {
    aggregateType: "CATEGORY" | "PRODUCT_TYPE" | "PRODUCT" | "VARIANT" | "OFFER" | "PRICE" | "INVENTORY" | "MODERATION" | "IMPORT" | "SNAPSHOT" | "MEDIA";
    aggregateReference: string;
    aggregateVersion: number;
    action: string;
    eventType: "CATEGORY_UPDATED" | "PRODUCT_TYPE_UPDATED" | "PRODUCT_PUBLISHED" | "PRODUCT_UPDATED" | "PRODUCT_SUSPENDED" | "VARIANT_UPDATED" | "OFFER_PUBLISHED" | "OFFER_UPDATED" | "PRICE_ACTIVATED" | "INVENTORY_CHANGED" | "MODERATION_RECORDED" | "IMPORT_APPLIED" | "SNAPSHOT_REBUILT" | "MEDIA_UPDATED";
    actorUserId: string;
    reasonCode?: string;
    safeMetadata?: Record<string, unknown>;
    operation?: { operationId: string; storeId?: string; request: unknown };
  },
): Promise<void> {
  const payload = toInputJsonObject(args.safeMetadata ?? {});
  await tx.catalogAuditHistory.create({
    data: {
      aggregateType: args.aggregateType,
      aggregateReference: args.aggregateReference,
      aggregateVersion: args.aggregateVersion,
      action: args.action,
      actorUserId: args.actorUserId,
      reasonCode: args.reasonCode,
      safeMetadata: payload,
    },
  });
  await tx.catalogChangeEvent.create({
    data: {
      publicReference: catalogPublicReference("CE"),
      aggregateType: args.aggregateType,
      aggregateReference: args.aggregateReference,
      eventType: args.eventType,
      aggregateVersion: args.aggregateVersion,
      payload,
    },
  });
  if (args.operation) {
    await tx.catalogOperationReceipt.create({
      data: {
        actorUserId: args.actorUserId,
        storeId: args.operation.storeId,
        operationId: args.operation.operationId,
        requestHash: catalogRequestHash(args.operation.request),
        action: `${args.aggregateType}:${args.action}`,
        aggregateReference: args.aggregateReference,
      },
    });
  }
}
