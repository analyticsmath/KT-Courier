import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import { creditCustomerWalletBySuperAdmin } from "@/lib/services/admin-customer-wallet-grant.service";
import { getCustomerWalletSummary, listCustomerWalletTransactions } from "@/lib/services/customer-wallet.service";

describe("real PostgreSQL superuser customer-wallet grants and ledger authority", () => {
  const ids = { actor: "", customer: "", secondCustomer: "", nonAdmin: "" };
  beforeAll(async () => {
    requireDisposableStoreSettlementDatabase();
    const salt = randomUUID();
    const users = await Promise.all([
      prisma.user.create({ data: { email: "grant-owner-" + salt + "@example.test", role: "SUPER_ADMIN", status: "ACTIVE" } }),
      prisma.user.create({ data: { email: "grant-customer-" + salt + "@example.test", role: "CUSTOMER", status: "ACTIVE" } }),
      prisma.user.create({ data: { email: "grant-second-" + salt + "@example.test", role: "CUSTOMER", status: "ACTIVE" } }),
      prisma.user.create({ data: { email: "grant-foreign-" + salt + "@example.test", role: "ADMIN", status: "ACTIVE" } }),
    ]);
    [ids.actor, ids.customer, ids.secondCustomer, ids.nonAdmin] = users.map(u => u.id);
  });
  afterAll(async () => {
    // Immutable journal records are retained in this disposable database.
    // Never delete or relax production financial triggers for test cleanup.
    await prisma.$disconnect();
  });

  const input = () => ({
    actorUserId: ids.actor,
    customerUserId: ids.customer,
    amount: "50.00",
    reason: "Owner-approved first-time customer courtesy credit",
    operationId: "superadmin-wallet-" + randomUUID(),
  });
  let firstGrant: ReturnType<typeof input>;

  it("posts exactly one two-sided platform expense / customer liability journal with visible balance", async () => {
    firstGrant = input();
    const [first, same] = await Promise.all([
      creditCustomerWalletBySuperAdmin(firstGrant),
      creditCustomerWalletBySuperAdmin(firstGrant),
    ]);
    expect(new Set([first.status, same.status])).toEqual(new Set(["CREDITED", "REPLAYED"]));
    expect(first.journalId).toBe(same.journalId);
    expect(first.amount).toBe("50.00");
    expect(first.availableBalanceAfter).toBe("50.00");

    const journal = await prisma.ledgerJournal.findUniqueOrThrow({
      where: { id: first.journalId },
      include: { entries: { include: { account: { include: { wallet: true } } } } },
    });
    expect(journal.type).toBe("GENERAL");
    expect(journal.createdByUserId).toBe(ids.actor);
    expect(journal.memo).toContain(firstGrant.reason);
    expect(journal.totalDebits.toFixed(2)).toBe("50.00");
    expect(journal.totalCredits.toFixed(2)).toBe("50.00");
    expect(journal.entries).toHaveLength(2);
    expect(journal.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ direction: "DEBIT", account: expect.objectContaining({
        purpose: "PLATFORM_PROMOTION_EXPENSE", category: "EXPENSE", wallet: expect.objectContaining({ ownerType: "PLATFORM" }),
      }) }),
      expect.objectContaining({ direction: "CREDIT", account: expect.objectContaining({
        purpose: "CUSTOMER_WALLET_AVAILABLE", category: "LIABILITY", wallet: expect.objectContaining({ ownerType: "CUSTOMER", ownerId: ids.customer }),
      }) }),
    ]));
    expect(await getCustomerWalletSummary(ids.customer)).toMatchObject({
      availableBalance: "50.00", refundHeldBalance: "0.00", spendingEnabled: true,
    });
    const transactions = await listCustomerWalletTransactions(ids.customer, { page: 1, pageSize: 5 });
    expect(transactions.pagination.total).toBe(1);
    expect(transactions.data[0]).toMatchObject({ direction: "CREDIT", amount: "50.00", type: "GENERAL" });
  });

  it("prevents altered replay and reuse of a global operation ID for another recipient", async () => {
    await expect(creditCustomerWalletBySuperAdmin({ ...firstGrant, amount: "60.00" }))
      .rejects.toMatchObject({ code: "LEDGER_IDEMPOTENCY_CONFLICT" });
    await expect(creditCustomerWalletBySuperAdmin({ ...firstGrant, customerUserId: ids.secondCustomer }))
      .rejects.toMatchObject({ code: "LEDGER_IDEMPOTENCY_CONFLICT" });
    expect((await getCustomerWalletSummary(ids.customer)).availableBalance).toBe("50.00");
    expect((await getCustomerWalletSummary(ids.secondCustomer)).availableBalance).toBe("0.00");
  });

  it("rejects an ordinary admin and a suspended customer with no ledger mutation", async () => {
    await expect(creditCustomerWalletBySuperAdmin({ ...input(), actorUserId: ids.nonAdmin }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await prisma.user.update({ where: { id: ids.secondCustomer }, data: { status: "SUSPENDED" } });
    await expect(creditCustomerWalletBySuperAdmin({ ...input(), customerUserId: ids.secondCustomer }))
      .rejects.toMatchObject({ code: "CUSTOMER_NOT_FOUND" });
    expect((await getCustomerWalletSummary(ids.customer)).availableBalance).toBe("50.00");
  });
});
