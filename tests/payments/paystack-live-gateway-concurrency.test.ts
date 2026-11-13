import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type VerificationRow = {
  id: string;
  reference: string;
  idempotencyKey: string;
  actorUserId: string;
  payerEmail: string;
  amountCents: number;
  status: string;
  checkoutUrl: string | null;
  verifiedAt: Date | null;
  failureCode: string | null;
  createdAt: Date;
};

const state = vi.hoisted(() => ({
  records: [] as VerificationRow[],
  queue: Promise.resolve() as Promise<void>,
  initializeCount: 0,
}));

vi.mock("@/lib/db/prisma", () => {
  const findUnique = async ({ where }: { where: { idempotencyKey?: string; id?: string } }) =>
    state.records.find(row => row.idempotencyKey === where.idempotencyKey && !!where.idempotencyKey || row.id === where.id && !!where.id) ?? null;
  return {
    prisma: {
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
        const previous = state.queue;
        let release: () => void = () => undefined;
        state.queue = new Promise<void>(resolve => { release = resolve; });
        await previous;
        try {
          return await callback({
            $queryRaw: async () => [{ id: "tester-1" }],
            paystackLiveVerification: {
              findUnique,
              findMany: async ({ where, take }: { where: { actorUserId: string }; take: number }) =>
                state.records.filter(row => row.actorUserId === where.actorUserId).slice(0, take),
              create: async ({ data }: { data: Omit<VerificationRow, "id" | "checkoutUrl" | "verifiedAt" | "failureCode" | "createdAt"> }) => {
                const record: VerificationRow = { ...data, id: `row-${state.records.length + 1}`, checkoutUrl: null,
                  verifiedAt: null, failureCode: null, createdAt: new Date() };
                state.records.push(record);
                return record;
              },
            },
          });
        } finally { release(); }
      },
      paystackLiveVerification: {
        findUnique,
        findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
          const row = state.records.find(record => record.id === where.id);
          if (!row) throw new Error("Not found");
          return row;
        },
        updateMany: async ({ where, data }: { where: { id: string; status: string }; data: { status: string; checkoutUrl: string } }) => {
          const row = state.records.find(record => record.id === where.id && record.status === where.status);
          if (row) Object.assign(row, data);
          return { count: row ? 1 : 0 };
        },
      },
    },
  };
});

vi.mock("@/lib/payments/providers/paystack/paystack-client", () => ({
  validatePaystackAuthorizationUrl: (url: string) => url,
  PaystackClient: class {
    async initializeTransaction(input: { reference: string }) {
      state.initializeCount += 1;
      await new Promise<void>(resolve => setTimeout(resolve, 5));
      return { authorization_url: "https://checkout.paystack.com/fixture", reference: input.reference, access_code: "fixture" };
    }
  },
}));

import { createLiveGatewayVerification } from "@/lib/payments/live-gateway-verification.service";

const actor = { id: "tester-1", email: "tester@example.com" };
const firstOperation = "47fae964-c781-4a41-9a76-a395cfb45408";
const secondOperation = "dda7df85-1169-4bb5-9ea9-b6e60f828c07";

beforeEach(() => {
  state.records.length = 0;
  state.initializeCount = 0;
  state.queue = Promise.resolve();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("KT_DATABASE_CLASSIFICATION", "production");
  vi.stubEnv("PAYSTACK_MODE", "live");
  vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_live_fixture_not_real");
  vi.stubEnv("PAYSTACK_TEMPORARY_SANDBOX_ENABLED", "false");
  vi.stubEnv("PAYMENT_APP_ORIGIN", "https://ktcouriers.com");
  vi.stubEnv("KT_E2E_PAYSTACK_ACCEPTANCE", "false");
});
afterEach(() => vi.unstubAllEnvs());

describe("Paystack real-money diagnostic concurrency", () => {
  it("serializes two tabs under one tester and does not initialize a second R1 charge", async () => {
    const [a, b] = await Promise.all([
      createLiveGatewayVerification(actor, firstOperation),
      createLiveGatewayVerification(actor, secondOperation),
    ]);
    expect(state.initializeCount).toBe(1);
    expect(state.records).toHaveLength(1);
    expect(a.reference).toBe(b.reference);
    expect(a.amount).toBe("1.00");
  });
});
