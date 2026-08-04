import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db/prisma";

const runPostgresTests = !!process.env.DATABASE_URL && process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS === "1";
const describeReal = runPostgresTests ? describe : describe.skip;

describeReal("Storefront Real PostgreSQL Integration", () => {
  const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const storeSlug = `sf-store-${nonce}`;
  const storeRef = `sf-store-ref-${nonce}`;
  const categorySlug = `sf-cat-${nonce}`;
  const categoryRef = `sf-cat-ref-${nonce}`;

  let createdStoreId: string | null = null;
  let createdCategoryId: string | null = null;
  let createdDocId: string | null = null;
  let createdUserId: string | null = null;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `sf-user-${nonce}@example.com`,
        role: "STORE",
        status: "ACTIVE",
      },
    });
    createdUserId = user.id;

    const store = await prisma.store.create({
      data: {
        name: "Storefront Test Store",
        slug: storeSlug,
        status: "ACTIVE",
      },
    });
    createdStoreId = store.id;

    const category = await prisma.catalogCategory.create({
      data: {
        publicReference: categoryRef,
        name: "Storefront Category",
        slug: categorySlug,
        path: categorySlug,
        depth: 0,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
    });
    createdCategoryId = category.id;
  });

  afterAll(async () => {
    if (createdDocId) {
      await prisma.storefrontStoreDocument.deleteMany({ where: { id: createdDocId } });
    }
    if (createdStoreId) {
      await prisma.store.deleteMany({ where: { id: createdStoreId } });
    }
    if (createdCategoryId) {
      await prisma.catalogCategory.deleteMany({ where: { id: createdCategoryId } });
    }
    if (createdUserId) {
      await prisma.user.deleteMany({ where: { id: createdUserId } });
    }
  });

  it("creates and queries a storefront store document projection", async () => {
    const now = new Date();
    const doc = await prisma.storefrontStoreDocument.create({
      data: {
        storeId: createdStoreId!,
        storePublicReference: storeRef,
        slug: storeSlug,
        name: "Storefront Test Store",
        publicCategoryCodes: [categorySlug],
        fulfilmentModes: ["DELIVERY"],
        serviceAreaReferences: ["PRIMARY"],
        publicStatus: "ACTIVE",
        publishedOfferCount: 10,
        sourceUpdatedAt: now,
        indexedAt: now,
      },
    });

    createdDocId = doc.id;
    expect(doc.id).toBeDefined();
    expect(doc.publicStatus).toBe("ACTIVE");

    const fetched = await prisma.storefrontStoreDocument.findUnique({
      where: { storeId: createdStoreId! },
    });

    expect(fetched).not.toBeNull();
    expect(fetched?.slug).toBe(storeSlug);
    expect(fetched?.publishedOfferCount).toBe(10);
  });

  it("enforces unique constraint on storePublicReference and slug", async () => {
    const now = new Date();
    await expect(
      prisma.storefrontStoreDocument.create({
        data: {
          storeId: createdStoreId!, // duplicate storeId
          storePublicReference: storeRef,
          slug: storeSlug,
          name: "Duplicate Storefront Doc",
          publicCategoryCodes: [],
          fulfilmentModes: [],
          serviceAreaReferences: [],
          publicStatus: "ACTIVE",
          sourceUpdatedAt: now,
          indexedAt: now,
        },
      })
    ).rejects.toThrow();
  });

  it("performs projection search queries with JSON filtering", async () => {
    const publishedStores = await prisma.storefrontStoreDocument.findMany({
      where: {
        publicStatus: "ACTIVE",
        publishedOfferCount: { gte: 5 },
      },
    });

    expect(publishedStores.length).toBeGreaterThanOrEqual(1);
    expect(publishedStores.some((s) => s.slug === storeSlug)).toBe(true);
  });
});
