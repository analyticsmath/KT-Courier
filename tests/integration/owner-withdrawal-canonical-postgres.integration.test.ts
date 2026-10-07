import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { createDisposableOwnerWithdrawalSource, createDisposableDriverWithdrawalSource } from "@/scripts/e2e-owner-withdrawal-fixture";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import { createWithdrawalRequest, cancelWithdrawalRequest } from "@/lib/services/withdrawal-request.service";
import { getOwnerWithdrawal, getOwnerWithdrawalOverview, listOwnerPayoutDestinations } from "@/lib/services/withdrawal-query.service";
import { ensureWithdrawalAccounts } from "@/lib/services/withdrawal-account.service";
import { ensureWalletForOwner, ensureLedgerAccount } from "@/lib/services/wallet-account.service";

async function legacyDriverWallet(arbitrary: boolean) {
  const tag = randomUUID();
  const user = await prisma.user.create({ data: { email: `withdrawal-legacy-${tag}@example.test`, role: "DRIVER", status: "ACTIVE" } });
  const driver = await prisma.driverProfile.create({ data: { userId: user.id, driverCode: `LEGACY-${tag.slice(0, 20)}`, displayName: "Disposable legacy driver", active: true, status: "ACTIVE", onboardingStatus: "APPROVED" } });
  const wallet = await ensureWalletForOwner({ ownerType: "DRIVER", ownerId: driver.id, currency: "ZAR" });
  const source = await ensureLedgerAccount({ walletId: wallet.id, code: arbitrary ? `ARBITRARY-${tag}` : `OWN-WD-${wallet.id}`.toUpperCase(), purpose: "OWNER_WITHDRAWABLE", category: "LIABILITY", currency: "ZAR" });
  return { user, wallet, source };
}

describe("canonical owner withdrawal reserve/cancel on isolated PostgreSQL", { timeout: 20000 }, () => {
  beforeAll(() => requireDisposableStoreSettlementDatabase());
  it("projects only canonical owner funds and masked active destinations", async () => {
    const source = await createDisposableOwnerWithdrawalSource();
    const summary = await getOwnerWithdrawalOverview(source.ownerUserId);
    expect(summary).toMatchObject({ withdrawableBalance: "25.40", heldBalance: "0.00" });
    expect(summary.destinations).toHaveLength(1);
    expect(summary.destinations[0]).toMatchObject({ publicReference: source.destination.publicReference, maskedLabel: "Disposable destination ****1234", accountLast4: "1234" });
    expect(summary.destinations[0]).not.toHaveProperty("externalReference"); expect(summary.destinations[0]).not.toHaveProperty("walletId");
    await expect(listOwnerPayoutDestinations(source.customer.id)).rejects.toMatchObject({ code: "WITHDRAWAL_OWNER_INELIGIBLE" });
  });
  it("does not combine a driver's canonical wallet with a store wallet owned by that same user", async () => {
    const driver = await createDisposableDriverWithdrawalSource();
    const store = await prisma.store.create({ data: { ownerUserId: driver.driverUser.id, name: "Synthetic co-owned store", slug: driver.tag, status: "ACTIVE" } });
    const storeSource = await createDisposableOwnerWithdrawalSource({ storeId: store.id });
    const destination = driver.destination;
    const summary = await getOwnerWithdrawalOverview(driver.driverUser.id);
    expect(summary).toMatchObject({ withdrawableBalance: "25.40", heldBalance: "0.00" });
    expect(summary.destinations.map(record => record.publicReference)).toEqual([destination.publicReference]);
    expect(summary.destinations.map(record => record.publicReference)).not.toContain(storeSource.destination.publicReference);
    const request = await createWithdrawalRequest({ actorUserId: driver.driverUser.id, amount: "5.10", payoutDestinationPublicReference: destination.publicReference, operationId: `${driver.tag}:request` });
    expect(await getOwnerWithdrawalOverview(driver.driverUser.id)).toMatchObject({ withdrawableBalance: "20.30", heldBalance: "5.10" });
    await cancelWithdrawalRequest({ actorUserId: driver.driverUser.id, publicReference: request.publicReference, operationId: `${driver.tag}:cancel` });
    expect(await getOwnerWithdrawalOverview(driver.driverUser.id)).toMatchObject({ withdrawableBalance: "25.40", heldBalance: "0.00" });
  });
  it("reuses the pre-existing generic driver withdrawable identity across earning release and reserve/cancel", async () => {
    const legacy = await legacyDriverWallet(false);
    const driver = await createDisposableDriverWithdrawalSource({ email: legacy.user.email });
    expect(driver.accounts.ownerWithdrawable.id).toBe(legacy.source.id);
    const request = await createWithdrawalRequest({ actorUserId: legacy.user.id, amount: "5.10", payoutDestinationPublicReference: driver.destination.publicReference, operationId: `${driver.tag}:request` });
    await cancelWithdrawalRequest({ actorUserId: legacy.user.id, publicReference: request.publicReference, operationId: `${driver.tag}:cancel` });
    const saved = await prisma.ledgerAccount.findUniqueOrThrow({ where: { id: legacy.source.id } });
    expect(saved.code).toBe(legacy.source.code); expect(saved.currentBalance.toFixed(2)).toBe("25.40");
    expect(await prisma.ledgerAccount.count({ where: { walletId: legacy.wallet.id, purpose: "OWNER_WITHDRAWABLE" } })).toBe(1);
  });
  it("refuses an arbitrary existing driver withdrawable definition without renaming or crediting it", async () => {
    const legacy = await legacyDriverWallet(true);
    await expect(ensureWithdrawalAccounts({ walletId: legacy.wallet.id, ownerType: "DRIVER" })).rejects.toMatchObject({ code: "LEDGER_OWNER_INVALID" });
    const saved = await prisma.ledgerAccount.findUniqueOrThrow({ where: { id: legacy.source.id } });
    expect(saved.code).toBe(legacy.source.code); expect(saved.currentBalance.toFixed(2)).toBe("0.00");
    expect(await prisma.ledgerAccount.count({ where: { walletId: legacy.wallet.id, purpose: "OWNER_WITHDRAWABLE" } })).toBe(1);
  });
  it("an inactive owner cannot obtain balances or destinations from active wallet records", async () => {
    const source = await createDisposableOwnerWithdrawalSource();
    await prisma.user.update({ where: { id: source.ownerUserId }, data: { status: "SUSPENDED" } });
    await expect(getOwnerWithdrawalOverview(source.ownerUserId)).rejects.toMatchObject({ code: "WITHDRAWAL_OWNER_INELIGIBLE" });
    await expect(listOwnerPayoutDestinations(source.ownerUserId)).rejects.toMatchObject({ code: "WITHDRAWAL_OWNER_INELIGIBLE" });
  });
  it("concurrent same-operation requests reserve exactly once and changed replay conflicts", async () => {
    const source = await createDisposableOwnerWithdrawalSource();
    const command = { actorUserId: source.ownerUserId, amount: "5.10", payoutDestinationPublicReference: source.destination.publicReference, operationId: `${source.tag}:withdrawal` };
    const records = await Promise.all([createWithdrawalRequest(command), createWithdrawalRequest(command)]);
    expect(new Set(records.map(record => record.id)).size).toBe(1);
    const saved = await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: records[0].id }, include: { reserveLedgerJournal: true, earningAllocations: true } });
    expect(saved.amount.toFixed(2)).toBe("5.10"); expect(saved.reserveLedgerJournal.totalDebits.toFixed(2)).toBe("5.10"); expect(saved.reserveLedgerJournal.totalCredits.toFixed(2)).toBe("5.10");
    expect(saved.earningAllocations).toHaveLength(1);
    expect(await getOwnerWithdrawalOverview(source.ownerUserId)).toMatchObject({ withdrawableBalance: "20.30", heldBalance: "5.10" });
    await expect(createWithdrawalRequest({ ...command, amount: "5.11" })).rejects.toMatchObject({ code: "WITHDRAWAL_IDEMPOTENCY_CONFLICT" });
    expect(await prisma.withdrawalRequest.count({ where: { requestedByUserId: source.ownerUserId } })).toBe(1);
  });
  it("foreign destination and record access cannot consume another owner's funds", async () => {
    const source = await createDisposableOwnerWithdrawalSource(); const other = await createDisposableOwnerWithdrawalSource();
    const command = { actorUserId: source.ownerUserId, amount: "5.10", payoutDestinationPublicReference: other.destination.publicReference, operationId: `${source.tag}:withdrawal` };
    await expect(createWithdrawalRequest(command)).rejects.toMatchObject({ code: "WITHDRAWAL_DESTINATION_INVALID" });
    const record = await createWithdrawalRequest({ ...command, payoutDestinationPublicReference: source.destination.publicReference });
    expect(await getOwnerWithdrawal(other.ownerUserId, record.publicReference)).toBeNull();
    await expect(cancelWithdrawalRequest({ actorUserId: other.ownerUserId, publicReference: record.publicReference, operationId: `${other.tag}:cancel` })).rejects.toMatchObject({ code: "WITHDRAWAL_FORBIDDEN" });
    expect(await getOwnerWithdrawalOverview(other.ownerUserId)).toMatchObject({ withdrawableBalance: "25.40", heldBalance: "0.00" });
  });
  it("owner cancellation releases the exact reserve and earning allocation without payout", async () => {
    const source = await createDisposableOwnerWithdrawalSource();
    const record = await createWithdrawalRequest({ actorUserId: source.ownerUserId, amount: "5.10", payoutDestinationPublicReference: source.destination.publicReference, operationId: `${source.tag}:withdrawal` });
    await cancelWithdrawalRequest({ actorUserId: source.ownerUserId, publicReference: record.publicReference, operationId: `${source.tag}:cancel` });
    const saved = await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: record.id }, include: { releaseLedgerJournal: true, earningAllocations: true } });
    expect(saved.status).toBe("CANCELLED"); expect(saved.payoutLedgerJournalId).toBeNull();
    expect(saved.releaseLedgerJournal!.totalDebits.toFixed(2)).toBe("5.10"); expect(saved.releaseLedgerJournal!.totalCredits.toFixed(2)).toBe("5.10");
    expect(saved.earningAllocations.every(allocation => allocation.status === "CANCELLED")).toBe(true);
    expect(await getOwnerWithdrawalOverview(source.ownerUserId)).toMatchObject({ withdrawableBalance: "25.40", heldBalance: "0.00" });
    const detail = await getOwnerWithdrawal(source.ownerUserId, record.publicReference);
    expect(detail).toMatchObject({ status: "CANCELLED", canCancel: false });
    for (const key of ["id", "walletId", "sourceAccountId", "heldAccountId", "reserveLedgerJournalId"]) expect(detail).not.toHaveProperty(key);
  });
});
