import { beforeAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import { catalogPublicReference } from "@/lib/catalog/catalog-normalization";
import { createStoreCatalogListingDraft } from "@/lib/services/catalog-listing-draft.service";
import { searchCatalogDuplicates } from "@/lib/services/catalog-duplicate.service";
import { type CatalogListingDraftInput } from "@/lib/validation/catalog-listing-draft";
import { archiveStoreCatalogProduct, getStoreCatalogProduct, submitStoreCatalogProduct, updateStoreCatalogProduct } from "@/lib/services/catalog-product.service";
import { transitionStoreCatalogOffer } from "@/lib/services/store-offer.service";
import { moderateCatalogOffer, moderateCatalogProduct } from "@/lib/services/catalog-moderation.service";
import { publishApprovedCatalogListing } from "@/lib/services/catalog-listing-publication.service";

async function foundation() {
  requireDisposableStoreSettlementDatabase();
  const tag = randomUUID();
  const user = await prisma.user.create({ data: { email: `disposable-catalog-${tag}@example.test`, role: "STORE", status: "ACTIVE" } });
  const store = await prisma.store.create({ data: { ownerUserId: user.id, name: "Disposable catalog store", slug: `disposable-catalog-${tag}`, status: "ACTIVE" } });
  const category = await prisma.catalogCategory.create({ data: { publicReference: catalogPublicReference("CC"), name: "Disposable category", slug: tag, path: tag, depth: 0, status: "ACTIVE", createdByUserId: user.id, updatedByUserId: user.id } });
  const definition = await prisma.productTypeDefinition.create({ data: { publicReference: catalogPublicReference("PT"), code: `DISPOSABLE_${tag.replaceAll("-", "").toUpperCase()}`, name: "Disposable type", versionNumber: 1, status: "APPROVED", attributeSchema: { attributes: [{ code: "material", label: "Material", type: "TEXT", required: true }] }, variantSchema: {}, complianceSchema: {}, searchFacetSchema: {}, createdByUserId: user.id } });
  const location = await prisma.inventoryLocation.create({ data: { publicReference: catalogPublicReference("IL"), storeId: store.id, name: "Disposable stock location", status: "ACTIVE" } });
  // Synthetic READY source facts exercise attachment/transaction integrity, not upload/storage certification.
  const asset = await prisma.catalogMediaAsset.create({ data: { publicReference: catalogPublicReference("CMA"), ownerType: "STORE", ownerStoreId: store.id, purpose: "PRODUCT_IMAGE", storageKey: `catalog-media/${createHash("sha256").update(tag).digest("hex")}`, storageProvider: "DISPOSABLE_FIXTURE", declaredMimeType: "image/png", mimeType: "image/png", declaredByteSize: 100, byteSize: 100, width: 100, height: 100, checksum: "a".repeat(64), privacyInspectionPassed: true, storageConfirmedAt: new Date(), validatedAt: new Date(), status: "READY", createdByUserId: user.id, updatedByUserId: user.id } });
  const input: CatalogListingDraftInput = {
    operationId: tag, product: { scope: "STORE_PRIVATE", productTypeDefinitionId: definition.id, primaryCategoryId: category.id, title: `Disposable product ${tag}`, description: "Synthetic listing facts for transaction checks only.", condition: "NEW", attributeValues: { material: "cotton" }, complianceValues: {} },
    variants: [], storeSku: `DISPOSABLE-${tag}`,
    price: { amount: "19.25", currency: "ZAR", priceIncludesTax: true, effectiveFrom: new Date().toISOString() }, openingStock: 7, inventoryLocationPublicReference: location.publicReference,
    modifiers: [{ name: "Gift wrap", minimumSelections: 0, maximumSelections: 1, isRequired: false, options: [{ name: "Paper", priceDelta: "1.10", currency: "ZAR", displayOrder: 0 }] }],
    media: [{ assetPublicReference: asset.publicReference, altText: "Disposable cotton product", displayOrder: 0, primary: true, variantAssociation: "PRODUCT" }],
  };
  return { user, store, category, definition, location, asset, input };
}
async function counts(storeId: string) {
  return { products: await prisma.catalogProduct.count({ where: { sourceStoreId: storeId } }), offers: await prisma.storeCatalogOffer.count({ where: { storeId } }), groups: await prisma.storeModifierGroup.count({ where: { storeId } }), receipts: await prisma.catalogOperationReceipt.count({ where: { storeId } }) };
}
async function submittedListing() {
  const source = await foundation();
  const draft = await createStoreCatalogListingDraft(source.store.id, source.user.id, source.input);
  const product = await submitStoreCatalogProduct(source.store.id, draft.publicReference, source.user.id, { version: draft.version, operationId: randomUUID() });
  return { ...source, draft, product };
}

describe("canonical store product commands on isolated PostgreSQL", { timeout: 20_000 }, () => {
  beforeAll(() => requireDisposableStoreSettlementDatabase());
  it("serializes concurrent draft edits with one audit, event and receipt", async () => {
    const source = await foundation(); const draft = await createStoreCatalogListingDraft(source.store.id, source.user.id, source.input);
    const command = { operationId: randomUUID(), version: draft.version, title: "Disposable updated product", description: "Canonical edited description for transaction validation." };
    const results = await Promise.all([updateStoreCatalogProduct(source.store.id, draft.publicReference, source.user.id, command), updateStoreCatalogProduct(source.store.id, draft.publicReference, source.user.id, command)]);
    expect(results[0]).toEqual(results[1]); expect(results[0]).toMatchObject({ title: command.title, version: command.version + 1, status: "DRAFT", publicationStatus: "DRAFT" });
    expect(await prisma.catalogAuditHistory.count({ where: { aggregateReference: draft.publicReference, action: "DRAFT_UPDATED" } })).toBe(1);
    expect(await prisma.catalogChangeEvent.count({ where: { aggregateReference: draft.publicReference, aggregateVersion: command.version + 1 } })).toBe(1);
    expect(await prisma.catalogOperationReceipt.count({ where: { actorUserId: source.user.id, operationId: command.operationId } })).toBe(1);
  });
  it("returns current submitted state when an earlier successful edit is retried", async () => {
    const source = await foundation(); const draft = await createStoreCatalogListingDraft(source.store.id, source.user.id, source.input);
    const command = { operationId: randomUUID(), version: draft.version, title: "Disposable replay edit" };
    const updated = await updateStoreCatalogProduct(source.store.id, draft.publicReference, source.user.id, command);
    const submitted = await submitStoreCatalogProduct(source.store.id, draft.publicReference, source.user.id, { operationId: randomUUID(), version: updated.version });
    const replay = await updateStoreCatalogProduct(source.store.id, draft.publicReference, source.user.id, command);
    expect(replay).toMatchObject({ title: command.title, version: submitted.version, status: "SUBMITTED", publicationStatus: "DRAFT" });
    expect(await prisma.catalogAuditHistory.count({ where: { aggregateReference: draft.publicReference, action: "DRAFT_UPDATED" } })).toBe(1);
    await expect(updateStoreCatalogProduct(source.store.id, draft.publicReference, source.user.id, { ...command, title: "Changed facts" })).rejects.toMatchObject({ code: "OPERATION_REPLAY_MISMATCH" });
    await expect(updateStoreCatalogProduct(source.store.id, draft.publicReference, source.user.id, { ...command, operationId: randomUUID() })).rejects.toMatchObject({ code: "CATALOG_VERSION_CONFLICT" });
  });
  it("replays concurrent submission and archive without another case or publication", async () => {
    const source = await foundation(); const draft = await createStoreCatalogListingDraft(source.store.id, source.user.id, source.input);
    const command = { operationId: randomUUID(), version: draft.version };
    const submitted = await Promise.all([submitStoreCatalogProduct(source.store.id, draft.publicReference, source.user.id, command), submitStoreCatalogProduct(source.store.id, draft.publicReference, source.user.id, command)]);
    expect(submitted[0]).toEqual(submitted[1]); expect(submitted[0]).toMatchObject({ status: "SUBMITTED", publicationStatus: "DRAFT", version: command.version + 1 });
    expect(await prisma.catalogModerationCase.count({ where: { productId: submitted[0].id } })).toBe(1);
    const archive = { operationId: randomUUID(), version: submitted[0].version };
    const archived = await Promise.all([archiveStoreCatalogProduct(source.store.id, draft.publicReference, source.user.id, archive), archiveStoreCatalogProduct(source.store.id, draft.publicReference, source.user.id, archive)]);
    expect(archived[0]).toEqual(archived[1]); expect(archived[0]).toMatchObject({ status: "ARCHIVED", publicationStatus: "WITHDRAWN", version: archive.version + 1 });
    expect(await submitStoreCatalogProduct(source.store.id, draft.publicReference, source.user.id, command)).toEqual(archived[0]);
    expect(await prisma.catalogModerationCase.count({ where: { productId: archived[0].id } })).toBe(1);
    expect(await prisma.storeOfferPriceVersion.count({ where: { offer: { productId: archived[0].id }, status: "ACTIVE" } })).toBe(0);
  });
  it("rejects subject reuse, invalid attributes and foreign or global-canonical mutation", async () => {
    const source = await foundation(); const draft = await createStoreCatalogListingDraft(source.store.id, source.user.id, source.input);
    const other = await createStoreCatalogListingDraft(source.store.id, source.user.id, { ...source.input, operationId: randomUUID(), product: { ...source.input.product, title: `Disposable distinct subject ${randomUUID()}` }, storeSku: `DISPOSABLE-${randomUUID()}`, modifiers: [{ ...source.input.modifiers[0], name: `Distinct gift wrap ${randomUUID()}` }] });
    const command = { operationId: randomUUID(), version: draft.version, title: "Disposable subject-bound edit" };
    await updateStoreCatalogProduct(source.store.id, draft.publicReference, source.user.id, command);
    await expect(updateStoreCatalogProduct(source.store.id, other.publicReference, source.user.id, command)).rejects.toMatchObject({ code: "OPERATION_REPLAY_MISMATCH" });
    const invalid = { operationId: randomUUID(), version: other.version, attributeValues: {} };
    await expect(updateStoreCatalogProduct(source.store.id, other.publicReference, source.user.id, invalid)).rejects.toMatchObject({ code: "PRODUCT_ATTRIBUTES_INVALID" });
    expect(await prisma.catalogOperationReceipt.count({ where: { actorUserId: source.user.id, operationId: invalid.operationId } })).toBe(0);
    const foreign = await foundation();
    await expect(updateStoreCatalogProduct(foreign.store.id, other.publicReference, foreign.user.id, { ...command, operationId: randomUUID(), version: other.version })).rejects.toMatchObject({ code: "CATALOG_OWNERSHIP_DENIED" });
    // Synthetic negative source only; it does not approve or publish this product.
    await prisma.catalogProduct.update({ where: { publicReference: other.publicReference }, data: { scope: "GLOBAL_CANONICAL", sourceStoreId: null } });
    for (const action of [submitStoreCatalogProduct, archiveStoreCatalogProduct]) await expect(action(source.store.id, other.publicReference, source.user.id, { operationId: randomUUID(), version: other.version })).rejects.toMatchObject({ code: "CATALOG_OWNERSHIP_DENIED" });
  });
  it("rolls back submission, case, audit and event when the operation receipt cannot commit", async () => {
    const source = await foundation(); const draft = await createStoreCatalogListingDraft(source.store.id, source.user.id, source.input);
    const before = await prisma.catalogProduct.findUniqueOrThrow({ where: { publicReference: draft.publicReference } });
    const command = { operationId: randomUUID(), version: draft.version }; const identifier = `closure_product_${randomUUID().replaceAll("-", "")}`;
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${identifier}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."operationId" = '${command.operationId}' THEN RAISE EXCEPTION 'DISPOSABLE_PRODUCT_RECEIPT_FAILURE'; END IF; RETURN NEW; END $$`);
    try {
      await prisma.$executeRawUnsafe(`CREATE TRIGGER "${identifier}" BEFORE INSERT ON "CatalogOperationReceipt" FOR EACH ROW EXECUTE FUNCTION "${identifier}"()`);
      await expect(submitStoreCatalogProduct(source.store.id, draft.publicReference, source.user.id, command)).rejects.toThrow("DISPOSABLE_PRODUCT_RECEIPT_FAILURE");
      expect(await prisma.catalogProduct.findUniqueOrThrow({ where: { publicReference: draft.publicReference } })).toEqual(before);
      expect(await prisma.catalogModerationCase.count({ where: { productId: before.id } })).toBe(0);
      expect(await prisma.catalogAuditHistory.count({ where: { aggregateReference: draft.publicReference, action: "SUBMITTED" } })).toBe(0);
      expect(await prisma.catalogChangeEvent.count({ where: { aggregateReference: draft.publicReference, aggregateVersion: draft.version + 1 } })).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${identifier}" ON "CatalogOperationReceipt"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${identifier}"()`);
    }
  });
});

describe("canonical catalog moderation transactions on isolated PostgreSQL", { timeout: 20_000 }, () => {
  beforeAll(() => requireDisposableStoreSettlementDatabase());
  it("replays concurrent product decisions with one history, event and receipt", async () => {
    const source = await submittedListing();
    const command = { version: source.product.version, operationId: randomUUID(), reasonCode: "DISPOSABLE_CHANGES", safeNote: "Synthetic review facts; no human approval represented." };
    const results = await Promise.all([moderateCatalogProduct(source.product.id, source.user.id, "REQUEST_CHANGES", command), moderateCatalogProduct(source.product.id, source.user.id, "REQUEST_CHANGES", command)]);
    expect(results[0]).toEqual(results[1]); expect(results[0]).toMatchObject({ status: "NEEDS_CHANGES", version: command.version + 1 });
    expect(await prisma.catalogModerationHistory.count({ where: { moderationCase: { productId: source.product.id } } })).toBe(1);
    expect(await prisma.catalogChangeEvent.count({ where: { aggregateType: "MODERATION", aggregateReference: source.product.publicReference } })).toBe(1);
    expect(await prisma.catalogOperationReceipt.count({ where: { actorUserId: source.user.id, operationId: command.operationId } })).toBe(1);
  });
  it("retains suspension history and returns current state when an earlier approval is retried", async () => {
    const source = await submittedListing(); const command = { version: source.product.version, operationId: randomUUID(), reasonCode: "DISPOSABLE_APPROVAL", safeNote: "Synthetic transaction only." };
    const approved = await moderateCatalogProduct(source.product.id, source.user.id, "APPROVE", command);
    const firstHistory = await prisma.catalogModerationHistory.findFirstOrThrow({ where: { moderationCase: { productId: source.product.id } } });
    const suspended = await moderateCatalogProduct(source.product.id, source.user.id, "SUSPEND", { version: approved.version, operationId: randomUUID(), reasonCode: "DISPOSABLE_SUSPENSION" });
    expect(await moderateCatalogProduct(source.product.id, source.user.id, "APPROVE", command)).toEqual(suspended);
    await expect(moderateCatalogProduct(source.product.id, source.user.id, "APPROVE", { ...command, safeNote: "Changed note" })).rejects.toMatchObject({ code: "OPERATION_REPLAY_MISMATCH" });
    await expect(moderateCatalogProduct(source.product.id, source.user.id, "REQUEST_CHANGES", { ...command, operationId: randomUUID() })).rejects.toMatchObject({ code: "CATALOG_VERSION_CONFLICT" });
    expect(await prisma.catalogModerationHistory.findUniqueOrThrow({ where: { id: firstHistory.id } })).toEqual(firstHistory);
    expect(await prisma.catalogModerationHistory.count({ where: { moderationCase: { productId: source.product.id } } })).toBe(2);
    expect(suspended.publicationStatus).toBe("DRAFT");
  });
  it("commits one of two competing decisions against the same product version", async () => {
    const source = await submittedListing(); const command = { version: source.product.version, reasonCode: "DISPOSABLE_COMPETING" };
    const results = await Promise.allSettled([moderateCatalogProduct(source.product.id, source.user.id, "APPROVE", { ...command, operationId: randomUUID() }), moderateCatalogProduct(source.product.id, source.user.id, "REQUEST_CHANGES", { ...command, operationId: randomUUID() })]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(result => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: "CATALOG_VERSION_CONFLICT" });
    expect(await prisma.catalogModerationHistory.count({ where: { moderationCase: { productId: source.product.id } } })).toBe(1);
    expect(await prisma.catalogOperationReceipt.count({ where: { actorUserId: source.user.id, action: { startsWith: "MODERATION:" } } })).toBe(1);
  });
  it("rolls back product, case, audit and receipt when history insertion fails", async () => {
    const source = await submittedListing();
    const before = await prisma.catalogProduct.findUniqueOrThrow({ where: { id: source.product.id }, include: { moderationCases: true } });
    const identifier = `closure_catalog_${randomUUID().replaceAll("-", "")}`;
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${identifier}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."caseId" = '${before.moderationCases[0].id}' THEN RAISE EXCEPTION 'DISPOSABLE_CATALOG_HISTORY_FAILURE'; END IF; RETURN NEW; END $$`);
    try {
      await prisma.$executeRawUnsafe(`CREATE TRIGGER "${identifier}" BEFORE INSERT ON "CatalogModerationHistory" FOR EACH ROW EXECUTE FUNCTION "${identifier}"()`);
      const command = { version: source.product.version, operationId: randomUUID(), reasonCode: "DISPOSABLE_ROLLBACK" };
      await expect(moderateCatalogProduct(source.product.id, source.user.id, "REQUEST_CHANGES", command)).rejects.toThrow("DISPOSABLE_CATALOG_HISTORY_FAILURE");
      expect(await prisma.catalogProduct.findUniqueOrThrow({ where: { id: source.product.id }, include: { moderationCases: true } })).toEqual(before);
      expect(await prisma.catalogAuditHistory.count({ where: { aggregateType: "MODERATION", aggregateReference: source.product.publicReference } })).toBe(0);
      expect(await prisma.catalogOperationReceipt.count({ where: { actorUserId: source.user.id, operationId: command.operationId } })).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${identifier}" ON "CatalogModerationHistory"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION "${identifier}"()`);
    }
  });
  it("replays offer approval without activating prices or public snapshots", async () => {
    const source = await submittedListing(); const offer = source.draft.offers[0];
    const submitted = await transitionStoreCatalogOffer(source.store.id, offer.publicReference, source.user.id, "SUBMITTED", { version: offer.version, operationId: randomUUID() });
    const command = { version: submitted.version, operationId: randomUUID(), reasonCode: "DISPOSABLE_OFFER_REVIEW" };
    const results = await Promise.all([moderateCatalogOffer(submitted.id, source.user.id, "APPROVE", command), moderateCatalogOffer(submitted.id, source.user.id, "APPROVE", command)]);
    expect(results[0]).toEqual(results[1]); expect(results[0].status).toBe("SUBMITTED"); expect(results[0].approvedByUserId).toBe(source.user.id);
    expect(await prisma.storeOfferPriceVersion.count({ where: { offerId: submitted.id, status: "ACTIVE" } })).toBe(0);
    expect(await prisma.catalogPublicationSnapshot.count({ where: { offerId: submitted.id } })).toBe(0);
    expect(await prisma.catalogModerationHistory.count({ where: { moderationCase: { offerId: submitted.id } } })).toBe(1);
    await expect(moderateCatalogOffer(submitted.id, source.user.id, "APPROVE", { ...command, reasonCode: "DISPOSABLE_CHANGED" })).rejects.toMatchObject({ code: "OPERATION_REPLAY_MISMATCH" });
  });
  it("rejects operation identity reuse on a different catalog subject", async () => {
    const first = await submittedListing(); const second = await submittedListing();
    const command = { version: first.product.version, operationId: randomUUID(), reasonCode: "DISPOSABLE_IDENTITY" };
    await moderateCatalogProduct(first.product.id, first.user.id, "REQUEST_CHANGES", command);
    await expect(moderateCatalogProduct(second.product.id, first.user.id, "REQUEST_CHANGES", { ...command, version: second.product.version })).rejects.toMatchObject({ code: "OPERATION_REPLAY_MISMATCH" });
    expect((await prisma.catalogProduct.findUniqueOrThrow({ where: { id: second.product.id } })).status).toBe("SUBMITTED");
    expect(await prisma.catalogModerationHistory.count({ where: { moderationCase: { productId: second.product.id } } })).toBe(0);
  });
});
describe("atomic canonical catalog listing drafts on isolated PostgreSQL", { timeout: 20_000 }, () => {
  beforeAll(() => requireDisposableStoreSettlementDatabase());
  it("persists each listing fact through canonical commands without publishing or reserving stock", async () => {
    const source = await foundation();
    const product = await createStoreCatalogListingDraft(source.store.id, source.user.id, source.input);
    expect(product.status).toBe("DRAFT"); expect(product.variants.map(row => row.title).sort()).toEqual(["Default"]);
    expect(product.offers).toHaveLength(1); const offer = product.offers[0];
    expect(offer).toMatchObject({ storeSku: source.input.storeSku!.toUpperCase(), status: "DRAFT", priceVersions: [{ amount: expect.anything(), currency: "ZAR", status: "DRAFT" }], inventoryItem: { levels: [{ onHand: 7, reserved: 0, available: 7 }] }, modifierGroups: [{ group: { name: "Gift wrap" } }] });
    expect(offer.priceVersions[0].amount.toFixed(2)).toBe("19.25");
    const canonical = await prisma.catalogProduct.findUniqueOrThrow({ where: { publicReference: product.publicReference }, include: { media: true } });
    expect(canonical.media).toMatchObject([{ assetId: source.asset.id, altText: "Disposable cotton product", role: "PRIMARY" }]);
    expect(canonical.publicationStatus).toBe("DRAFT");
    expect(await prisma.catalogPublicationSnapshot.count({ where: { productId: canonical.id } })).toBe(0);
    expect(await counts(source.store.id)).toMatchObject({ products: 1, offers: 1, groups: 1 });
    expect(JSON.stringify(product)).not.toContain(source.asset.storageKey);
    const ownerRead = await getStoreCatalogProduct(source.store.id, product.publicReference);
    expect(ownerRead.media[0].asset).toMatchObject({ publicReference: source.asset.publicReference, status: "READY", width: 100, height: 100 });
    for (const field of ["storageKey", "storageProvider", "createdByUserId", "checksum"]) expect(ownerRead.media[0].asset).not.toHaveProperty(field);
    expect(JSON.stringify(ownerRead)).not.toContain(source.asset.storageKey);
  });
  it("serializes concurrent retries and rejects changed facts without extra records", async () => {
    const source = await foundation();
    const products = await Promise.all([createStoreCatalogListingDraft(source.store.id, source.user.id, source.input), createStoreCatalogListingDraft(source.store.id, source.user.id, source.input)]);
    expect(products[0]).toEqual(products[1]); const before = await counts(source.store.id);
    await expect(createStoreCatalogListingDraft(source.store.id, source.user.id, { ...source.input, openingStock: 9 })).rejects.toMatchObject({ code: "OPERATION_REPLAY_MISMATCH" });
    expect(await counts(source.store.id)).toEqual(before);
    expect(await prisma.catalogInventoryMovement.count({ where: { inventoryItem: { offer: { storeId: source.store.id } } } })).toBe(1);
  });
  it("persists independently sellable options and replays without cloning price, stock or modifiers", async () => {
    const source = await foundation();
    const input: CatalogListingDraftInput = { ...source.input, storeSku: undefined, price: undefined, openingStock: undefined, variants: [
      { title: "Blue small", options: [{ code: "colour", value: "Blue" }, { code: "size", value: "Small" }], attributeValues: {}, storeSku: `BLUE-${source.input.operationId}`, price: { ...source.input.price!, amount: "19.25" }, openingStock: 3 },
      { title: "Red large", options: [{ code: "colour", value: "Red" }, { code: "size", value: "Large" }], attributeValues: {}, storeSku: `RED-${source.input.operationId}`, price: { ...source.input.price!, amount: "27.50" }, openingStock: 8 },
    ] };
    const results = await Promise.all([createStoreCatalogListingDraft(source.store.id, source.user.id, input), createStoreCatalogListingDraft(source.store.id, source.user.id, input)]);
    expect(results[0]).toEqual(results[1]); const draft = results[0];
    expect(draft.variants.map(variant => variant.title).sort()).toEqual(["Blue small", "Red large"]);
    expect(draft.offers).toHaveLength(2);
    const canonical = await prisma.catalogProduct.findUniqueOrThrow({ where: { publicReference: draft.publicReference }, include: {
      options: { include: { values: true } }, variants: { include: { optionValues: { include: { optionValue: { include: { option: true } } } } } },
      offers: { include: { variant: true, priceVersions: true, inventoryItem: { include: { levels: true } }, modifierGroups: true } },
    } });
    expect(canonical.options.map(option => option.code).sort()).toEqual(["colour", "size"]);
    expect(canonical.options.flatMap(option => option.values)).toHaveLength(4);
    for (const expected of input.variants) {
      const variant = canonical.variants.find(item => item.title === expected.title)!;
      expect(Object.fromEntries(variant.optionValues.map(link => [link.optionValue.option.code, link.optionValue.label]))).toEqual(Object.fromEntries(expected.options.map(option => [option.code, option.value])));
      const offer = canonical.offers.find(item => item.variantId === variant.id)!;
      expect(offer.storeSku).toBe(expected.storeSku.toUpperCase());
      expect(offer.priceVersions).toHaveLength(1); expect(offer.priceVersions[0].amount.toFixed(2)).toBe(expected.price.amount);
      expect(offer.inventoryItem?.levels).toMatchObject([{ onHand: expected.openingStock, available: expected.openingStock, reserved: 0 }]);
      expect(offer.modifierGroups).toHaveLength(1);
    }
    expect(await counts(source.store.id)).toMatchObject({ products: 1, offers: 2, groups: 1 });
    expect(await prisma.catalogInventoryMovement.count({ where: { inventoryItem: { offer: { storeId: source.store.id } } } })).toBe(2);
    await expect(createStoreCatalogListingDraft(source.store.id, source.user.id, { ...input, variants: [{ ...input.variants[0], openingStock: 4 }, input.variants[1]] })).rejects.toMatchObject({ code: "OPERATION_REPLAY_MISMATCH" });

    // Synthetic separate reviewer exercises publication authority; no human
    // approval or external storage certification is represented by this fixture.
    const reviewer = await prisma.user.create({ data: { email: `variant-review-${randomUUID()}@example.test`, role: "ADMIN", status: "ACTIVE" } });
    await prisma.productTypeDefinition.update({ where: { id: source.definition.id }, data: { status: "ACTIVE" } });
    const submitted = await submitStoreCatalogProduct(source.store.id, draft.publicReference, source.user.id, { version: draft.version, operationId: randomUUID() });
    await moderateCatalogProduct(submitted.id, reviewer.id, "APPROVE", { version: submitted.version, operationId: randomUUID(), reasonCode: "DISPOSABLE_VARIANT_REVIEW" });
    for (const offer of draft.offers) {
      const submittedOffer = await transitionStoreCatalogOffer(source.store.id, offer.publicReference, source.user.id, "SUBMITTED", { version: offer.version, operationId: randomUUID() });
      const reviewed = await moderateCatalogOffer(submittedOffer.id, reviewer.id, "APPROVE", { version: submittedOffer.version, operationId: randomUUID(), reasonCode: "DISPOSABLE_VARIANT_REVIEW" });
      const currentProduct = await prisma.catalogProduct.findUniqueOrThrow({ where: { id: submitted.id } });
      await publishApprovedCatalogListing(reviewed.id, reviewer.id, { operationId: randomUUID(), version: reviewed.version, productVersion: currentProduct.version, priceVersionReference: offer.priceVersions[0].publicReference, reasonCode: "DISPOSABLE_VARIANT_PUBLICATION" });
    }
    const published = await prisma.storefrontProductDocument.findMany({ where: { productId: submitted.id, status: "ACTIVE" } });
    expect(published).toHaveLength(2);
    expect(published.map(item => item.variantOptions)).toEqual(expect.arrayContaining([{ colour: "Blue", size: "Small" }, { colour: "Red", size: "Large" }]));
    expect(published.map(item => item.priceAmount.toFixed(2)).sort()).toEqual(["19.25", "27.50"]);
  });
  it("rejects incomplete custom variants and rolls back every variant when a later SKU conflicts", async () => {
    const source = await foundation(); const original = await createStoreCatalogListingDraft(source.store.id, source.user.id, source.input);
    const before = await counts(source.store.id);
    const custom = { ...source.input, operationId: randomUUID(), variants: [
      { title: "Blue", options: [{ code: "colour", value: "Blue" }], attributeValues: {}, storeSku: `NEW-${randomUUID()}`, price: source.input.price!, openingStock: 3 },
      { title: "Red", options: [{ code: "colour", value: "Red" }], attributeValues: {}, storeSku: source.input.storeSku!, price: source.input.price!, openingStock: 8 },
    ] };
    await expect(createStoreCatalogListingDraft(source.store.id, source.user.id, custom)).rejects.toMatchObject({ code: "P2002" });
    expect(await counts(source.store.id)).toEqual(before);
    expect(await prisma.catalogProductOption.count({ where: { product: { sourceStoreId: source.store.id } } })).toBe(0);
    await expect(createStoreCatalogListingDraft(source.store.id, source.user.id, { ...custom, variants: [{ ...custom.variants[0], price: undefined }] } as never)).rejects.toMatchObject({ code: "LISTING_DRAFT_INVALID" });
    expect(await counts(source.store.id)).toEqual(before);
    expect(await createStoreCatalogListingDraft(source.store.id, source.user.id, source.input)).toEqual(original);
  });
  it("rolls back every listing write when a foreign READY image is supplied", async () => {
    const source = await foundation(); const foreign = await foundation(); const before = await counts(source.store.id);
    await expect(createStoreCatalogListingDraft(source.store.id, source.user.id, { ...source.input, media: [{ ...source.input.media[0], assetPublicReference: foreign.asset.publicReference }] })).rejects.toMatchObject({ code: "CATALOG_OWNERSHIP_DENIED" });
    expect(await counts(source.store.id)).toEqual(before);
    expect(await prisma.catalogInventoryLevel.count({ where: { inventoryItem: { offer: { storeId: source.store.id } } } })).toBe(0);
    expect(await counts(foreign.store.id)).toEqual({ products: 0, offers: 0, groups: 0, receipts: 0 });
  });
  it("refuses unavailable or foreign inventory locations and invalid attributes before committing", async () => {
    const source = await foundation(); const foreign = await foundation();
    for (const inventoryLocationPublicReference of [foreign.location.publicReference, "IL-MISSING"]) await expect(createStoreCatalogListingDraft(source.store.id, source.user.id, { ...source.input, inventoryLocationPublicReference })).rejects.toMatchObject({ code: "CATALOG_OWNERSHIP_DENIED" });
    await expect(createStoreCatalogListingDraft(source.store.id, source.user.id, { ...source.input, product: { ...source.input.product, attributeValues: {} } })).rejects.toMatchObject({ code: "PRODUCT_ATTRIBUTES_INVALID" });
    expect(await counts(source.store.id)).toEqual({ products: 0, offers: 0, groups: 0, receipts: 0 });
  });
  it("rolls back duplicate SKU attempts while preserving the original product and stock", async () => {
    const source = await foundation(); const original = await createStoreCatalogListingDraft(source.store.id, source.user.id, source.input); const before = await counts(source.store.id);
    await expect(createStoreCatalogListingDraft(source.store.id, source.user.id, { ...source.input, operationId: randomUUID() })).rejects.toMatchObject({ code: "P2002" });
    expect(await counts(source.store.id)).toEqual(before);
    expect(await createStoreCatalogListingDraft(source.store.id, source.user.id, source.input)).toEqual(original);
  });
  it("keeps another store's private identities out of duplicate suggestions", async () => {
    const source = await foundation(); const foreign = await foundation();
    const own = await createStoreCatalogListingDraft(source.store.id, source.user.id, source.input);
    await createStoreCatalogListingDraft(foreign.store.id, foreign.user.id, { ...foreign.input, product: { ...foreign.input.product, productTypeDefinitionId: source.definition.id, title: source.input.product.title } });
    const suggestions = await searchCatalogDuplicates({ storeId: source.store.id, title: source.input.product.title, productTypeCode: source.definition.code });
    expect(suggestions).toEqual([{ publicReference: own.publicReference, title: source.input.product.title, reason: "NORMALIZED_TITLE", confidenceBand: "MEDIUM" }]);
    expect(suggestions[0]).not.toHaveProperty("candidateProductId");
  });
});
