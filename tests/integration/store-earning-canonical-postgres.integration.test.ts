import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createDisposableStoreSettlement } from "@/scripts/e2e-store-settlement-fixture";
import { requireDisposableDriverSettlementDatabase } from "@/scripts/disposable-driver-settlement-guard";
import { accrueStoreEarning } from "@/lib/services/store-earning-accrual.service";
import { releaseStoreEarning } from "@/lib/services/store-earning-release.service";
import { getStoreEarningForOwner } from "@/lib/services/store-earning-query.service";

const isolated = { allowTestOnlyBypass: true } as const;
async function accrued() {
  const source = await createDisposableStoreSettlement();
  const command = { operationId: `${source.tag}:accrue`, snapshot: source.snapshot };
  return { source, command, earning: await accrueStoreEarning(command, isolated) };
}
async function balances(source: Awaited<ReturnType<typeof createDisposableStoreSettlement>>) {
  const payable = await prisma.ledgerAccount.findUniqueOrThrow({ where: { id: source.accounts.account.id } });
  const withdrawable = await prisma.ledgerAccount.findUniqueOrThrow({ where: { id: source.withdrawable.id } });
  return { payable: payable.currentBalance.toFixed(2), withdrawable: withdrawable.currentBalance.toFixed(2) };
}
describe("canonical store accrual/release on isolated PostgreSQL", () => {
  beforeAll(() => { requireDisposableDriverSettlementDatabase(); if (new URL(process.env.DATABASE_URL!).pathname !== "/kt_launch_test") throw new Error("Disposable closure database required."); });
  it("concurrent identical accruals produce one earning and one balanced journal", async () => {
    const source = await createDisposableStoreSettlement(); const operationId = `${source.tag}:accrue`;
    const results = await Promise.all(Array.from({ length: 3 }, () => accrueStoreEarning({ operationId, snapshot: source.snapshot }, isolated)));
    expect(new Set(results.map(row => row.id)).size).toBe(1);
    expect(await prisma.storeEarning.count({ where: { creationIdempotencyKey: operationId } })).toBe(1);
    const row = await prisma.storeEarning.findUniqueOrThrow({ where: { id: results[0].id }, include: { accrualLedgerJournal: { include: { entries: true } } } });
    expect(row.accrualLedgerJournal.entries).toHaveLength(2);
    expect(row.accrualLedgerJournal.totalDebits.toFixed(2)).toBe("100.25"); expect(row.accrualLedgerJournal.totalCredits.toFixed(2)).toBe("100.25");
    expect(await balances(source)).toEqual({ payable: "100.25", withdrawable: "0.00" });
  });
  it("rejects changed replay facts and a second operation for the same settlement without financial drift", async () => {
    const { source, earning, command } = await accrued(); const before = await balances(source);
    await expect(accrueStoreEarning({ ...command, snapshot: { ...source.snapshot, sellerSettlementBasisAmount: "100.26", netStoreEarningAmount: "100.26" } }, isolated)).rejects.toMatchObject({ code: "STORE_EARNING_IDEMPOTENCY_CONFLICT" });
    await expect(accrueStoreEarning({ ...command, operationId: `${source.tag}:different` }, isolated)).rejects.toMatchObject({ code: "STORE_EARNING_SETTLEMENT_ALREADY_ACCRUED" });
    expect(await balances(source)).toEqual(before); expect(await prisma.storeEarning.count({ where: { storeId: source.store.id } })).toBe(1);
    expect((await prisma.storeEarning.findUniqueOrThrow({ where: { id: earning.id } })).amount.toFixed(2)).toBe("100.25");
  });
  it("binds safe owner details to the store and does not expose finance identities", async () => {
    const { source, earning } = await accrued(); const other = await createDisposableStoreSettlement();
    const detail = await getStoreEarningForOwner(source.ownerUserId, earning.publicReference);
    expect(detail).toMatchObject({ originalEarningAmount: "100.25", releasedAmount: "0.00", availablePayableAmount: "100.25" });
    for (const field of ["id", "walletId", "payableAccountId", "customerId", "paymentId", "storeId"]) expect(detail).not.toHaveProperty(field);
    expect(await getStoreEarningForOwner(other.ownerUserId, earning.publicReference)).toBeNull();
  });
  it("requires source maturity, then concurrent release posts exactly the remaining payable once", async () => {
    const { source, earning } = await accrued(); const command = { earningId: earning.id, operationId: `${source.tag}:release` };
    await expect(releaseStoreEarning(command, isolated)).rejects.toMatchObject({ code: "STORE_EARNING_RELEASE_NOT_ELIGIBLE" });
    // This is a synthetic source maturity fact, not approval of a production hold policy.
    await prisma.storeEarning.update({ where: { id: earning.id }, data: { releaseEligibleAt: new Date("2026-10-02T12:00:00Z") } });
    const results = await Promise.all([releaseStoreEarning(command, isolated), releaseStoreEarning(command, isolated)]);
    expect(new Set(results.map(row => row.releaseLedgerJournalReference)).size).toBe(1);
    expect(await balances(source)).toEqual({ payable: "0.00", withdrawable: "100.25" });
    const saved = await prisma.storeEarning.findUniqueOrThrow({ where: { id: earning.id }, include: { releaseLedgerJournal: { include: { entries: true } }, statusHistory: true } });
    expect(saved.status).toBe("RELEASED"); expect(saved.releasedAmount.toFixed(2)).toBe("100.25");
    expect(saved.releaseLedgerJournal!.entries).toHaveLength(2); expect(saved.releaseLedgerJournal!.totalDebits.toFixed(2)).toBe("100.25");
    expect(saved.releaseLedgerJournal!.totalCredits.toFixed(2)).toBe("100.25"); expect(saved.statusHistory.filter(row => row.reasonCode === "RELEASE_COMPLETED")).toHaveLength(1);
  });
  it("keeps production execution locked and rejects a suspended store without moving funds", async () => {
    const { source, earning } = await accrued(); const command = { earningId: earning.id, operationId: `${source.tag}:release` };
    await expect(releaseStoreEarning(command)).rejects.toMatchObject({ code: "STORE_EARNING_PRODUCTION_LOCKED" });
    await prisma.storeEarning.update({ where: { id: earning.id }, data: { releaseEligibleAt: new Date("2026-10-02T12:00:00Z") } });
    await prisma.store.update({ where: { id: source.store.id }, data: { status: "SUSPENDED" } });
    await expect(releaseStoreEarning(command, isolated)).rejects.toMatchObject({ code: "STORE_EARNING_RELEASE_NOT_ELIGIBLE" });
    expect(await balances(source)).toEqual({ payable: "100.25", withdrawable: "0.00" });
  });
  it("rolls back release journal and balances if the earning update fails", async () => {
    const { source, earning } = await accrued();
    await prisma.storeEarning.update({ where: { id: earning.id }, data: { releaseEligibleAt: new Date("2026-10-02T12:00:00Z") } });
    const before = await prisma.storeEarning.findUniqueOrThrow({ where: { id: earning.id } }); const identifier = `closure_store_${randomUUID().replaceAll("-", "")}`;
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${identifier}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.id = '${earning.id}' THEN RAISE EXCEPTION 'DISPOSABLE_STORE_EARNING_WRITE_FAILURE'; END IF; RETURN NEW; END $$`);
    try {
      await prisma.$executeRawUnsafe(`CREATE TRIGGER "${identifier}" BEFORE UPDATE ON "StoreEarning" FOR EACH ROW EXECUTE FUNCTION "${identifier}"()`);
      await expect(releaseStoreEarning({ earningId: earning.id, operationId: `${source.tag}:release` }, isolated)).rejects.toThrow("DISPOSABLE_STORE_EARNING_WRITE_FAILURE");
      expect(await prisma.storeEarning.findUniqueOrThrow({ where: { id: earning.id } })).toEqual(before);
      expect(await balances(source)).toEqual({ payable: "100.25", withdrawable: "0.00" });
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${identifier}" ON "StoreEarning"`); await prisma.$executeRawUnsafe(`DROP FUNCTION "${identifier}"()`);
    }
  });
});
