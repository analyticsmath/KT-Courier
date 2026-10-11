import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { describeCatalogIntegration } from "./catalog-integration-guard";
import { catalogFoundation, catalogEvidence } from "./catalog-canonical-support";
import { createCatalogCategory, updateCatalogCategory } from "@/lib/services/catalog-category.service";
import { transitionProductTypeDefinition, updateProductTypeDefinition } from "@/lib/services/product-type.service";
describeCatalogIntegration("canonical catalog taxonomy", () => {
  it("persists a parent/child path and denies cycles without events", async () => {
    const f = await catalogFoundation();
    const child = await createCatalogCategory({ actorUserId: f.user.id, name: "Child", slug: `child-${f.tag}`, parentId: f.category.id, status: "DRAFT", displayOrder: 0, operationId: randomUUID() });
    expect(child).toMatchObject({ depth: 1, path: `${f.category.path}/${child.slug}` });
    const before = await catalogEvidence(f.category.publicReference);
    await expect(updateCatalogCategory(f.category.id, { actorUserId: f.user.id, version: f.category.version, parentId: child.id, operationId: randomUUID() })).rejects.toThrow();
    expect(await prisma.catalogCategory.findUnique({ where: { id: f.category.id } })).toEqual(f.category);
    expect(await catalogEvidence(f.category.publicReference)).toEqual(before);
  });
  it("requires reviewed transitions and preserves immutable active schemas", async () => {
    const f = await catalogFoundation();
    const active = await transitionProductTypeDefinition(f.definition.id, "ACTIVE", { actorUserId: f.user.id, version: f.definition.version, operationId: randomUUID() });
    await expect(updateProductTypeDefinition(active.id, { actorUserId: f.user.id, version: active.version, name: "Changed", operationId: randomUUID() })).rejects.toMatchObject({ code: "PRODUCT_TYPE_IMMUTABLE" });
    await expect(prisma.productTypeDefinition.update({ where: { id: active.id }, data: { attributeSchema: { attributes: [{ code: "changed", label: "Changed", type: "TEXT" }] } } })).rejects.toThrow();
    expect(await prisma.productTypeDefinition.findUnique({ where: { id: active.id } })).toEqual(active);
    expect((await catalogEvidence(active.publicReference)).audit.map(item => item.action)).toEqual(["CREATED", "UNDER_REVIEW", "APPROVED", "ACTIVE"]);
  });
});

