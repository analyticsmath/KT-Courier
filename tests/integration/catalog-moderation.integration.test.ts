import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { describeCatalogIntegration } from "./catalog-integration-guard";
import { catalogFoundation, catalogEvidence, catalogReadyPrimary } from "./catalog-canonical-support";
import { submitStoreCatalogProduct } from "@/lib/services/catalog-product.service";
import { moderateCatalogProduct } from "@/lib/services/catalog-moderation.service";
describeCatalogIntegration("canonical catalog moderation", () => {
  it("requires genuine READY media before submission and denies direct draft approval", async () => {
    const f = await catalogFoundation(); const before = await catalogEvidence(f.product.publicReference);
    await expect(submitStoreCatalogProduct(f.store.id, f.product.publicReference, f.user.id, { version: 1, operationId: randomUUID() })).rejects.toMatchObject({ code: "CATALOG_MEDIA_PRIMARY_REQUIRED" });
    await expect(moderateCatalogProduct(f.product.id, f.user.id, "APPROVE", { version: 1, operationId: randomUUID(), reasonCode: "DISPOSABLE" })).rejects.toThrow();
    expect(await prisma.catalogProduct.findUnique({ where: { id: f.product.id } })).toMatchObject({ status: "DRAFT", version: 1 });
    expect(await catalogEvidence(f.product.publicReference)).toEqual(before);
  });
  it("persists submission, requests changes, resubmission and approval with exact replay authority", async () => {
    const f = await catalogFoundation(); let product = await catalogReadyPrimary(f);
    product = await submitStoreCatalogProduct(f.store.id, product.publicReference, f.user.id, { version: product.version, operationId: randomUUID() });
    product = await moderateCatalogProduct(product.id, f.user.id, "REQUEST_CHANGES", { version: product.version, operationId: randomUUID(), reasonCode: "DISPOSABLE_REVIEW" });
    expect(product.status).toBe("NEEDS_CHANGES");
    product = await submitStoreCatalogProduct(f.store.id, product.publicReference, f.user.id, { version: product.version, operationId: randomUUID() });
    const command = { version: product.version, operationId: randomUUID(), reasonCode: "DISPOSABLE_APPROVAL" };
    const approved = await moderateCatalogProduct(product.id, f.user.id, "APPROVE", command); expect(approved.status).toBe("APPROVED");
    const before = await catalogEvidence(product.publicReference);
    expect(await moderateCatalogProduct(product.id, f.user.id, "APPROVE", command)).toEqual(approved);
    await expect(moderateCatalogProduct(product.id, f.user.id, "APPROVE", { ...command, reasonCode: "CHANGED" })).rejects.toMatchObject({ code: "OPERATION_REPLAY_MISMATCH" });
    expect(await catalogEvidence(product.publicReference)).toEqual(before);
    expect(await prisma.catalogModerationHistory.count({ where: { moderationCase: { productId: product.id } } })).toBe(2);
  });
});

