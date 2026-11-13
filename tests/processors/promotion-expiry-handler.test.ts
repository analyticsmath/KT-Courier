import { expect, it, vi } from "vitest";

const run = vi.hoisted(() => vi.fn());
const reservations = vi.hoisted(() => vi.fn());
vi.mock("@/lib/promotions/promotion-expiry-batch", () => ({ expirePromotionCampaigns: run }));
vi.mock("@/lib/promotions/promotion-reservation-expiry-batch", () => ({ expirePromotionReservations: reservations }));
import { PROCESSOR_HANDLERS, type ProcessorHandler } from "@/lib/processors/processor-service";

it("routes a dry-run through the bounded promotion expiry service", async () => {
  run.mockResolvedValueOnce({ examined: 2, ended: 0, skipped: 0, failed: 0 });
  reservations.mockResolvedValueOnce({ examined: 1, released: 0, skipped: 0, failed: 0 });
  const handler = (PROCESSOR_HANDLERS as Record<string, ProcessorHandler>)["end-expired-promotions"];
  const result = await handler({ mode: "DRY_RUN", batchSize: 12, operationId: "test" });
  expect(run).toHaveBeenCalledWith({ limit: 12, apply: false });
  expect(reservations).toHaveBeenCalledWith({ limit: 12, apply: false });
  expect(result).toMatchObject({ itemsExamined: 3, itemsCompleted: 0 });
});

it("processes expired reservations in the guarded lifecycle run", async () => {
  run.mockResolvedValueOnce({ examined: 0, ended: 0, skipped: 0, failed: 0 });
  reservations.mockResolvedValueOnce({ examined: 1, released: 1, skipped: 0, failed: 0 });
  const handler = (PROCESSOR_HANDLERS as Record<string, ProcessorHandler>)["end-expired-promotions"];
  expect(await handler({ mode: "APPLY", batchSize: 12, operationId: "test" })).toMatchObject({ itemsCompleted: 1 });
});

it("fails the processor run when an item requires retry", async () => {
  run.mockResolvedValueOnce({ examined: 2, ended: 1, skipped: 0, failed: 1 });
  const handler = (PROCESSOR_HANDLERS as Record<string, ProcessorHandler>)["end-expired-promotions"];
  await expect(handler({ mode: "APPLY", batchSize: 12, operationId: "test" })).rejects.toThrow("Promotion expiry failed");
  expect(run).toHaveBeenCalledWith({ limit: 12, apply: true });
});
