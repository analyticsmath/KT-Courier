import { afterEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ create: vi.fn(), submit: vi.fn(), approve: vi.fn(), activate: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  user: { findUniqueOrThrow: async () => ({ id: "maker" }), create: async () => ({ id: "checker" }) },
  deliveryRegion: { findUniqueOrThrow: async () => ({ id: "region" }) },
  deliveryServiceDefinition: { findFirst: async () => null }, parcelProfileVersion: { findFirst: async () => null },
  systemSetting: { findUniqueOrThrow: async () => ({ updatedAt: new Date("2026-01-01") }) },
  store: { findUniqueOrThrow: async ({ where }: { where: { slug: string } }) => ({ id: where.slug, slug: where.slug }) },
  storeSellerLegalIdentity: { create: vi.fn() },
} }));
vi.mock("@/lib/client-platform/delivery.service", () => ({ saveDeliveryConfiguration: vi.fn() }));
vi.mock("@/lib/commercial/parcel-profiles", () => ({ saveParcelProfile: vi.fn() }));
vi.mock("@/lib/marketplace-checkout/delivery-policy-configuration", () => ({ saveDeliveryMatrix: async () => ({ version: 1 }), actOnDeliveryMatrix: vi.fn(), listDeliveryMatrices: async () => [] }));
vi.mock("@/lib/services/commission-plan.service", () => ({ createCommissionPlan: async () => ({ id: "commission" }), submitCommissionPlan: vi.fn(), approveCommissionPlan: vi.fn(), activateCommissionPlan: vi.fn() }));
vi.mock("@/lib/services/legal-documents.service", () => ({ createLegalDocumentDraft: async () => ({ publicReference: "legal" }), publishLegalDocumentVersion: vi.fn() }));
vi.mock("@/lib/store-orders/operational-policy.service", () => ({ createStoreOrderOperationalPolicy: f.create, submitStoreOrderOperationalPolicy: f.submit, approveStoreOrderOperationalPolicy: f.approve, activateStoreOrderOperationalPolicy: f.activate }));
import { createDisposableCheckoutAuthorities } from "@/scripts/e2e-checkout-authorities";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("browser checkout fulfilment prerequisite", () => {
  it("finishes normal independent policy approval and activation during isolated bootstrap", async () => {
    vi.stubEnv("KT_RUNTIME_ENV", "e2e"); vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DATABASE_URL", "postgresql://kt_phase75_e2e:disposable@localhost/kt_phase75_e2e");
    f.create.mockResolvedValue({ publicReference: "disposable-fulfilment" });
    await createDisposableCheckoutAuthorities();
    expect(f.create).toHaveBeenCalledWith(expect.objectContaining({ substitutionMode: "CUSTOMER_APPROVAL_REQUIRED", effectiveFrom: new Date("2026-01-01") }));
    expect(f.submit).toHaveBeenCalledWith("disposable-fulfilment");
    expect(f.approve).toHaveBeenCalledWith({ publicReference: "disposable-fulfilment", approvedByUserId: "checker" });
    expect(f.activate).toHaveBeenCalledWith({ publicReference: "disposable-fulfilment", activatedByUserId: "maker" });
    expect(f.create.mock.invocationCallOrder[0]).toBeLessThan(f.submit.mock.invocationCallOrder[0]);
    expect(f.submit.mock.invocationCallOrder[0]).toBeLessThan(f.approve.mock.invocationCallOrder[0]);
    expect(f.approve.mock.invocationCallOrder[0]).toBeLessThan(f.activate.mock.invocationCallOrder[0]);
  });
  it("does not create or activate policies when the fixture guard rejects the environment", async () => {
    vi.stubEnv("KT_RUNTIME_ENV", "production"); vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgresql://owner:password@remote.invalid/production");
    await expect(createDisposableCheckoutAuthorities()).rejects.toThrow("isolated browser database");
    expect(f.create).not.toHaveBeenCalled(); expect(f.activate).not.toHaveBeenCalled();
  });
});
