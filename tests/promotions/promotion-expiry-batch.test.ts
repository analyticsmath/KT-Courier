import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ findMany: vi.fn(), updateVersion: vi.fn(), updateCampaign: vi.fn(), history: vi.fn(), event: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { promotionCampaignVersion: { findMany: mock.findMany }, $transaction: mock.transaction } }));
vi.mock("@/lib/promotions/production-lock", () => ({ assertPromotionsProductionReady: vi.fn() }));
import { expirePromotionCampaigns } from "@/lib/promotions/promotion-expiry-batch";

beforeEach(() => {
  vi.clearAllMocks();
  mock.findMany.mockResolvedValue([{ id: "version", campaignId: "campaign", status: "ACTIVE" }]);
  mock.updateVersion.mockResolvedValue({ count: 1 });
  mock.updateCampaign.mockResolvedValue({ count: 1 });
  mock.history.mockResolvedValue({}); mock.event.mockResolvedValue({});
  mock.transaction.mockImplementation(async (work) => work({ promotionCampaignVersion: { updateMany: mock.updateVersion }, promotionCampaign: { updateMany: mock.updateCampaign }, promotionStatusHistory: { create: mock.history }, promotionEventIntent: { create: mock.event } }));
});

it("dry-runs a bounded selection without mutations", async () => {
  const now = new Date("2026-11-13T00:00:00Z");
  expect(await expirePromotionCampaigns({ now, limit: 10, apply: false })).toMatchObject({ examined: 1, ended: 0 });
  expect(mock.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10, where: expect.objectContaining({ endsAt: { lte: now } }) }));
  expect(mock.transaction).not.toHaveBeenCalled();
});

it("records one transition and outbox event when a due version is claimed", async () => {
  const result = await expirePromotionCampaigns({ now: new Date("2026-11-13T00:00:00Z"), limit: 10, apply: true });
  expect(result).toMatchObject({ examined: 1, ended: 1 });
  expect(mock.history).toHaveBeenCalledOnce();
  expect(mock.event).toHaveBeenCalledOnce();
  expect(mock.updateCampaign).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ versions: { none: { status: { in: ["ACTIVE", "PAUSED"] } } } }) }));
});

it("does not emit a second transition after another worker claimed it", async () => {
  mock.updateVersion.mockResolvedValue({ count: 0 });
  expect(await expirePromotionCampaigns({ limit: 10, apply: true })).toMatchObject({ ended: 0, skipped: 1 });
  expect(mock.history).not.toHaveBeenCalled();
  expect(mock.event).not.toHaveBeenCalled();
});
