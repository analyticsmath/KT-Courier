import { prisma } from "@/lib/db/prisma";
import { catalogPublicReference } from "@/lib/catalog/catalog-normalization";
import { StorefrontProjectionService } from "@/lib/services/storefront-projection.service";
import { rebuildStorefrontStoreDocument } from "@/lib/services/storefront-store.service";
import { rebuildStorefrontCategoryDocument } from "@/lib/services/storefront-category.service";

type ProcessingClient = { storefrontEventProcessing: { findMany(args: unknown): Promise<Array<{ attemptNumber: number; status: string }>>; create(args: unknown): Promise<unknown> } };
const processingClient = prisma as unknown as ProcessingClient;

export class StorefrontEventConsumerService {
  constructor(private readonly projections = new StorefrontProjectionService()) {}

  async consumePending(limit = 50): Promise<{ processed: number; failed: number }> {
    const events = await prisma.catalogChangeEvent.findMany({ where: { processedAt: null }, orderBy: { createdAt: "asc" }, take: Math.max(1, Math.min(limit, 100)) });
    let processed = 0; let failed = 0;
    for (const event of events) {
      const previous = await processingClient.storefrontEventProcessing.findMany({ where: { catalogEventId: event.id }, orderBy: { attemptNumber: "desc" }, take: 1 });
      if (previous[0]?.status === "PROCESSED") { await prisma.catalogChangeEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } }); continue; }
      const attemptNumber = (previous[0]?.attemptNumber ?? 0) + 1;
      try {
        const snapshots = event.aggregateType === "SNAPSHOT"
          ? [event.aggregateReference]
          : (await prisma.catalogPublicationSnapshot.findMany({ where: { status: "PUBLISHED", supersededAt: null, OR: [{ offer: { publicReference: event.aggregateReference } }, { product: { publicReference: event.aggregateReference } }, { variant: { publicReference: event.aggregateReference } }] }, select: { publicReference: true } })).map((snapshot) => snapshot.publicReference);
        for (const snapshotReference of snapshots) {
          const document = await this.projections.buildPublishedSnapshot(snapshotReference);
          const source = await prisma.catalogPublicationSnapshot.findUnique({ where: { publicReference: snapshotReference }, select: { offer: { select: { storeId: true, product: { select: { primaryCategoryId: true } } } } } });
          if (source) await Promise.all([rebuildStorefrontStoreDocument(source.offer.storeId), rebuildStorefrontCategoryDocument(source.offer.product.primaryCategoryId)]);
          void document;
        }
        await processingClient.storefrontEventProcessing.create({ data: { catalogEventId: event.id, eventPublicReference: event.publicReference, aggregateReference: event.aggregateReference, aggregateVersion: event.aggregateVersion, attemptNumber, status: "PROCESSED", projectionVersion: snapshots[0] ?? null, safeSummary: snapshots.length ? "Published source evidence was projected and cache invalidation intent recorded." : "No published snapshot required a storefront projection." } });
        // Mark only after the projection/search/cache evidence completed.
        await prisma.catalogChangeEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
        processed += 1;
      } catch {
        await processingClient.storefrontEventProcessing.create({ data: { catalogEventId: event.id, eventPublicReference: event.publicReference, aggregateReference: event.aggregateReference, aggregateVersion: event.aggregateVersion, attemptNumber, status: "FAILED", safeSummary: "Projection failed without exposing source or provider details." } });
        failed += 1;
      }
    }
    return { processed, failed };
  }

  async withdrawOffer(offerReference: string): Promise<void> {
    await this.projections.withdrawOffer(offerReference);
  }
}

export async function recordStorefrontApplicationFailure(aggregateReference: string, safeSummary: string): Promise<void> {
  const client = prisma as unknown as { storefrontProjectionCase: { upsert(args: unknown): Promise<unknown> } };
  await client.storefrontProjectionCase.upsert({ where: { aggregateType_aggregateReference_reason: { aggregateType: "APPLICATION", aggregateReference, reason: "APPLICATION_FAILURE" } }, create: { publicReference: catalogPublicReference("SPC"), aggregateType: "APPLICATION", aggregateReference, reason: "APPLICATION_FAILURE", safeSummary: safeSummary.slice(0, 500) }, update: { status: "OBSERVED", observationCount: { increment: 1 }, version: { increment: 1 }, safeSummary: safeSummary.slice(0, 500), lastObservedAt: new Date(), resolvedAt: null, resolutionCode: null } });
}
