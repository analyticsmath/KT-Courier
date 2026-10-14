import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ prior: vi.fn(), create: vi.fn(), upsert: vi.fn(), audit: vi.fn(), service: vi.fn(), lock: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { systemSetting: { findUnique: mocks.prior }, $transaction: async (work: (tx: unknown) => unknown) => work({ $executeRaw: mocks.lock, systemSetting: { findUnique: mocks.prior, create: mocks.create, upsert: mocks.upsert }, deliveryServiceDefinition: { findFirst: mocks.service }, adminActivityLog: { create: mocks.audit } }) } }));
import { activateOwnerSelectedCourierTariffs, marketplaceCourierTariffPolicy, saveMarketplaceCourierTariffConfiguration, OWNER_COURIER_TARIFF_APPROVAL } from "@/lib/marketplace-checkout/courier-tariff-policy";
const value = { enabled: true, defaultServiceKey: "CLIENT_ECONOMY", approvalReference: OWNER_COURIER_TARIFF_APPROVAL };
const date = new Date("2026-10-14T01:00:00Z");
beforeEach(() => { vi.resetAllMocks(); mocks.prior.mockResolvedValue(null); mocks.create.mockResolvedValue({ id: "policy" }); mocks.upsert.mockResolvedValue({ id: "policy", updatedAt: date }); mocks.service.mockResolvedValue({ id: "economy" }); });
describe("marketplace courier pricing configuration", () => {
  it("preserves the matrix model when no courier policy exists or it is disabled", async () => {
    expect(await marketplaceCourierTariffPolicy()).toBeNull(); mocks.prior.mockResolvedValue({ value: { ...value, enabled: false } }); expect(await marketplaceCourierTariffPolicy()).toBeNull();
  });
  it("rejects malformed persisted pricing instead of silently charging another model", async () => { mocks.prior.mockResolvedValue({ value: { ...value, defaultServiceKey: "invalid" } }); await expect(marketplaceCourierTariffPolicy()).rejects.toThrow("administrator configuration"); });
  it("audits one opt-in activation without a guessed fee", async () => {
    expect(await activateOwnerSelectedCourierTariffs("owner-maintenance")).toEqual({ activated: true });
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ value }) }); expect(mocks.audit).toHaveBeenCalledWith({ data: expect.objectContaining({ actorUserId: "owner-maintenance", metadata: expect.objectContaining({ inventedFees: false }) }) });
    mocks.prior.mockResolvedValue({ value }); expect(await activateOwnerSelectedCourierTariffs("owner-maintenance")).toEqual({ activated: false }); expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it("preserves later operator changes instead of reactivating automatically", async () => { mocks.prior.mockResolvedValue({ value: { ...value, enabled: false } }); await expect(activateOwnerSelectedCourierTariffs("owner-maintenance")).rejects.toThrow("no automatic overwrite"); expect(mocks.create).not.toHaveBeenCalled(); });
  it("rejects a stale admin update without writing or auditing", async () => { mocks.prior.mockResolvedValue({ value, updatedAt: date }); await expect(saveMarketplaceCourierTariffConfiguration("admin", { enabled: true, defaultServiceKey: "CLIENT_STANDARD", expectedUpdatedAt: null, reason: "Use the configured Standard tariff" })).rejects.toMatchObject({ code: "VERSION_CONFLICT" }); expect(mocks.upsert).not.toHaveBeenCalled(); expect(mocks.audit).not.toHaveBeenCalled(); });
  it("refuses an inactive default service", async () => { mocks.service.mockResolvedValue(null); await expect(saveMarketplaceCourierTariffConfiguration("admin", { enabled: true, defaultServiceKey: "CLIENT_STANDARD", expectedUpdatedAt: null, reason: "Use the configured Standard tariff" })).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" }); expect(mocks.upsert).not.toHaveBeenCalled(); });
  it("saves and audits the operator's valid selection", async () => { expect(await saveMarketplaceCourierTariffConfiguration("admin", { enabled: true, defaultServiceKey: "CLIENT_STANDARD", expectedUpdatedAt: null, reason: "Use the configured Standard tariff" })).toMatchObject({ enabled: true, defaultServiceKey: "CLIENT_STANDARD", updatedAt: date.toISOString() }); expect(mocks.audit).toHaveBeenCalledWith({ data: expect.objectContaining({ actorUserId: "admin", metadata: expect.objectContaining({ newTariffsAuthored: false }) }) }); });
});
