import { afterEach, describe, expect, it, vi } from "vitest";
const query = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findUniqueOrThrow: query } } }));
vi.mock("@/lib/client-platform/delivery.service", () => ({ saveDeliveryConfiguration: vi.fn() }));
vi.mock("@/lib/marketplace-checkout/delivery-policy-configuration", () => ({ saveDeliveryMatrix: vi.fn(), actOnDeliveryMatrix: vi.fn(), listDeliveryMatrices: vi.fn() }));
vi.mock("@/lib/services/commission-plan.service", () => ({ createCommissionPlan: vi.fn(), submitCommissionPlan: vi.fn(), approveCommissionPlan: vi.fn(), activateCommissionPlan: vi.fn() }));
vi.mock("@/lib/services/legal-documents.service", () => ({ createLegalDocumentDraft: vi.fn(), publishLegalDocumentVersion: vi.fn() }));
import { createDisposableCheckoutAuthorities } from "@/scripts/e2e-checkout-authorities";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("browser commercial fixture isolation", () => {
  it.each([
    { runtime: "production", node: "production", database: "postgresql://disposable:disposable_only@localhost/kt_phase75_e2e" },
    { runtime: "e2e", node: "production", database: "postgresql://disposable:disposable_only@localhost/kt_phase75_e2e" },
    { runtime: "e2e", node: "test", database: "postgresql://disposable:disposable_only@remote.invalid/kt_phase75_e2e" },
    { runtime: "e2e", node: "test", database: "postgresql://disposable:disposable_only@localhost/production" },
    { runtime: "e2e", node: "test", database: "postgresql://disposable:disposable_only@localhost/other_e2e" },
    { runtime: "", node: "test", database: "postgresql://disposable:disposable_only@localhost/kt_phase75_e2e" },
  ])("refuses non-disposable configuration before querying or creating any authority %#", async ({ runtime, node, database }) => {
    vi.stubEnv("KT_RUNTIME_ENV", runtime); vi.stubEnv("NODE_ENV", node); vi.stubEnv("DATABASE_URL", database);
    await expect(createDisposableCheckoutAuthorities()).rejects.toThrow("isolated browser database");
    expect(query).not.toHaveBeenCalled();
  });
});
