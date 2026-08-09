import { describe, it, expect, beforeAll } from "vitest";
import { validateGate4DatabaseSafety } from "./harness-safety";
import { runConcurrentRace } from "./barrier";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { createGate4FundedStoreWalletScenario, createGate4MarketplaceStoreOrderScenario, requireGate4Fixture } from "./fixtures";
import { accrueStoreEarning } from "@/lib/services/store-earning-accrual.service";

describe("Gate 4 — Earnings, Settlements and Withdrawals Suite", () => {
  let safety: ReturnType<typeof validateGate4DatabaseSafety>;

  beforeAll(() => {
    safety = validateGate4DatabaseSafety();
  });

  it("G4-LED-002 [Withdrawal Over-Reservation]: Two concurrent $80 withdrawals against a $100 balance yield 1 success and 1 fail", async () => {
    if (!safety.ok) {
      console.warn(`[SKIP_DB_EXECUTION] ${safety.reason}`);
      return;
    }

    const { tag, store, ownerId, wallet, account } = await createGate4FundedStoreWalletScenario("earnings-wdr", "over-reservation", "100.00");
    requireGate4Fixture(wallet, "Funded wallet fixture required");
    requireGate4Fixture(account, "Ledger account fixture required");

    const walletId = wallet.id;

    // Pre-requisite held account for withdrawal reserves
    const heldAccount = await prisma.ledgerAccount.upsert({
      where: { code: `WITHDRAWAL_HELD_${walletId}`.slice(0, 50) },
      update: {},
      create: {
        walletId,
        code: `WITHDRAWAL_HELD_${walletId}`.slice(0, 50),
        purpose: "HELD",
        category: "LIABILITY",
        currency: "ZAR",
        allowNegative: false,
      },
    });

    const payoutDestination = await prisma.payoutDestination.create({
      data: {
        publicReference: `dest_${tag}`,
        walletId,
        ownerType: "STORE",
        ownerId: store.id,
        method: "MANUAL_EXTERNAL",
        providerCode: "MANUAL_FINANCE",
        externalReference: `manual-finance:${tag.replace(/[^A-Za-z0-9]/g, "_")}`,
        maskedLabel: "****1234",
        status: "ACTIVE",
        currency: "ZAR",
      },
    });

    const reserveJournal1 = await prisma.ledgerJournal.create({
      data: {
        reference: `jnl_res1_${tag}`,
        type: "WITHDRAWAL_RESERVE",
        currency: "ZAR",
        idempotencyKey: `idem_res1_${tag}`,
        requestHash: "0".repeat(64),
        policyVersion: "v1",
        totalDebits: new Prisma.Decimal("80.00"),
        totalCredits: new Prisma.Decimal("80.00"),
      },
    });

    const reserveJournal2 = await prisma.ledgerJournal.create({
      data: {
        reference: `jnl_res2_${tag}`,
        type: "WITHDRAWAL_RESERVE",
        currency: "ZAR",
        idempotencyKey: `idem_res2_${tag}`,
        requestHash: "0".repeat(64),
        policyVersion: "v1",
        totalDebits: new Prisma.Decimal("80.00"),
        totalCredits: new Prisma.Decimal("80.00"),
      },
    });

    const reserveJournals = [reserveJournal1, reserveJournal2];

    const results = await runConcurrentRace(2, async (client, _index, barrier) => {
      await barrier.wait();

      return client.$transaction(
        async (tx) => {
          const lockedAccount = await tx.ledgerAccount.findUnique({
            where: { id: account.id },
          });

          if (!lockedAccount || lockedAccount.currentBalance.lessThan(new Prisma.Decimal("80.00"))) {
            throw new Error("INSUFFICIENT_FUNDS: Available balance is insufficient for withdrawal");
          }

          const request = await tx.withdrawalRequest.create({
            data: {
              publicReference: `wdr_${_index}_${tag}`,
              walletId,
              ownerType: "STORE",
              ownerId: store.id,
              sourceAccountId: account.id,
              heldAccountId: heldAccount.id,
              payoutDestinationId: payoutDestination.id,
              amount: new Prisma.Decimal("80.00"),
              currency: "ZAR",
              status: "REQUESTED",
              creationIdempotencyKey: `idem_wdr_${_index}_${tag}`,
              creationRequestHash: "0".repeat(64),
              policyVersion: 1,
              reserveLedgerJournalId: reserveJournals[_index].id,
              requestedByUserId: ownerId,
            },
          });

          await tx.ledgerAccount.update({
            where: { id: account.id },
            data: { currentBalance: { decrement: new Prisma.Decimal("80.00") } },
          });

          return request;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    });

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const finalAccount = await prisma.ledgerAccount.findUnique({ where: { id: account.id } });
    expect(finalAccount?.currentBalance.toString()).toBe("20");
  });

  it("G4-LED-002 [Store Earning Exactly Once]: Duplicate accruals for same store order return existing store earning", async () => {
    if (!safety.ok) return;

    const { storeOrder: order, store, payment } = await createGate4MarketplaceStoreOrderScenario("earnings-wdr", "store-earning");
    requireGate4Fixture(order, "Store order fixture required");

    const wallet = await prisma.wallet.upsert({
      where: { ownerType_ownerId_currency: { ownerType: "STORE", ownerId: order.storeId, currency: "ZAR" } },
      update: {},
      create: {
        ownerType: "STORE",
        ownerId: order.storeId,
        currency: "ZAR",
        status: "ACTIVE",
      },
    });

    const operationId = `op-ste-g4-${order.id}`.slice(0, 100);

    const snapshot = {
      subjectType: "MARKETPLACE_ORDER" as const,
      subjectId: order.id,
      subjectPublicReference: order.publicReference,
      storeId: order.storeId,
      storePublicReference: store.slug,
      walletId: wallet.id,
      paymentId: payment.id,
      paymentPublicReference: payment.publicReference,
      settlementReference: `stl_ref_${order.id}`,
      settlementVersion: "1.0",
      calculationVersion: "1.0",
      authoritativeAt: new Date().toISOString(),
      sellerSettlementBasisAmount: "100.00",
      attributedCommissionAmount: "0.00",
      netStoreEarningAmount: "100.00",
      currency: "ZAR" as const,
      commissionCharges: [],
    };

    const results = await runConcurrentRace(3, async (_client, _index, barrier) => {
      await barrier.wait();
      return await accrueStoreEarning(
        { operationId, snapshot },
        { allowTestOnlyBypass: true }
      );
    });

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled.length).toBe(3);

    const firstResult = (fulfilled[0] as { value: { id: string } }).value;
    for (const res of fulfilled) {
      expect((res as { value: { id: string } }).value.id).toBe(firstResult.id);
    }

    const count = await prisma.storeEarning.count({ where: { creationIdempotencyKey: operationId } });
    expect(count).toBe(1);
  });
});
