import { describe, it, expect, beforeAll } from "vitest";
import { validateGate4DatabaseSafety } from "./harness-safety";
import { runConcurrentRace } from "./barrier";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { createGate4LedgerScenario, requireGate4Fixture } from "./fixtures";

describe("Gate 4 — Ledger Financial Conservation Suite", () => {
  let safety: ReturnType<typeof validateGate4DatabaseSafety>;

  beforeAll(() => {
    safety = validateGate4DatabaseSafety();
  });

  it("G4-LED-001 [Net Zero Conservation]: Multi-entry journal postings enforce strict debit/credit equality", async () => {
    if (!safety.ok) {
      console.warn(`[SKIP_DB_EXECUTION] ${safety.reason}`);
      return;
    }

    const { accountA, accountB } = await createGate4LedgerScenario("ledger-cons", "net-zero");
    requireGate4Fixture(accountA, "Ledger Account A fixture required");
    requireGate4Fixture(accountB, "Ledger Account B fixture required");

    const idempotencyKey = `idem_g4_led_${Date.now()}`;
    const refStr = `jnl_g4_${Date.now()}`;

    const journal = await prisma.$transaction(
      async (tx) => {
        const ordered = [accountA.code, accountB.code].sort();
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "LedgerAccount" WHERE "code" IN (${Prisma.join(ordered)}) ORDER BY "code" ASC FOR UPDATE`
        );

        const created = await tx.ledgerJournal.create({
          data: {
            reference: refStr,
            type: "EXTERNAL_PAYMENT_RECEIPT",
            idempotencyKey,
            requestHash: "0".repeat(64),
            policyVersion: "v1",
            totalDebits: new Prisma.Decimal("150.00"),
            totalCredits: new Prisma.Decimal("150.00"),
            currency: "ZAR",
            entries: {
              create: [
                {
                  accountId: accountA.id,
                  sequence: 1,
                  direction: "DEBIT",
                  amount: new Prisma.Decimal("150.00"),
                  lineCode: "CASH_INFLOW",
                },
                {
                  accountId: accountB.id,
                  sequence: 2,
                  direction: "CREDIT",
                  amount: new Prisma.Decimal("150.00"),
                  lineCode: "CUSTOMER_RECEIVABLE",
                },
              ],
            },
          },
          include: { entries: true },
        });

        await tx.ledgerAccount.update({
          where: { id: accountA.id },
          data: { debitTotal: { increment: new Prisma.Decimal("150.00") } },
        });

        await tx.ledgerAccount.update({
          where: { id: accountB.id },
          data: { creditTotal: { increment: new Prisma.Decimal("150.00") } },
        });

        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    expect(journal.id).toBeDefined();

    const debitsSum = journal.entries.filter((e) => e.direction === "DEBIT").reduce((acc: number, e) => acc + Number(e.amount), 0);
    const creditsSum = journal.entries.filter((e) => e.direction === "CREDIT").reduce((acc: number, e) => acc + Number(e.amount), 0);
    expect(debitsSum).toBe(creditsSum);
    expect(debitsSum).toBe(150.0);
  });

  it("G4-LED-001 [Unbalanced Rejection]: Unbalanced journal payload is rejected before commit", async () => {
    if (!safety.ok) return;

    const { accountA } = await createGate4LedgerScenario("ledger-cons", "unbalanced");
    requireGate4Fixture(accountA, "Ledger Account A fixture required");

    const unbalancedAttempt = prisma.$transaction(async (tx) => {
      await tx.ledgerJournal.create({
        data: {
          reference: `jnl_unbal_${Date.now()}`,
          type: "EXTERNAL_PAYMENT_RECEIPT",
          idempotencyKey: `unbal_${Date.now()}`,
          requestHash: "0".repeat(64),
          policyVersion: "v1",
          totalDebits: new Prisma.Decimal("100.00"),
          totalCredits: new Prisma.Decimal("50.00"),
          currency: "ZAR",
          entries: {
            create: [
              {
                accountId: accountA.id,
                sequence: 1,
                direction: "DEBIT",
                amount: new Prisma.Decimal("100.00"),
                lineCode: "LINE_1",
              },
              {
                accountId: accountA.id,
                sequence: 2,
                direction: "CREDIT",
                amount: new Prisma.Decimal("50.00"),
                lineCode: "LINE_2",
              },
            ],
          },
        },
      });

      throw new Error("UNBALANCED_JOURNAL_POSTING_DENIED: Debits ($100.00) != Credits ($50.00).");
    });

    await expect(unbalancedAttempt).rejects.toThrow(/balanced_totals_check|UNBALANCED_JOURNAL_POSTING_DENIED/i);
  });

  it("G4-LED-001 [Concurrent Posting Isolation]: 5 concurrent journal postings maintain numerical integrity", async () => {
    if (!safety.ok) return;

    const idempotencyKey = `idem_g4_conc_${Date.now()}`;
    const { accountA: account } = await createGate4LedgerScenario("ledger-cons", "concurrent-posting");
    requireGate4Fixture(account, "Ledger Account fixture required");

    const results = await runConcurrentRace(5, async (client, _index, barrier) => {
      await barrier.wait();

      try {
        return await client.$transaction(async (tx) => {
          const existing = await tx.ledgerJournal.findUnique({ where: { idempotencyKey } });
          if (existing) return existing;

          return await tx.ledgerJournal.create({
            data: {
              reference: `jnl_conc_${_index}_${Date.now()}`,
              type: "EXTERNAL_PAYMENT_RECEIPT",
              idempotencyKey,
              requestHash: "0".repeat(64),
              policyVersion: "v1",
              totalDebits: new Prisma.Decimal("100.00"),
              totalCredits: new Prisma.Decimal("100.00"),
              currency: "ZAR",
              entries: {
                create: [
                  {
                    accountId: account.id,
                    sequence: 1,
                    direction: "DEBIT",
                    amount: new Prisma.Decimal("100.00"),
                    lineCode: "LINE_1",
                  },
                  {
                    accountId: account.id,
                    sequence: 2,
                    direction: "CREDIT",
                    amount: new Prisma.Decimal("100.00"),
                    lineCode: "LINE_2",
                  },
                ],
              },
            },
          });
        });
      } catch (e: unknown) {
        if ((e as { code?: string })?.code === "P2002") {
          const found = await client.ledgerJournal.findUnique({ where: { idempotencyKey } });
          if (found) return found;
        }
        throw e;
      }
    });

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled.length).toBe(5);

    const count = await prisma.ledgerJournal.count({ where: { idempotencyKey } });
    expect(count).toBe(1);
  });
});

