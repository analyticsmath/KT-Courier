import { expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), gate: vi.fn() }));
vi.mock("@/lib/promotions/production-lock", () => ({ assertPromotionsProductionReady: mock.gate }));
vi.mock("@/lib/client-platform/promotion-authoring.service", () => ({ createBusinessPromotion: mock.create, updateBusinessPromotion: mock.update }));
import { createPromotionCampaign, updatePromotionCampaign } from "@/lib/promotions/promotion-campaign.service";

it("creates and updates through the authenticated merchant authoring service", async () => {
  mock.create.mockResolvedValueOnce({ reference: "campaign" });
  mock.update.mockResolvedValueOnce({ reference: "campaign", revision: 2 });
  await expect(createPromotionCampaign({ actorUserId: "owner", draft: { name: "sale" } })).resolves.toEqual({ reference: "campaign" });
  await expect(updatePromotionCampaign({ actorUserId: "owner", reference: "campaign", draft: { expectedRevision: 1 } })).resolves.toEqual({ reference: "campaign", revision: 2 });
  expect(mock.create).toHaveBeenCalledWith("owner", { name: "sale" });
  expect(mock.update).toHaveBeenCalledWith("owner", "campaign", { expectedRevision: 1 });
  expect(mock.gate).toHaveBeenCalledWith("CAMPAIGN_CREATE");
  expect(mock.gate).toHaveBeenCalledWith("CAMPAIGN_UPDATE");
});
