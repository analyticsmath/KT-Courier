/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Service-level invariants for recoverExhaustedDispatchOrder. The fake database below models only what
 * the contract depends on: one bridge row with an `updatedAt` version, JSON-path conditions evaluated
 * against the CURRENT row inside an atomic updateMany (the compare-and-set), an admin audit sink, and
 * a transaction wrapper. Nothing is reachable outside `$transaction`, so any pre-transaction read or
 * write by the service fails the test.
 */
interface FakeState {
  bridge: any;
  users: Map<string, { id: string; role: string; status: string }>;
  assignments: any[];
  audit: any[];
  updateManyAttempts: number;
  successfulSwaps: number;
  inTx: boolean;
  userChecksInsideTx: number;
  userChecksOutsideTx: number;
  serialize: boolean;
  txTail: Promise<unknown>;
  bridgeReadGate: (() => Promise<void>) | null;
  beforeSwap: (() => void) | null;
}

const fake = vi.hoisted(() => ({ state: {} as any }));

vi.mock("@/lib/db/prisma", () => {
  const readPath = (evidence: any, path: string[]) =>
    path.reduce((acc: any, key: string) => (acc && typeof acc === "object" ? acc[key] : undefined), evidence);

  const tx = {
    user: {
      findFirst: vi.fn(async ({ where }: any) => {
        const s: FakeState = fake.state;
        if (s.inTx) s.userChecksInsideTx += 1;
        else s.userChecksOutsideTx += 1;
        const user = s.users.get(where.id);
        return user && where.role.in.includes(user.role) && user.status === where.status ? user : null;
      }),
    },
    marketplaceStoreOrderDeliveryBridge: {
      findFirst: vi.fn(async ({ where }: any) => {
        const s: FakeState = fake.state;
        const b = s.bridge;
        const matches =
          b &&
          (where.id === undefined || where.id === b.id) &&
          (where.courierOrderId === undefined || where.courierOrderId === b.courierOrderId) &&
          (where.marketplaceStoreOrderId === undefined || where.marketplaceStoreOrderId === b.marketplaceStoreOrderId);
        const snapshot = matches ? structuredClone(b) : null;
        if (s.bridgeReadGate) await s.bridgeReadGate();
        return snapshot;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const s: FakeState = fake.state;
        s.updateManyAttempts += 1;
        if (s.beforeSwap) {
          const hook = s.beforeSwap;
          s.beforeSwap = null;
          hook();
        }
        const b = s.bridge;
        const jsonOk = (where.AND ?? []).every(
          (c: any) => readPath(b.dispatchEvidence, c.dispatchEvidence.path) === c.dispatchEvidence.equals
        );
        if (!b || b.id !== where.id || b.updatedAt.getTime() !== where.updatedAt.getTime() || !jsonOk) {
          return { count: 0 };
        }
        b.dispatchEvidence = structuredClone(data.dispatchEvidence);
        b.updatedAt = new Date(b.updatedAt.getTime() + 1);
        s.successfulSwaps += 1;
        return { count: 1 };
      }),
    },
    orderAssignment: {
      findFirst: vi.fn(async () => {
        const s: FakeState = fake.state;
        return s.assignments.find((a) => a.status === "ACCEPTED" || (a.status === "ASSIGNED" && (a.expiresAt === null || a.expiresAt > new Date()))) ?? null;
      }),
    },
    adminActivityLog: {
      create: vi.fn(async ({ data }: any) => {
        fake.state.audit.push(structuredClone(data));
        return data;
      }),
    },
  };

  return {
    prisma: {
      $transaction: vi.fn(async (cb: (client: typeof tx) => Promise<unknown>) => {
        const s: FakeState = fake.state;
        const run = async () => {
          s.inTx = true;
          try {
            return await cb(tx);
          } finally {
            s.inTx = false;
          }
        };
        if (!s.serialize) return run();
        const next = s.txTail.then(run, run);
        s.txTail = next.catch(() => undefined);
        return next;
      }),
    },
  };
});

import { recoverExhaustedDispatchOrder } from "@/lib/services/marketplace-dispatch-eligibility.service";

const EXHAUSTED = "OFFER_CREATION_FAILED_RETRY_EXHAUSTED";
const KEY_A = "recover-key-0001";
const KEY_B = "recover-key-0002";

function exhaustedBridge(overrides: Record<string, unknown> = {}) {
  return {
    id: "br-1",
    courierOrderId: "ord-1",
    marketplaceStoreOrderId: "so-1",
    status: "DISPATCH_PENDING",
    updatedAt: new Date("2026-10-17T07:00:00.000Z"),
    courierOrder: { status: "CONFIRMED" },
    dispatchEvidence: {
      manualDispatchRequired: true,
      dispatchRouting: "MANUAL_DISPATCH_REQUIRED",
      reason: EXHAUSTED,
      consecutiveFailures: 3,
      policyReference: "dspauto_valid",
      history: [{ event: "OFFER_CREATION_FAILED", errorCode: "LOCK_TIMEOUT" }],
    },
    ...overrides,
  };
}

function recoverInput(overrides: Record<string, unknown> = {}) {
  return {
    bridgeId: "br-1",
    actorUserId: "admin-1",
    reason: "Locks cleared after operator review",
    idempotencyKey: KEY_A,
    ...overrides,
  } as Parameters<typeof recoverExhaustedDispatchOrder>[0];
}

function recoveryEntries(): any[] {
  return fake.state.bridge.dispatchEvidence.history.filter((e: any) => e.event === "EXHAUSTED_DISPATCH_RECOVERED");
}

describe("recoverExhaustedDispatchOrder (service-level invariants)", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    fake.state = {
      bridge: exhaustedBridge(),
      users: new Map([
        ["admin-1", { id: "admin-1", role: "ADMIN", status: "ACTIVE" }],
        ["admin-2", { id: "admin-2", role: "SUPER_ADMIN", status: "ACTIVE" }],
        ["customer-1", { id: "customer-1", role: "CUSTOMER", status: "ACTIVE" }],
        ["admin-suspended", { id: "admin-suspended", role: "ADMIN", status: "SUSPENDED" }],
      ]),
      assignments: [],
      audit: [],
      updateManyAttempts: 0,
      successfulSwaps: 0,
      inTx: false,
      userChecksInsideTx: 0,
      userChecksOutsideTx: 0,
      serialize: true,
      txTail: Promise.resolve(),
      bridgeReadGate: null,
      beforeSwap: null,
    } satisfies FakeState;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("input validation (rejected before any database access)", () => {
    it.each([
      ["missing key", undefined],
      ["empty key", ""],
      ["too short", "short"],
      ["illegal characters", "bad key with spaces!"],
      ["too long", "k".repeat(129)],
    ])("rejects %s", async (_label, key) => {
      await expect(recoverExhaustedDispatchOrder(recoverInput({ idempotencyKey: key }))).rejects.toMatchObject({
        code: "DISPATCH_RECOVERY_IDEMPOTENCY_KEY_INVALID",
      });
      expect(fake.state.updateManyAttempts).toBe(0);
      expect(fake.state.audit).toHaveLength(0);
    });

    it("requires a target and a bounded non-empty reason", async () => {
      await expect(
        recoverExhaustedDispatchOrder(recoverInput({ bridgeId: undefined }))
      ).rejects.toMatchObject({ code: "DISPATCH_RECOVERY_TARGET_REQUIRED" });
      await expect(recoverExhaustedDispatchOrder(recoverInput({ reason: "   " }))).rejects.toMatchObject({
        code: "DISPATCH_RECOVERY_REASON_REQUIRED",
      });
      await expect(
        recoverExhaustedDispatchOrder(recoverInput({ reason: "x".repeat(501) }))
      ).rejects.toMatchObject({ code: "DISPATCH_RECOVERY_REASON_TOO_LONG" });
      expect(fake.state.audit).toHaveLength(0);
    });
  });

  describe("authorization", () => {
    it.each(["customer-1", "admin-suspended", "ghost-user"])(
      "rejects actor %s without altering evidence or auditing success",
      async (actor) => {
        const before = structuredClone(fake.state.bridge.dispatchEvidence);
        await expect(recoverExhaustedDispatchOrder(recoverInput({ actorUserId: actor }))).rejects.toMatchObject({
          code: "DISPATCH_POLICY_UNAUTHORIZED_ACTOR",
        });
        expect(fake.state.bridge.dispatchEvidence).toEqual(before);
        expect(fake.state.audit).toHaveLength(0);
      }
    );

    it("re-verifies the actor inside the transaction, never outside it", async () => {
      await recoverExhaustedDispatchOrder(recoverInput());
      expect(fake.state.userChecksInsideTx).toBeGreaterThanOrEqual(1);
      expect(fake.state.userChecksOutsideTx).toBe(0);
    });
  });

  describe("terminal-state and prerequisite checks", () => {
    it("first recovery transitions only the exhausted bridge, writes one history entry and one audit record", async () => {
      const result = await recoverExhaustedDispatchOrder(recoverInput());
      expect(result).toMatchObject({ status: "RECOVERED", replayed: false, bridgeId: "br-1", idempotencyKey: KEY_A });

      const evidence = fake.state.bridge.dispatchEvidence;
      expect(evidence).toMatchObject({
        manualDispatchRequired: false,
        dispatchRouting: "PENDING_DISPATCH_RETRY",
        consecutiveFailures: 0,
        reason: null,
        lastRecoveryIdempotencyKey: KEY_A,
        lastRecoveredByUserId: "admin-1",
      });
      expect(recoveryEntries()).toHaveLength(1);
      expect(recoveryEntries()[0]).toMatchObject({ actorUserId: "admin-1", idempotencyKey: KEY_A, policyReference: "dspauto_valid" });
      expect(fake.state.audit).toHaveLength(1);
      expect(fake.state.audit[0]).toMatchObject({
        actorUserId: "admin-1",
        action: "STATUS_CHANGE",
        entityType: "MarketplaceStoreOrderDeliveryBridge",
        entityId: "br-1",
        metadata: expect.objectContaining({ idempotencyKey: KEY_A }),
      });
      // prior failure history is preserved (append-only)
      expect(evidence.history[0]).toMatchObject({ event: "OFFER_CREATION_FAILED" });
    });

    it.each([
      ["non-terminal manual reason", { reason: "NO_ELIGIBLE_DRIVERS_AVAILABLE" }],
      ["never manual-queued", { manualDispatchRequired: false, reason: null }],
      ["empty evidence", null],
    ])("rejects a bridge in state: %s", async (_label, patch) => {
      fake.state.bridge.dispatchEvidence =
        patch === null ? {} : { ...fake.state.bridge.dispatchEvidence, ...patch };
      const before = structuredClone(fake.state.bridge.dispatchEvidence);
      await expect(recoverExhaustedDispatchOrder(recoverInput())).rejects.toMatchObject({
        code: "DISPATCH_RECOVERY_STATE_CONFLICT",
      });
      expect(fake.state.bridge.dispatchEvidence).toEqual(before);
      expect(fake.state.updateManyAttempts).toBe(0);
      expect(fake.state.audit).toHaveLength(0);
    });

    it.each([
      ["bridge already past dispatch", { status: "DRIVER_ASSIGNED" }],
      ["courier order no longer awaiting dispatch", { courierOrder: { status: "CANCELLED" } }],
      ["bridge without a courier order", { courierOrderId: null }],
    ])("rejects when %s", async (_label, patch) => {
      fake.state.bridge = exhaustedBridge(patch);
      await expect(recoverExhaustedDispatchOrder(recoverInput())).rejects.toMatchObject({
        code: "DISPATCH_RECOVERY_STATE_CONFLICT",
      });
      expect(fake.state.audit).toHaveLength(0);
      expect(fake.state.bridge.dispatchEvidence.reason).toBe(EXHAUSTED);
    });

    it("rejects when the courier order already has a live driver assignment", async () => {
      fake.state.assignments = [{ id: "as-1", status: "ASSIGNED", expiresAt: new Date(Date.now() + 60_000) }];
      await expect(recoverExhaustedDispatchOrder(recoverInput())).rejects.toMatchObject({
        code: "DISPATCH_RECOVERY_STATE_CONFLICT",
      });
      expect(fake.state.bridge.dispatchEvidence.reason).toBe(EXHAUSTED);
      expect(fake.state.audit).toHaveLength(0);
    });

    it("returns not-found for an unknown target without writes", async () => {
      await expect(
        recoverExhaustedDispatchOrder(recoverInput({ bridgeId: "br-missing" }))
      ).rejects.toMatchObject({ code: "DISPATCH_RECOVERY_NOT_FOUND" });
      expect(fake.state.audit).toHaveLength(0);
    });

    it("compare-and-set refuses to clear a row that changed after it was read (stale read)", async () => {
      fake.state.beforeSwap = () => {
        // A concurrent dispatch cycle re-queued the order for a different reason between read and swap.
        fake.state.bridge.dispatchEvidence = {
          ...fake.state.bridge.dispatchEvidence,
          reason: "NO_ELIGIBLE_DRIVERS_AVAILABLE",
        };
        fake.state.bridge.updatedAt = new Date(fake.state.bridge.updatedAt.getTime() + 5);
      };
      await expect(recoverExhaustedDispatchOrder(recoverInput())).rejects.toMatchObject({
        code: "DISPATCH_RECOVERY_STATE_CONFLICT",
      });
      expect(fake.state.successfulSwaps).toBe(0);
      expect(fake.state.bridge.dispatchEvidence.reason).toBe("NO_ELIGIBLE_DRIVERS_AVAILABLE");
      expect(fake.state.bridge.dispatchEvidence.manualDispatchRequired).toBe(true);
      expect(fake.state.audit).toHaveLength(0);
      expect(recoveryEntries()).toHaveLength(0);
    });
  });

  describe("idempotency (mandatory, atomic, exactly-once)", () => {
    it("replays the original result for the same key without a second history entry or audit record", async () => {
      const first = await recoverExhaustedDispatchOrder(recoverInput());
      const replay = await recoverExhaustedDispatchOrder(recoverInput());

      expect(replay).toMatchObject({ replayed: true, status: "RECOVERED", recoveredAt: first.recoveredAt, actorUserId: "admin-1" });
      expect(fake.state.successfulSwaps).toBe(1);
      expect(recoveryEntries()).toHaveLength(1);
      expect(fake.state.audit).toHaveLength(1);
    });

    it("rejects a different key against an already-recovered bridge (terminal state no longer holds)", async () => {
      await recoverExhaustedDispatchOrder(recoverInput());
      await expect(
        recoverExhaustedDispatchOrder(recoverInput({ idempotencyKey: KEY_B }))
      ).rejects.toMatchObject({ code: "DISPATCH_RECOVERY_STATE_CONFLICT" });
      expect(fake.state.successfulSwaps).toBe(1);
      expect(recoveryEntries()).toHaveLength(1);
      expect(fake.state.audit).toHaveLength(1);
    });

    it("does not let a different administrator reuse another operator's key", async () => {
      await recoverExhaustedDispatchOrder(recoverInput());
      await expect(
        recoverExhaustedDispatchOrder(recoverInput({ actorUserId: "admin-2" }))
      ).rejects.toMatchObject({ code: "DISPATCH_RECOVERY_IDEMPOTENCY_KEY_REUSED" });
      expect(fake.state.audit).toHaveLength(1);
    });

    it("concurrent same-key requests (serialized transactions) produce exactly one transition and audit", async () => {
      const [a, b] = await Promise.all([
        recoverExhaustedDispatchOrder(recoverInput()),
        recoverExhaustedDispatchOrder(recoverInput()),
      ]);
      expect([a.replayed, b.replayed].sort()).toEqual([false, true]);
      expect(a.recoveredAt).toBe(b.recoveredAt);
      expect(fake.state.successfulSwaps).toBe(1);
      expect(recoveryEntries()).toHaveLength(1);
      expect(fake.state.audit).toHaveLength(1);
    });

    it("concurrent same-key requests that both read the exhausted row: one wins the compare-and-set, the loser replays", async () => {
      fake.state.serialize = false;
      // Both transactions read the pre-recovery row before either one writes (no row lock).
      let reached = 0;
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => (release = resolve));
      fake.state.bridgeReadGate = async () => {
        reached += 1;
        if (reached === 2) {
          fake.state.bridgeReadGate = null; // later (post-loss) re-reads are not gated
          release();
        }
        await gate;
      };

      const [a, b] = await Promise.all([
        recoverExhaustedDispatchOrder(recoverInput()),
        recoverExhaustedDispatchOrder(recoverInput()),
      ]);

      expect(fake.state.updateManyAttempts).toBe(2);
      expect(fake.state.successfulSwaps).toBe(1);
      expect([a.replayed, b.replayed].sort()).toEqual([false, true]);
      expect(recoveryEntries()).toHaveLength(1);
      expect(fake.state.audit).toHaveLength(1);
    });

    it("concurrent requests with DIFFERENT keys: exactly one recovers, the other gets a state conflict", async () => {
      fake.state.serialize = false;
      let reached = 0;
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => (release = resolve));
      fake.state.bridgeReadGate = async () => {
        reached += 1;
        if (reached === 2) {
          fake.state.bridgeReadGate = null;
          release();
        }
        await gate;
      };

      const settled = await Promise.allSettled([
        recoverExhaustedDispatchOrder(recoverInput({ idempotencyKey: KEY_A })),
        recoverExhaustedDispatchOrder(recoverInput({ idempotencyKey: KEY_B })),
      ]);

      expect(settled.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const rejected = settled.find((r) => r.status === "rejected") as PromiseRejectedResult;
      expect(rejected.reason).toMatchObject({ code: "DISPATCH_RECOVERY_STATE_CONFLICT" });
      expect(fake.state.successfulSwaps).toBe(1);
      expect(recoveryEntries()).toHaveLength(1);
      expect(fake.state.audit).toHaveLength(1);
    });
  });
});
