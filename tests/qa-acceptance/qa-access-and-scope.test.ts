import { describe, expect, it, vi } from "vitest";
import {
  checkOrderDriverQaScope,
  isStoreVisibleInViewerContext,
  resolveQaAcceptanceSessionContext,
  resolveQaPrincipalForUser,
  resolveQaVisibleStoreIdsForViewer,
} from "@/lib/qa-acceptance/access";

const QA_ENV = {
  QA_ACCEPTANCE_LANE_ENABLED: "true",
  PAYSTACK_ACCEPTANCE_SANDBOX_SECRET_KEY: ["sk", "test", "qa_scope_0123456789abcdef"].join("_"),
} as const;

describe("QA Acceptance run, participant, storefront, and dispatch scope", () => {
  it("fails closed when principal is revoked, inactive, or misses QA entity flag", async () => {
    const db = {
      qaAcceptancePrincipal: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: "p1",
            publicReference: "QAP-1",
            userId: "u1",
            role: "VENDOR",
            storeId: "s1",
            driverProfileId: null,
            label: "Vendor",
            user: { status: "ACTIVE", role: "STORE", isQaAcceptance: true },
            store: { id: "s1", isQaAcceptance: false },
            driverProfile: null,
          }),
      },
    };

    expect(await resolveQaPrincipalForUser("u-revoked", db as never)).toBeNull();
    expect(await resolveQaPrincipalForUser("u1", db as never)).toBeNull();
  });

  it("scopes customers and vendors to their own active run when multiple runs exist and fails closed on archived runs", async () => {
    const cust1Principal = {
      id: "p-cust-1",
      publicReference: "QAP-C1",
      userId: "cust-1",
      role: "CUSTOMER",
      storeId: null,
      driverProfileId: null,
      label: "Cust 1",
      user: { status: "ACTIVE", role: "CUSTOMER", isQaAcceptance: true },
      store: null,
      driverProfile: null,
    };
    const cust2Principal = {
      id: "p-cust-2",
      publicReference: "QAP-C2",
      userId: "cust-2",
      role: "CUSTOMER",
      storeId: null,
      driverProfileId: null,
      label: "Cust 2",
      user: { status: "ACTIVE", role: "CUSTOMER", isQaAcceptance: true },
      store: null,
      driverProfile: null,
    };
    const archivedCustPrincipal = {
      id: "p-cust-3",
      publicReference: "QAP-C3",
      userId: "cust-3",
      role: "CUSTOMER",
      storeId: null,
      driverProfileId: null,
      label: "Cust 3",
      user: { status: "ACTIVE", role: "CUSTOMER", isQaAcceptance: true },
      store: null,
      driverProfile: null,
    };

    const activeRuns = [
      // Run 2 started more recently globally, bound to cust-2 / store-2
      {
        id: "run-2",
        publicReference: "QARUN-2",
        storeId: "store-2",
        customerUserId: "cust-2",
        driverProfileId: "drv-2",
        startedAt: new Date("2026-11-27T04:00:00Z"),
      },
      // Run 1 is older globally, bound to cust-1 / store-1
      {
        id: "run-1",
        publicReference: "QARUN-1",
        storeId: "store-1",
        customerUserId: "cust-1",
        driverProfileId: "drv-1",
        startedAt: new Date("2026-11-27T02:00:00Z"),
      },
    ];

    const db = {
      qaAcceptancePrincipal: {
        findFirst: vi.fn(async ({ where }: { where: { userId: string } }) => {
          if (where.userId === "cust-1") return cust1Principal;
          if (where.userId === "cust-2") return cust2Principal;
          if (where.userId === "cust-3") return archivedCustPrincipal;
          return null;
        }),
      },
      qaAcceptanceRun: {
        findMany: vi.fn(async () => activeRuns),
      },
      store: {
        findMany: vi.fn(async () => [{ id: "store-1" }, { id: "store-2" }]),
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({
          id: where.id,
          isQaAcceptance: true,
        })),
      },
    };

    const ctx1 = await resolveQaAcceptanceSessionContext("cust-1", db as never, QA_ENV);
    expect(ctx1?.activeRunId).toBe("run-1");
    expect(ctx1?.activeRunReference).toBe("QARUN-1");

    const ctx2 = await resolveQaAcceptanceSessionContext("cust-2", db as never, QA_ENV);
    expect(ctx2?.activeRunId).toBe("run-2");

    // Storefront visibility strictly isolated per run
    expect(await resolveQaVisibleStoreIdsForViewer("cust-1", db as never, QA_ENV)).toEqual(["store-1"]);
    expect(await resolveQaVisibleStoreIdsForViewer("cust-2", db as never, QA_ENV)).toEqual(["store-2"]);
    expect((await isStoreVisibleInViewerContext("store-2", "cust-1", db as never, QA_ENV)).allowed).toBe(false);
    expect((await isStoreVisibleInViewerContext("store-1", "cust-1", db as never, QA_ENV)).allowed).toBe(true);

    // cust-3's only run was archived/completed, so even with active runs for other
    // participants present, cust-3 receives null and sees zero stores.
    expect(await resolveQaAcceptanceSessionContext("cust-3", db as never, QA_ENV)).toBeNull();
    expect(await resolveQaVisibleStoreIdsForViewer("cust-3", db as never, QA_ENV)).toEqual([]);
  });

  it("blocks cross-lane, archived-run, revoked-driver, and cross-run QA dispatch", async () => {
    const drv1Principal = {
      id: "p-drv-1",
      publicReference: "QAP-D1",
      userId: "u-drv-1",
      role: "DRIVER",
      storeId: null,
      driverProfileId: "drv-1",
      label: "Driver 1",
      user: { status: "ACTIVE", role: "DRIVER", isQaAcceptance: true },
      store: null,
      driverProfile: { id: "drv-1", isQaAcceptance: true },
    };
    const drv2Principal = {
      id: "p-drv-2",
      publicReference: "QAP-D2",
      userId: "u-drv-2",
      role: "DRIVER",
      storeId: null,
      driverProfileId: "drv-2",
      label: "Driver 2",
      user: { status: "ACTIVE", role: "DRIVER", isQaAcceptance: true },
      store: null,
      driverProfile: { id: "drv-2", isQaAcceptance: true },
    };

    const orders: Record<string, { id: string; isQaAcceptance: boolean; qaAcceptanceRunId: string | null }> = {
      "ord-live": { id: "ord-live", isQaAcceptance: false, qaAcceptanceRunId: null },
      "ord-run-1": { id: "ord-run-1", isQaAcceptance: true, qaAcceptanceRunId: "run-1" },
      "ord-archived": { id: "ord-archived", isQaAcceptance: true, qaAcceptanceRunId: "run-arch" },
      "ord-unbound": { id: "ord-unbound", isQaAcceptance: true, qaAcceptanceRunId: "run-unbound" },
    };
    const runs: Record<string, { id: string; status: string; driverProfileId: string | null }> = {
      "run-1": { id: "run-1", status: "ACTIVE", driverProfileId: "drv-1" },
      "run-arch": { id: "run-arch", status: "ARCHIVED", driverProfileId: "drv-1" },
      "run-unbound": { id: "run-unbound", status: "ACTIVE", driverProfileId: null },
    };

    const db = {
      order: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => orders[where.id] ?? null),
      },
      driverProfile: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          if (where.id === "drv-live") {
            return { id: "drv-live", isQaAcceptance: false, userId: "u-drv-live", user: { status: "ACTIVE", role: "DRIVER", isQaAcceptance: false } };
          }
          if (where.id === "drv-1") {
            return { id: "drv-1", isQaAcceptance: true, userId: "u-drv-1", user: { status: "ACTIVE", role: "DRIVER", isQaAcceptance: true } };
          }
          if (where.id === "drv-2") {
            return { id: "drv-2", isQaAcceptance: true, userId: "u-drv-2", user: { status: "ACTIVE", role: "DRIVER", isQaAcceptance: true } };
          }
          return null;
        }),
      },
      qaAcceptancePrincipal: {
        findFirst: vi.fn(async ({ where }: { where: { userId: string } }) => {
          if (where.userId === "u-drv-1") return drv1Principal;
          if (where.userId === "u-drv-2") return drv2Principal;
          return null;
        }),
      },
      qaAcceptanceRun: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => runs[where.id] ?? null),
        findMany: vi.fn(async () => [
          { id: "run-1", publicReference: "QARUN-1", storeId: "store-1", customerUserId: "cust-1", driverProfileId: "drv-1", startedAt: new Date() },
          { id: "run-2", publicReference: "QARUN-2", storeId: "store-2", customerUserId: "cust-2", driverProfileId: "drv-2", startedAt: new Date() },
          { id: "run-unbound", publicReference: "QARUN-U", storeId: null, customerUserId: null, driverProfileId: null, startedAt: new Date() },
        ]),
      },
    };

    // Matching QA run passes
    expect(await checkOrderDriverQaScope(db as never, { orderId: "ord-run-1", driverProfileId: "drv-1" })).toEqual({ ok: true });
    // Live-to-live passes
    expect(await checkOrderDriverQaScope(db as never, { orderId: "ord-live", driverProfileId: "drv-live" })).toEqual({ ok: true });
    // Cross-lane rejects
    expect((await checkOrderDriverQaScope(db as never, { orderId: "ord-run-1", driverProfileId: "drv-live" })).ok).toBe(false);
    expect((await checkOrderDriverQaScope(db as never, { orderId: "ord-live", driverProfileId: "drv-1" })).ok).toBe(false);
    // Cross-run QA dispatch rejects (drv-2 cannot take ord-run-1)
    expect((await checkOrderDriverQaScope(db as never, { orderId: "ord-run-1", driverProfileId: "drv-2" })).ok).toBe(false);
    // Driver exclusively bound to active run-2 cannot take unbound run order
    expect((await checkOrderDriverQaScope(db as never, { orderId: "ord-unbound", driverProfileId: "drv-2" })).ok).toBe(false);
    // Archived run order rejects even with matching driver
    expect((await checkOrderDriverQaScope(db as never, { orderId: "ord-archived", driverProfileId: "drv-1" })).ok).toBe(false);
  });
});
