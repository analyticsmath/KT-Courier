import { beforeEach, expect, it, vi } from "vitest";
import { catalogRequestHash } from "@/lib/catalog/catalog-normalization";
const m = vi.hoisted(() => ({ current: { id: "offer", publicReference: "CO-test", status: "PAUSED", publicationStatus: "PUBLISHED", version: 4, priceVersions: [] }, receipt: null as unknown, update: vi.fn(), evidence: vi.fn(), snapshot: vi.fn(), project: vi.fn(), withdraw: vi.fn() }));
vi.mock("@/lib/services/storefront-projection.service", () => ({ StorefrontProjectionService: class { buildPublishedSnapshot = m.project; withdrawOffer = m.withdraw; } }));
vi.mock("@/lib/services/catalog-service-support", () => ({ recordCatalogEvidence: m.evidence, withCatalogTransaction: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: async (run: (tx: unknown) => unknown) => run({ $queryRaw: vi.fn(), storeCatalogOffer: { findFirst: async () => m.current, updateMany: m.update, findUniqueOrThrow: async () => ({ ...m.current, status: "ACTIVE", version: 5 }) }, catalogOperationReceipt: { findUnique: async () => m.receipt }, catalogPublicationSnapshot: { findFirst: m.snapshot } }) } }));
import { transitionStoreCatalogOffer } from "@/lib/services/store-offer.service";
const input = { version: 4, operationId: "test-operation" };
beforeEach(() => { m.current = { id: "offer", publicReference: "CO-test", status: "PAUSED", publicationStatus: "PUBLISHED", version: 4, priceVersions: [] }; m.receipt = null; m.update.mockResolvedValue({ count: 1 }); m.snapshot.mockResolvedValue({ publicReference: "CPS-approved" }); });
it("resumes only the paused state while preserving publication and recording evidence", async () => {
  await expect(transitionStoreCatalogOffer("store", "CO-test", "owner", "ACTIVE", input)).resolves.toMatchObject({ status: "ACTIVE" });
  expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "offer", storeId: "store", version: 4, status: "PAUSED" }, data: expect.objectContaining({ status: "ACTIVE", publicationStatus: "PUBLISHED" }) }));
  expect(m.evidence).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "ACTIVE", actorUserId: "owner", aggregateVersion: 5 }));
  expect(m.project).toHaveBeenCalledWith("CPS-approved");
});
it.each(["DRAFT", "SUBMITTED", "SUSPENDED", "NEEDS_CHANGES", "OUT_OF_STOCK", "ARCHIVED"])("does not let resume bypass review from %s", async status => {
  m.current.status = status;
  await expect(transitionStoreCatalogOffer("store", "CO-test", "owner", "ACTIVE", input)).rejects.toMatchObject({ code: "OFFER_NOT_PAUSED" });
  expect(m.update).not.toHaveBeenCalled();
});
it("rejects stale versions before changing a listing", async () => {
  m.current.version = 5;
  await expect(transitionStoreCatalogOffer("store", "CO-test", "owner", "ACTIVE", input)).rejects.toMatchObject({ code: "CATALOG_VERSION_CONFLICT" });
  expect(m.update).not.toHaveBeenCalled();
});
it("replays a confirmed resume without a second state change", async () => {
  m.current.status = "ACTIVE"; m.current.version = 5;
  m.receipt = { storeId: "store", aggregateReference: "CO-test", requestHash: catalogRequestHash({ ...input, toStatus: "ACTIVE" }) };
  await transitionStoreCatalogOffer("store", "CO-test", "owner", "ACTIVE", input);
  expect(m.update).not.toHaveBeenCalled(); expect(m.evidence).not.toHaveBeenCalled();
});
it("refuses to resume a published listing without its approved publication snapshot", async () => {
  m.snapshot.mockResolvedValue(null);
  await expect(transitionStoreCatalogOffer("store", "CO-test", "owner", "ACTIVE", input)).rejects.toMatchObject({ code: "OFFER_PUBLICATION_EVIDENCE_MISSING" });
  expect(m.evidence).not.toHaveBeenCalled(); expect(m.project).not.toHaveBeenCalled();
});
it("withdraws the public projection when an active offer is paused", async () => {
  m.current.status = "ACTIVE";
  await transitionStoreCatalogOffer("store", "CO-test", "owner", "PAUSED", input);
  expect(m.withdraw).toHaveBeenCalledWith("CO-test");
});
