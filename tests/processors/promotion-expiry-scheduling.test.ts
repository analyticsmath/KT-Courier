import { expect, it, vi } from "vitest";
import { hasEnabledPromotionExpiryWork } from "@/lib/processors/production-loop";

it("requires both the explicit switch and promotion authority before querying work", async () => {
  const hasPending = vi.fn(async () => true);
  expect(await hasEnabledPromotionExpiryWork({ enabled: true, approved: false, hasPending })).toBe(false);
  expect(await hasEnabledPromotionExpiryWork({ enabled: false, approved: true, hasPending })).toBe(false);
  expect(hasPending).not.toHaveBeenCalled();
  expect(await hasEnabledPromotionExpiryWork({ enabled: true, approved: true, hasPending })).toBe(true);
});
