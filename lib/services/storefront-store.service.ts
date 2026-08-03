import { prisma } from "@/lib/db/prisma";

type StorefrontStoreClient = { storefrontStoreDocument: { upsert(args: unknown): Promise<unknown> } };
const storefrontClient = prisma as unknown as StorefrontStoreClient;

/** Builds the privacy-minimised store read projection. Store contact/address fields are intentionally absent. */
export async function rebuildStorefrontStoreDocument(storeId: string): Promise<void> {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true, slug: true, name: true, status: true, updatedAt: true } });
  if (!store) return;
  const documents = await prisma.$queryRaw<Array<{ categoryPublicReference: string; fulfilmentMode: string }>>`SELECT "categoryPublicReference", "fulfilmentMode" FROM "StorefrontProductDocument" WHERE "storeId" = ${store.id} AND "status" = 'ACTIVE'`;
  const active = store.status === "ACTIVE" && store.name.trim().length > 0 && documents.length > 0;
  await storefrontClient.storefrontStoreDocument.upsert({
    where: { storeId },
    create: { storeId, storePublicReference: store.slug, slug: store.slug, name: store.name, publicCategoryCodes: [...new Set(documents.map((document) => document.categoryPublicReference))].sort(), fulfilmentModes: [...new Set(documents.map((document) => document.fulfilmentMode))].sort(), serviceAreaReferences: [], publicStatus: active ? "ACTIVE" : "INELIGIBLE", publishedOfferCount: documents.length, projectionVersion: 1, sourceUpdatedAt: store.updatedAt, indexedAt: new Date() },
    update: { name: store.name, publicCategoryCodes: [...new Set(documents.map((document) => document.categoryPublicReference))].sort(), fulfilmentModes: [...new Set(documents.map((document) => document.fulfilmentMode))].sort(), serviceAreaReferences: [], publicStatus: active ? "ACTIVE" : "INELIGIBLE", publishedOfferCount: documents.length, sourceUpdatedAt: store.updatedAt, indexedAt: new Date(), projectionVersion: { increment: 1 } },
  });
}

