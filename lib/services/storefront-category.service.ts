import { prisma } from "@/lib/db/prisma";

type StorefrontCategoryClient = { storefrontCategoryDocument: { upsert(args: unknown): Promise<unknown> } };
const storefrontClient = prisma as unknown as StorefrontCategoryClient;

/** Builds category navigation from active taxonomy plus active public projection evidence. */
export async function rebuildStorefrontCategoryDocument(categoryId: string): Promise<void> {
  const category = await prisma.catalogCategory.findUnique({ where: { id: categoryId }, include: { imageAsset: true, parent: true, children: { where: { status: "ACTIVE" }, select: { publicReference: true, path: true, name: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }, productTypeMappings: { include: { productTypeDefinition: { select: { code: true, searchFacetSchema: true, status: true } } } } } });
  if (!category || category.status !== "ACTIVE") return;
  const countRows = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "StorefrontProductDocument" WHERE "categoryId" = ${category.id} AND "status" = 'ACTIVE'`;
  const productCount = Number(countRows[0]?.count ?? 0);
  const publicImageReference = category.imageAsset?.status === "READY" && category.imageAsset.privacyInspectionPassed ? category.imageAsset.publicReference : null;
  const facetDefinitions = Object.fromEntries(category.productTypeMappings.filter((mapping) => mapping.productTypeDefinition.status === "ACTIVE").map((mapping) => [mapping.productTypeDefinition.code, mapping.productTypeDefinition.searchFacetSchema]));
  await storefrontClient.storefrontCategoryDocument.upsert({
    where: { categoryId },
    create: { categoryId, categoryPublicReference: category.publicReference, canonicalPath: category.path, name: category.name, description: category.description, publicImageReference, parentPublicReference: category.parent?.publicReference ?? null, childNavigation: category.children.map((child) => ({ reference: child.publicReference, path: child.path, name: child.name })), productCount, availableFacetDefinitions: facetDefinitions, seoTitle: category.seoTitle, seoDescription: category.seoDescription, projectionVersion: 1, sourceUpdatedAt: category.updatedAt, indexedAt: new Date() },
    update: { canonicalPath: category.path, name: category.name, description: category.description, publicImageReference, parentPublicReference: category.parent?.publicReference ?? null, childNavigation: category.children.map((child) => ({ reference: child.publicReference, path: child.path, name: child.name })), productCount, availableFacetDefinitions: facetDefinitions, seoTitle: category.seoTitle, seoDescription: category.seoDescription, projectionVersion: { increment: 1 }, sourceUpdatedAt: category.updatedAt, indexedAt: new Date() },
  });
}
