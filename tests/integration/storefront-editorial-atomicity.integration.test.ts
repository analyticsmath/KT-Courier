import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { StorefrontCollectionService } from "@/lib/services/storefront-collection.service";
import { StorefrontSynonymService } from "@/lib/services/storefront-synonym.service";

describe("canonical editorial transactions on disposable PostgreSQL", () => {
  const prefix = `editorial-${randomUUID()}`;
  const collections = new StorefrontCollectionService(); const synonyms = new StorefrontSynonymService();
  let author = ""; let reviewer = "";
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent");
    if (process.env.NODE_ENV === "production" || process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS !== "1" || url.pathname !== "/kt_launch_test" || !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Disposable closure database required.");
    for (const role of ["author", "reviewer"]) {
      const user = await prisma.user.create({ data: { email: `${prefix}-${role}@example.test`, role: "SUPER_ADMIN", status: "ACTIVE" } });
      if (role === "author") author = user.id; else reviewer = user.id;
    }
  });
  const operation = (version: number, actorUserId = author) => ({ version, actorUserId, operationId: `${prefix}-${randomUUID()}` });
  const createCollection = () => collections.create({ name: prefix, slug: `${prefix}-${randomUUID()}`, collectionType: "EDITORIAL", actorUserId: author, operationId: `${prefix}-${randomUUID()}` });
  const createItem = (collectionId: string, displayOrder = 0) => prisma.storefrontCollectionItem.create({ data: { collectionId, targetType: "PRODUCT", targetReference: `CP-${randomUUID()}`, sourceVersion: "disposable-historical-v1", displayOrder } });

  it("collection transitions return their newly committed state and exact version", async () => {
    let record = await createCollection();
    for (const [action, status] of [["submit", "UNDER_REVIEW"], ["approve", "APPROVED"]] as const) {
      const previousVersion = record.version;
      record = await collections.transition(record.publicReference, action, operation(record.version, action === "approve" ? reviewer : author));
      expect(record).toMatchObject({ status, version: previousVersion + 1 });
      expect(await prisma.storefrontCollection.findUniqueOrThrow({ where: { id: record.id } })).toMatchObject({ status: record.status, version: record.version });
    }
    expect(await prisma.storefrontCollectionLifecycleHistory.count({ where: { collectionId: record.id } })).toBe(3);
  });
  it("synonym submit, review, activation and retirement return current canonical versions", async () => {
    let record = await synonyms.create({ name: `${prefix}-synonyms`, language: "en-ZA", terms: [{ input: "test smartphone", outputs: ["test phone"], direction: "EQUIVALENT" }], actorUserId: author, operationId: `${prefix}-synonym-create` });
    for (const [action, status] of [["submit", "UNDER_REVIEW"], ["approve", "APPROVED"], ["activate", "ACTIVE"], ["retire", "RETIRED"]] as const) {
      const previousVersion = record.version;
      record = await synonyms.transition(record.publicReference, action, operation(record.version, action === "approve" ? reviewer : author));
      expect(record).toMatchObject({ status, version: previousVersion + 1 });
      expect(await prisma.storefrontSearchSynonymSet.findUniqueOrThrow({ where: { id: record.id } })).toMatchObject({ status: record.status, version: record.version });
    }
    expect(await prisma.storefrontSearchSynonymHistory.count({ where: { synonymSetId: record.id } })).toBe(5);
  });
  it("failed collection version write rolls back its item removal tombstone", async () => {
    const collection = await createCollection(); const item = await createItem(collection.id);
    const before = await prisma.storefrontCollection.findUniqueOrThrow({ where: { id: collection.id } });
    const identifier = `closure_editorial_${randomUUID().replaceAll("-", "")}`;
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${identifier}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.id = '${collection.id}' THEN RAISE EXCEPTION 'DISPOSABLE_EDITORIAL_WRITE_FAILURE'; END IF; RETURN NEW; END $$`);
    try {
      await prisma.$executeRawUnsafe(`CREATE TRIGGER "${identifier}" BEFORE UPDATE ON "StorefrontCollection" FOR EACH ROW EXECUTE FUNCTION "${identifier}"()`);
      await expect(collections.removeItem(collection.publicReference, item.id, operation(collection.version))).rejects.toThrow("DISPOSABLE_EDITORIAL_WRITE_FAILURE");
      expect(await prisma.storefrontCollectionItem.findUniqueOrThrow({ where: { id: item.id } })).toEqual(item);
      expect(await prisma.storefrontCollection.findUniqueOrThrow({ where: { id: collection.id } })).toEqual(before);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${identifier}" ON "StorefrontCollection"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION "${identifier}"()`);
    }
  });
  it("concurrent removals commit one version and preserve the losing writer's item", async () => {
    const collection = await createCollection(); const items = await Promise.all([createItem(collection.id), createItem(collection.id, 1)]);
    const results = await Promise.allSettled(items.map(item => collections.removeItem(collection.publicReference, item.id, operation(collection.version))));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const loser = results.find(result => result.status === "rejected") as PromiseRejectedResult;
    expect(loser.reason).toMatchObject({ code: "COLLECTION_VERSION_CONFLICT" });
    const rows = await prisma.storefrontCollectionItem.findMany({ where: { collectionId: collection.id } });
    expect(rows).toHaveLength(2); expect(rows.filter(row => row.removedAt)).toHaveLength(1);
    const losingItem = items[results.findIndex(result => result.status === "rejected")];
    expect(rows.find(row => row.id === losingItem.id)).toMatchObject({ removedAt: null, removedByUserId: null });
    expect(await prisma.storefrontCollection.findUniqueOrThrow({ where: { id: collection.id } })).toMatchObject({ version: collection.version + 1, status: "DRAFT" });
  });
  it("historical removed items cannot qualify an otherwise empty collection for activation", async () => {
    let record = await createCollection(); const item = await createItem(record.id);
    await collections.removeItem(record.publicReference, item.id, operation(record.version));
    record = (await collections.get(record.publicReference))!;
    record = await collections.transition(record.publicReference, "submit", operation(record.version));
    record = await collections.transition(record.publicReference, "approve", operation(record.version, reviewer));
    const count = await prisma.storefrontCollectionLifecycleHistory.count({ where: { collectionId: record.id } });
    await expect(collections.transition(record.publicReference, "activate", operation(record.version))).rejects.toMatchObject({ code: "COLLECTION_NOT_ACTIVATABLE" });
    expect(await prisma.storefrontCollection.findUniqueOrThrow({ where: { id: record.id } })).toMatchObject({ version: record.version, status: "APPROVED" });
    expect(await prisma.storefrontCollectionLifecycleHistory.count({ where: { collectionId: record.id } })).toBe(count);
    expect(await prisma.storefrontCollectionItem.findUniqueOrThrow({ where: { id: item.id } })).toHaveProperty("removedAt", expect.any(Date));
  });
  // Test-owned lifecycle history is retained until this disposable database is destroyed.
});
