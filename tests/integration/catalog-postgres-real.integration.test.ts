import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db/prisma";

const runPostgresTests = !!process.env.DATABASE_URL && process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS === "1";
const describeReal = runPostgresTests ? describe : describe.skip;

describeReal("Catalogue Real PostgreSQL Integration", () => {
  const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const categorySlug = `cat-test-${nonce}`;
  const typeCode = `type-test-${nonce}`;
  const productRef = `prod-ref-${nonce}`;
  const productSlug = `prod-slug-${nonce}`;

  let createdCategoryId: string | null = null;
  let createdTypeId: string | null = null;
  let createdProductId: string | null = null;
  let createdUserId: string | null = null;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `cat-user-${nonce}@example.com`,
        role: "STORE",
        status: "ACTIVE",
      },
    });
    createdUserId = user.id;

    const category = await prisma.catalogCategory.create({
      data: {
        publicReference: `cat-ref-${nonce}`,
        name: "Test Category",
        slug: categorySlug,
        path: categorySlug,
        depth: 0,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
    });
    createdCategoryId = category.id;

    const typeDef = await prisma.productTypeDefinition.create({
      data: {
        publicReference: `pt-ref-${nonce}`,
        code: typeCode,
        name: "Test Type Definition",
        versionNumber: 1,
        status: "ACTIVE",
        attributeSchema: {},
        variantSchema: {},
        complianceSchema: {},
        searchFacetSchema: {},
        createdByUserId: user.id,
      },
    });
    createdTypeId = typeDef.id;
  });

  afterAll(async () => {
    if (createdProductId) {
      await prisma.catalogProduct.deleteMany({ where: { id: createdProductId } });
    }
    if (createdCategoryId) {
      await prisma.catalogCategory.deleteMany({ where: { id: createdCategoryId } });
    }
    if (createdTypeId) {
      await prisma.productTypeDefinition.deleteMany({ where: { id: createdTypeId } });
    }
    if (createdUserId) {
      await prisma.user.deleteMany({ where: { id: createdUserId } });
    }
  });

  it("inserts and projects a catalog product in PostgreSQL", async () => {
    const product = await prisma.catalogProduct.create({
      data: {
        publicReference: productRef,
        scope: "GLOBAL_CANONICAL",
        productTypeDefinitionId: createdTypeId!,
        productTypeVersionNumber: 1,
        primaryCategoryId: createdCategoryId!,
        title: "Real PostgreSQL Test Product",
        normalizedTitle: "real postgresql test product",
        slug: productSlug,
        attributeValues: {},
        complianceValues: {},
        qualityIssues: [],
        createdByUserId: createdUserId!,
        status: "DRAFT",
      },
    });

    createdProductId = product.id;
    expect(product.id).toBeDefined();
    expect(product.publicReference).toBe(productRef);

    const fetched = await prisma.catalogProduct.findUnique({
      where: { id: product.id },
      include: { primaryCategory: true },
    });

    expect(fetched).not.toBeNull();
    expect(fetched?.primaryCategory.slug).toBe(categorySlug);
  });

  it("enforces unique constraint on publicReference", async () => {
    await expect(
      prisma.catalogProduct.create({
        data: {
          publicReference: productRef, // duplicate reference
          scope: "GLOBAL_CANONICAL",
          productTypeDefinitionId: createdTypeId!,
          productTypeVersionNumber: 1,
          primaryCategoryId: createdCategoryId!,
          title: "Duplicate Reference Product",
          normalizedTitle: "duplicate reference product",
          slug: `prod-slug-dup-${nonce}`,
          attributeValues: {},
          complianceValues: {},
          qualityIssues: [],
          createdByUserId: createdUserId!,
          status: "DRAFT",
        },
      })
    ).rejects.toThrow();
  });

  it("rolls back transaction cleanly upon error", async () => {
    const rolledBackRef = `rolled-back-${nonce}`;
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.catalogProduct.create({
          data: {
            publicReference: rolledBackRef,
            scope: "GLOBAL_CANONICAL",
            productTypeDefinitionId: createdTypeId!,
            productTypeVersionNumber: 1,
            primaryCategoryId: createdCategoryId!,
            title: "Transaction Test Product",
            normalizedTitle: "transaction test product",
            slug: `prod-slug-tx-${nonce}`,
            attributeValues: {},
            complianceValues: {},
            qualityIssues: [],
            createdByUserId: createdUserId!,
            status: "DRAFT",
          },
        });
        throw new Error("Intentional Rollback Trigger");
      })
    ).rejects.toThrow("Intentional Rollback Trigger");

    const found = await prisma.catalogProduct.findUnique({
      where: { publicReference: rolledBackRef },
    });
    expect(found).toBeNull();
  });
});
