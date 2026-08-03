import { prisma } from "@/lib/db/prisma";
import { assertCategoryParentAllowed, categoryPath } from "@/lib/catalog/category-tree-policy";
import { catalogPublicReference } from "@/lib/catalog/catalog-normalization";
import { CatalogConflictError, CatalogNotFoundError } from "@/lib/catalog/errors";
import { recordCatalogEvidence } from "@/lib/services/catalog-service-support";

export async function listCatalogCategories() {
  return prisma.catalogCategory.findMany({ orderBy: [{ path: "asc" }, { displayOrder: "asc" }] });
}

export async function createCatalogCategory(args: {
  actorUserId: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string | null;
  status: "DRAFT" | "ACTIVE" | "HIDDEN";
  displayOrder: number;
  operationId: string;
}) {
  const categories = await prisma.catalogCategory.findMany({ select: { id: true, parentId: true, slug: true, status: true, path: true, depth: true } });
  assertCategoryParentAllowed({ parentId: args.parentId ?? null, categories });
  const parent = args.parentId ? categories.find((category) => category.id === args.parentId) : null;
  const publicReference = catalogPublicReference("CAT");
  return prisma.$transaction(async (tx) => {
    const category = await tx.catalogCategory.create({
      data: {
        publicReference,
        name: args.name,
        slug: args.slug,
        description: args.description,
        parentId: args.parentId,
        depth: parent ? parent.depth + 1 : 0,
        path: categoryPath(parent?.path ?? null, args.slug),
        status: args.status,
        displayOrder: args.displayOrder,
        createdByUserId: args.actorUserId,
        updatedByUserId: args.actorUserId,
      },
    });
    await recordCatalogEvidence(tx, { aggregateType: "CATEGORY", aggregateReference: publicReference, aggregateVersion: 1, action: "CREATED", eventType: "CATEGORY_UPDATED", actorUserId: args.actorUserId, operation: { operationId: args.operationId, request: args } });
    return category;
  });
}

export async function updateCatalogCategory(id: string, args: {
  actorUserId: string;
  version: number;
  name?: string;
  slug?: string;
  description?: string;
  parentId?: string | null;
  status?: "DRAFT" | "ACTIVE" | "HIDDEN";
  displayOrder?: number;
  operationId: string;
}) {
  const current = await prisma.catalogCategory.findUnique({ where: { id } });
  if (!current) throw new CatalogNotFoundError("Catalog category was not found.");
  const categories = await prisma.catalogCategory.findMany({ select: { id: true, parentId: true, slug: true, status: true, path: true, depth: true } });
  const parentId = args.parentId === undefined ? current.parentId : args.parentId;
  assertCategoryParentAllowed({ categoryId: id, parentId, categories });
  const parent = parentId ? categories.find((category) => category.id === parentId) : null;
  const nextVersion = current.version + 1;
  return prisma.$transaction(async (tx) => {
    const updated = await tx.catalogCategory.updateMany({
      where: { id, version: args.version },
      data: {
        name: args.name,
        slug: args.slug,
        description: args.description,
        parentId: args.parentId,
        status: args.status,
        displayOrder: args.displayOrder,
        depth: parent ? parent.depth + 1 : 0,
        path: categoryPath(parent?.path ?? null, args.slug ?? current.slug),
        updatedByUserId: args.actorUserId,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new CatalogConflictError("CATALOG_VERSION_CONFLICT", "Catalog category changed; reload before saving.");
    await recordCatalogEvidence(tx, { aggregateType: "CATEGORY", aggregateReference: current.publicReference, aggregateVersion: nextVersion, action: "UPDATED", eventType: "CATEGORY_UPDATED", actorUserId: args.actorUserId, operation: { operationId: args.operationId, request: args } });
    return tx.catalogCategory.findUniqueOrThrow({ where: { id } });
  });
}
