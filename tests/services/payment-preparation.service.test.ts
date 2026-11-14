import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LedgerMoney } from "@/lib/ledger/money";

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  prisma: { $transaction: vi.fn(), payment: { findUnique: vi.fn() } },
  tx: {
    $queryRaw: vi.fn(),
    payment: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    paymentStatusHistory: { create: vi.fn() },
  },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/services/payment-subject.service", () => ({
  resolveOrderPaymentSubject: mocks.resolve,
}));
import { prepareOrderPayment } from "@/lib/services/payment-preparation.service";

const row = {
  id: "p",
  publicReference: "pay_abcdefghijklmnop",
  userId: "u",
  orderId: "o",
  provider: null,
  status: "CREATED",
  amount: new Prisma.Decimal("10.00"),
  currency: "ZAR",
  creationRequestHash: "",
  version: 0,
  latestAttemptNumber: 0,
  expiresAt: null,
  succeededAt: null,
  failedAt: null,
  cancelledAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  order: { id: "o", orderNumber: "KT-1" },
  user: { id: "u", name: "Payer" },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolve.mockResolvedValue({
    subjectType: "ORDER",
    subjectId: "o",
    orderReference: "KT-1",
    payerUserId: "u",
    currency: "ZAR",
    amount: LedgerMoney.parse("10.00"),
    description: "KT Couriers order KT-1",
    paymentAllowed: true,
    existingSuccessfulPaymentId: null,
  });
  mocks.prisma.$transaction.mockImplementation(
    async (callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx),
  );
  mocks.tx.payment.findUnique.mockResolvedValue(null);
  mocks.tx.payment.findFirst.mockResolvedValue(null);
  mocks.tx.payment.create.mockImplementation(
    async ({ data }: { data: { creationRequestHash: string } }) => ({
      ...row,
      creationRequestHash: data.creationRequestHash,
    }),
  );
  mocks.tx.paymentStatusHistory.create.mockResolvedValue({ id: "h" });
});
describe("payment preparation service", () => {
  it("creates one CREATED payment and initial history from authoritative subject without attempts, ledger, or order mutation", async () => {
    const result = await prepareOrderPayment(
      { id: "u", email: "payer@example.test" },
      { orderId: "o", idempotencyKey: "prepare:key:1" },
    );
    expect(result).toMatchObject({
      id: "p",
      amount: "10.00",
      status: "CREATED",
    });
    expect(mocks.tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: expect.any(Prisma.Decimal),
          currency: "ZAR",
          provider: null,
        }),
      }),
    );
    expect(mocks.tx.paymentStatusHistory.create).toHaveBeenCalledOnce();
  });
  it("replays a matching receipt and rejects changed-payload key reuse", async () => {
    mocks.tx.payment.findUnique.mockResolvedValueOnce({
      ...row,
      creationRequestHash: "same",
    });
    mocks.resolve.mockResolvedValueOnce({
      ...(await mocks.resolve()),
      subjectId: "different",
    });
    await expect(
      prepareOrderPayment(
        { id: "u", email: "payer@example.test" },
        { orderId: "o", idempotencyKey: "prepare:key:1" },
      ),
    ).rejects.toMatchObject({ code: "PAYMENT_IDEMPOTENCY_CONFLICT" });
  });
  it("rejects idempotency key reuse when walletAmount funding changes", async () => {
    await prepareOrderPayment(
      { id: "u", email: "payer@example.test" },
      { orderId: "o", idempotencyKey: "prepare:key:wallet-1" },
    );
    const firstHash = mocks.tx.payment.create.mock.calls[0][0].data.creationRequestHash;
    mocks.tx.payment.findUnique.mockResolvedValueOnce({
      ...row,
      creationRequestHash: firstHash,
    });
    await expect(
      prepareOrderPayment(
        { id: "u", email: "payer@example.test" },
        { orderId: "o", idempotencyKey: "prepare:key:wallet-1", walletAmount: "10.00" },
      ),
    ).rejects.toMatchObject({ code: "PAYMENT_IDEMPOTENCY_CONFLICT" });
  });
  it("propagates transaction rollback failures", async () => {
    mocks.tx.paymentStatusHistory.create.mockRejectedValueOnce(
      new Error("rollback"),
    );
    await expect(
      prepareOrderPayment(
        { id: "u", email: "payer@example.test" },
        { orderId: "o", idempotencyKey: "prepare:key:2" },
      ),
    ).rejects.toThrow("rollback");
  });
  it("replays an identical partial-wallet (SPLIT_PAYSTACK) preparation without PAYMENT_IDEMPOTENCY_CONFLICT", async () => {
    const { customerAccountPrefix } = await import("@/lib/services/customer-wallet.service");
    const prefix = customerAccountPrefix("u");
    const availAccount = {
      id: "acc-avail",
      walletId: "w-1",
      code: `${prefix}-WALLET-ZAR`,
      purpose: "CUSTOMER_WALLET_AVAILABLE",
      category: "LIABILITY",
      currency: "ZAR",
      status: "ACTIVE",
      allowNegative: false,
      currentBalance: new Prisma.Decimal("50.00"),
      debitTotal: new Prisma.Decimal("0.00"),
      creditTotal: new Prisma.Decimal("50.00"),
      version: 1,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      wallet: { id: "w-1", ownerType: "CUSTOMER", ownerId: "u", currency: "ZAR", status: "ACTIVE" },
    };
    const resAccount = {
      id: "acc-res",
      walletId: "w-1",
      code: `${prefix}-WALLET-RESERVED-ZAR`,
      purpose: "HELD",
      category: "LIABILITY",
      currency: "ZAR",
      status: "ACTIVE",
      allowNegative: false,
      currentBalance: new Prisma.Decimal("0.00"),
      debitTotal: new Prisma.Decimal("0.00"),
      creditTotal: new Prisma.Decimal("0.00"),
      version: 1,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      wallet: { id: "w-1", ownerType: "CUSTOMER", ownerId: "u", currency: "ZAR", status: "ACTIVE" },
    };
    let createdJournal: Record<string, unknown> | null = null;
    const splitMocks = {
      ...mocks.tx,
      $queryRaw: vi.fn().mockImplementation(async () => [
        { id: "acc-avail", currentBalance: new Prisma.Decimal("50.00") },
        { id: "acc-res", currentBalance: new Prisma.Decimal("0.00") },
      ]),
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: "u" }),
        findUnique: vi.fn().mockResolvedValue({ id: "u", status: "ACTIVE" }),
      },
      order: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "o",
          orderNumber: "KT-1",
          status: "PENDING",
          store: null,
          cashOnDelivery: null,
          pricingSnapshot: {},
        }),
      },
      wallet: {
        findUnique: vi.fn().mockResolvedValue({
          id: "w-1",
          ownerType: "CUSTOMER",
          ownerId: "u",
          status: "ACTIVE",
          currency: "ZAR",
          version: 1,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
          accounts: [availAccount],
        }),
        upsert: vi.fn().mockResolvedValue({
          id: "w-1",
          ownerType: "CUSTOMER",
          ownerId: "u",
          status: "ACTIVE",
          currency: "ZAR",
          version: 1,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        }),
      },
      ledgerAccount: {
        findUnique: vi.fn().mockImplementation(async ({ where }: { where: { code?: string; walletId_purpose_currency?: { purpose: string } } }) => {
          const purpose = where.walletId_purpose_currency?.purpose ?? "";
          const code = where.code ?? "";
          return purpose === "HELD" || code.includes("RESERVED") ? resAccount : availAccount;
        }),
        findMany: vi.fn().mockResolvedValue([availAccount, resAccount]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      ledgerEntry: {
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      ledgerJournal: {
        findUnique: vi.fn().mockImplementation(async ({ where }: { where: { id?: string; idempotencyKey?: string } }) => {
          if (where.id && createdJournal) return createdJournal;
          return null;
        }),
        create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
          createdJournal = {
            id: "jnl-res-1",
            reference: data.reference ?? "LJ-1",
            type: data.type,
            currency: "ZAR",
            idempotencyKey: data.idempotencyKey,
            requestHash: data.requestHash,
            sourceReference: data.sourceReference ?? null,
            correlationId: data.correlationId ?? null,
            memo: data.memo ?? null,
            metadata: data.metadata ?? null,
            policyVersion: data.policyVersion ?? "v1",
            totalDebits: new Prisma.Decimal("4.00"),
            totalCredits: new Prisma.Decimal("4.00"),
            originalJournal: null,
            reversalJournal: null,
            postedAt: new Date("2026-01-01"),
            createdAt: new Date("2026-01-01"),
            entries: [],
          };
          return createdJournal;
        }),
      },
    };
    let persistedPayment: Record<string, unknown> | null = null;
    splitMocks.payment = {
      findUnique: vi.fn().mockImplementation(async ({ where }: { where: { creationIdempotencyKey?: string; orderId?: string } }) => {
        if (where.creationIdempotencyKey && persistedPayment?.creationIdempotencyKey === where.creationIdempotencyKey) {
          return persistedPayment;
        }
        if (where.orderId && persistedPayment?.orderId === where.orderId) {
          return persistedPayment;
        }
        return null;
      }),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        persistedPayment = {
          ...row,
          ...data,
          order: { id: "o", orderNumber: "KT-1" },
          user: { id: "u", name: "Payer" },
        };
        return persistedPayment;
      }),
    };
    mocks.prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof splitMocks) => unknown) => callback(splitMocks),
    );

    const first = await prepareOrderPayment(
      { id: "u", email: "payer@example.test" },
      { orderId: "o", idempotencyKey: "prepare:key:split-1", walletAmount: "4.00" },
    );
    expect(first.amount).toBe("6.00");

    const second = await prepareOrderPayment(
      { id: "u", email: "payer@example.test" },
      { orderId: "o", idempotencyKey: "prepare:key:split-1", walletAmount: "4.00" },
    );
    expect(second).toEqual(first);

    // Proof that normalized walletAmount ("4" vs "4.00") produces identical canonical hash and replays cleanly
    const third = await prepareOrderPayment(
      { id: "u", email: "payer@example.test" },
      { orderId: "o", idempotencyKey: "prepare:key:split-1", walletAmount: "4" },
    );
    expect(third).toEqual(first);

    // Proof that changing walletAmount with the same key conflicts
    await expect(
      prepareOrderPayment(
        { id: "u", email: "payer@example.test" },
        { orderId: "o", idempotencyKey: "prepare:key:split-1", walletAmount: "5.00" },
      ),
    ).rejects.toMatchObject({ code: "PAYMENT_IDEMPOTENCY_CONFLICT" });
  });
  it("preserves legacy persisted split-wallet payment rows via explicit versioned replay verifier and rejects tampered legacy evidence", async () => {
    const { buildCanonicalOrderPaymentPreparationIntent } = await import("@/lib/services/wallet-spending.service");
    const intent = buildCanonicalOrderPaymentPreparationIntent(
      {
        subjectType: "ORDER",
        subjectId: "o",
        payerUserId: "u",
        currency: "ZAR",
        amount: LedgerMoney.parse("10.00"),
      },
      "4.00",
    );
    // Before-fix coordinator hash and helper hash were divergent; canonical requestHash unifies them
    expect(intent.legacyCoordinatorHash).not.toBe(intent.legacyWalletHelperHash);
    expect(intent.requestHash).not.toBe(intent.legacyCoordinatorHash);
    expect(intent.requestHash).not.toBe(intent.legacyWalletHelperHash);

    const legacyPersistedSplitRow = {
      ...row,
      amount: new Prisma.Decimal("6.00"),
      creationIdempotencyKey: "prepare:key:legacy-split",
      creationRequestHash: intent.legacyWalletHelperHash!,
      metadata: {
        subjectType: "ORDER",
        policyVersion: "phase10-payment-v1",
        walletSplit: true,
        walletAmount: "4.00",
        walletReserveJournalId: "jnl-legacy-res-1",
        walletReserveOperationId: "prepare:key:legacy-split",
        totalPayableAmount: "10.00",
        walletOwnerType: "CUSTOMER",
        walletOwnerId: "u",
      },
    };

    mocks.tx.payment.findUnique.mockResolvedValueOnce(legacyPersistedSplitRow);
    const replayed = await prepareOrderPayment(
      { id: "u", email: "payer@example.test" },
      { orderId: "o", idempotencyKey: "prepare:key:legacy-split", walletAmount: "4.00" },
    );
    expect(replayed.amount).toBe("6.00");

    // Reject if walletAmount changed on replay against legacy row
    mocks.tx.payment.findUnique.mockResolvedValueOnce(legacyPersistedSplitRow);
    await expect(
      prepareOrderPayment(
        { id: "u", email: "payer@example.test" },
        { orderId: "o", idempotencyKey: "prepare:key:legacy-split", walletAmount: "3.00" },
      ),
    ).rejects.toMatchObject({ code: "PAYMENT_IDEMPOTENCY_CONFLICT" });

    // Reject if legacy row is missing reserve journal evidence
    mocks.tx.payment.findUnique.mockResolvedValueOnce({
      ...legacyPersistedSplitRow,
      metadata: {
        ...legacyPersistedSplitRow.metadata,
        walletReserveJournalId: "",
      },
    });
    await expect(
      prepareOrderPayment(
        { id: "u", email: "payer@example.test" },
        { orderId: "o", idempotencyKey: "prepare:key:legacy-split", walletAmount: "4.00" },
      ),
    ).rejects.toMatchObject({ code: "PAYMENT_IDEMPOTENCY_CONFLICT" });
  });
});
