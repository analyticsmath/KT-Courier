import { expect, test, vi } from "vitest";
const dependencies = vi.hoisted(() => ({ events: vi.fn(), eventUpdate: vi.fn(), processingFindMany: vi.fn(), processingCreate: vi.fn(), snapshots: vi.fn(), snapshotFind: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { catalogChangeEvent: { findMany: dependencies.events, update: dependencies.eventUpdate }, catalogPublicationSnapshot: { findMany: dependencies.snapshots, findUnique: dependencies.snapshotFind }, storefrontEventProcessing: { findMany: dependencies.processingFindMany, create: dependencies.processingCreate } } }));
vi.mock("@/lib/services/storefront-store.service", () => ({ rebuildStorefrontStoreDocument: vi.fn() }));
vi.mock("@/lib/services/storefront-category.service", () => ({ rebuildStorefrontCategoryDocument: vi.fn() }));
import { StorefrontEventConsumerService } from "@/lib/services/storefront-event-consumer.service";
test("paused published offers are withdrawn and acknowledged instead of retried as projection errors", async () => {
  dependencies.events.mockResolvedValue([{ id: "paused", publicReference: "CCE-pause", aggregateType: "OFFER", aggregateReference: "CO-1", aggregateVersion: 2 }]);
  dependencies.processingFindMany.mockResolvedValue([]); dependencies.snapshots.mockResolvedValue([{ publicReference: "CPS-1" }]);
  dependencies.snapshotFind.mockResolvedValue({ offer: { publicReference: "CO-1", status: "PAUSED", publicationStatus: "PUBLISHED", storeId: "store", store: { status: "ACTIVE" }, product: { primaryCategoryId: "category" } } });
  const buildPublishedSnapshot = vi.fn(), withdrawOffer = vi.fn();
  await expect(new StorefrontEventConsumerService({ buildPublishedSnapshot, withdrawOffer } as never).consumePending()).resolves.toEqual({ processed: 1, failed: 0 });
  expect(withdrawOffer).toHaveBeenCalledWith("CO-1"); expect(buildPublishedSnapshot).not.toHaveBeenCalled();
  expect(dependencies.processingCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PROCESSED" }) }));
});
test("event consumer writes mocked processing evidence before marking catalog event processed", async () => { dependencies.events.mockResolvedValue([{ id: "event", publicReference: "CCE-1", aggregateType: "SNAPSHOT", aggregateReference: "CPS-1", aggregateVersion: 1, createdAt: new Date() }]); dependencies.processingFindMany.mockResolvedValue([]); dependencies.snapshotFind.mockResolvedValue({ offer: { publicReference: "CO-1", status: "ACTIVE", publicationStatus: "PUBLISHED", store: { status: "ACTIVE" }, storeId: "store", product: { primaryCategoryId: "category" } } }); const buildPublishedSnapshot = vi.fn().mockResolvedValue({}); await new StorefrontEventConsumerService({ buildPublishedSnapshot } as never).consumePending(); expect(dependencies.processingCreate).toHaveBeenCalledBefore(dependencies.eventUpdate); });
