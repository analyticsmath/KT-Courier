import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ setting: vi.fn(), save: vi.fn(), orders: vi.fn(), stores: vi.fn(), drivers: vi.fn(), store: vi.fn(), driver: vi.fn(), produce: vi.fn(), clearance: vi.fn(), releaseStore: vi.fn(), releaseDriver: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { systemSetting: { findUnique: mocks.setting, upsert: mocks.save }, order: { findMany: mocks.orders }, storeEarning: { findMany: mocks.stores, findUnique: mocks.store }, driverEarning: { findMany: mocks.drivers, findUnique: mocks.driver } } }));
vi.mock("@/lib/services/driver-settlement-producer.service", () => ({ produceDriverSettlement: mocks.produce }));
vi.mock("@/lib/services/earning-clearance-batch.service", () => ({ assignEarningClearance: mocks.clearance }));
vi.mock("@/lib/services/store-earning-release.service", () => ({ releaseStoreEarning: mocks.releaseStore }));
vi.mock("@/lib/services/driver-earning-release.service", () => ({ releaseDriverEarning: mocks.releaseDriver }));
import { runEarningLifecycleBatch } from "@/lib/services/earning-lifecycle-batch.service";
import { DriverEarningError } from "@/lib/driver-earnings/errors";

beforeEach(() => {
  vi.resetAllMocks(); mocks.setting.mockResolvedValue(null);
  mocks.orders.mockResolvedValue([{ id: "order-1" }]); mocks.stores.mockResolvedValue([{ id: "store-1" }]); mocks.drivers.mockResolvedValue([{ id: "driver-1" }]);
  mocks.clearance.mockResolvedValue(false);
  mocks.store.mockResolvedValue({ status: "ACCRUED", releaseEligibleAt: null });
  mocks.driver.mockResolvedValue({ status: "ACCRUED", releaseEligibleAt: null });
});
describe("automatic earning lifecycle composition", () => {
  it("dry run inspects all phases without accrual, clearance, release or cursor writes", async () => {
    expect(await runEarningLifecycleBatch({ mode: "DRY_RUN", batchSize: 5 })).toMatchObject({ itemsExamined: 3, itemsClaimed: 0, itemsSkipped: 3 });
    for (const fn of [mocks.produce, mocks.clearance, mocks.releaseStore, mocks.releaseDriver, mocks.save]) expect(fn).not.toHaveBeenCalled();
  });
  it("leaves earnings held when the canonical clearance authority has no eligible policy or delivery proof", async () => {
    expect(await runEarningLifecycleBatch({ mode: "APPLY", batchSize: 5 })).toMatchObject({ itemsCompleted: 1, itemsSkipped: 2, itemsRetried: 0 });
    expect(mocks.produce).toHaveBeenCalledWith("order-1");
    expect(mocks.clearance).toHaveBeenCalledWith("STORE", "store-1", expect.any(Date));
    expect(mocks.clearance).toHaveBeenCalledWith("DRIVER", "driver-1", expect.any(Date));
    expect(mocks.releaseStore).not.toHaveBeenCalled(); expect(mocks.releaseDriver).not.toHaveBeenCalled();
  });
  it("respects future holds and calls canonical release with stable operation identities only when due", async () => {
    mocks.clearance.mockResolvedValue(true);
    mocks.store.mockResolvedValue({ status: "ACCRUED", releaseEligibleAt: new Date("2999-01-01") });
    mocks.driver.mockResolvedValue({ status: "ACCRUED", releaseEligibleAt: new Date("2000-01-01") });
    await runEarningLifecycleBatch({ mode: "APPLY", batchSize: 5 });
    await runEarningLifecycleBatch({ mode: "APPLY", batchSize: 5 });
    expect(mocks.releaseStore).not.toHaveBeenCalled();
    expect(mocks.releaseDriver).toHaveBeenCalledTimes(2);
    for (const [command] of mocks.releaseDriver.mock.calls) expect(command).toEqual({ earningId: "driver-1", operationId: "automatic-earning-release:driver-1", now: expect.any(Date) });
  });
  it("continues across failed financial sources and persists independent cursors to prevent starvation", async () => {
    mocks.setting.mockResolvedValue({ value: { deliveries: "order-0", stores: "store-0", drivers: "driver-0" } });
    mocks.orders.mockResolvedValue([{ id: "order-1" }, { id: "order-2" }]);
    mocks.produce.mockRejectedValueOnce(new Error("private payment failure"));
    mocks.clearance.mockRejectedValueOnce(new Error("private proof conflict"));
    mocks.driver.mockResolvedValue({ status: "ACCRUED", releaseEligibleAt: new Date("2000-01-01") });
    mocks.releaseDriver.mockRejectedValueOnce(new Error("private financial incident"));
    const result = await runEarningLifecycleBatch({ mode: "APPLY", batchSize: 2 });
    expect(result).toMatchObject({ itemsCompleted: 1, itemsRetried: 3 });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(mocks.orders).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { gt: "order-0" } }), take: 2 }));
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ update: { value: { deliveries: "order-2", stores: null, drivers: null } } }));
  });
  it("propagates database and cursor persistence failures so an unrecorded run cannot look healthy", async () => {
    mocks.save.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(runEarningLifecycleBatch({ mode: "APPLY", batchSize: 5 })).rejects.toThrow("database unavailable");
  });
  it("records policy and incident holds without degrading payment-worker health or disclosing private evidence", async () => {
    mocks.produce.mockRejectedValueOnce(new DriverEarningError("DRIVER_EARNING_PAYMENT_INVALID", "private receipt"));
    mocks.driver.mockResolvedValue({ status: "ACCRUED", releaseEligibleAt: new Date("2000-01-01") });
    mocks.releaseDriver.mockRejectedValueOnce(new DriverEarningError("DRIVER_EARNING_RELEASE_NOT_ELIGIBLE", "private incident"));
    const result = await runEarningLifecycleBatch({ mode: "APPLY", batchSize: 5 });
    expect(result).toMatchObject({ itemsSkipped: 3, itemsRetried: 0 });
    expect(result.safeSummary).toContain("DRIVER_EARNING_PAYMENT_INVALID");
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it.each([0, 26, NaN, 1.5])("rejects unbounded batch size %s before reading sources", async batchSize => {
    await expect(runEarningLifecycleBatch({ mode: "APPLY", batchSize })).rejects.toThrow("between 1 and 25");
    expect(mocks.setting).not.toHaveBeenCalled();
  });
});
