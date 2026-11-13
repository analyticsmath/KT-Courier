import { expect, it, vi } from "vitest";
const select = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/prisma", () => ({ prisma: { advertisingMeasurementEvent: { findMany: select } } }));
import { runAdvertisingClickBatch } from "@/lib/advertising/click-charge-batch";
it("blocks charging before candidate selection without production authorization", async () => {
  await expect(runAdvertisingClickBatch({ apply: true })).rejects.toMatchObject({ code: "CONSOLIDATED_VALIDATION_NOT_APPROVED" });
  expect(select).not.toHaveBeenCalled();
});
