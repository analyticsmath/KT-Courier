import { expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { describeCatalogIntegration } from "./catalog-integration-guard";
import { catalogFoundation, catalogEvidence } from "./catalog-canonical-support";
import { createCatalogVariant } from "@/lib/services/catalog-variant.service";
import { searchCatalogDuplicates } from "@/lib/services/catalog-duplicate.service";
describeCatalogIntegration("canonical catalog variants", () => {
  it("persists unique normalized option combinations and denies duplicate/invalid/foreign variants", async () => {
    const f = await catalogFoundation(); const command = { storeId: f.store.id, productPublicReference: f.product.publicReference, actorUserId: f.user.id, title: "Blue large", options: [{ code: "colour", value: "blue" }, { code: "size", value: "large" }], attributeValues: {} };
    const variant = await createCatalogVariant(command); expect(variant.optionFingerprint).not.toBe(f.product.variants[0].optionFingerprint);
    const evidence = await catalogEvidence(variant.publicReference);
    await expect(createCatalogVariant({ ...command, options: [...command.options].reverse() })).rejects.toThrow();
    await expect(createCatalogVariant({ ...command, options: [{ code: "size", value: "small" }], gtin: "invalid" })).rejects.toMatchObject({ code: "INVALID_GTIN" });
    await expect(createCatalogVariant({ ...command, storeId: "foreign-store" })).rejects.toMatchObject({ code: "CATALOG_OWNERSHIP_DENIED" });
    expect(await prisma.catalogProductVariant.count({ where: { productId: f.product.id } })).toBe(2); expect(await catalogEvidence(variant.publicReference)).toEqual(evidence);
  });
  it("finds owned persisted duplicate candidates while keeping private foreign products out", async () => {
    const f = await catalogFoundation(); const query = { storeId: f.store.id, title: f.product.title, productTypeCode: f.definition.code };
    expect(await searchCatalogDuplicates(query)).toEqual(expect.arrayContaining([expect.objectContaining({ publicReference: f.product.publicReference })]));
    expect(await searchCatalogDuplicates({ ...query, storeId: "foreign-store" })).toEqual([]);
  });
});

