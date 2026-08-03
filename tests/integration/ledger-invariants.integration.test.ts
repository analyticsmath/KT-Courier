import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { afterAll, describe, expect, it } from "vitest";
import { UserRole } from "@/types/db";
import { acceptDispatchAssignment, offerAssignment } from "@/lib/services/dispatch-assignment.service";
import { completePickup } from "@/lib/services/pickup-custody.service";
import { adminManualDeliveryComplete, startDelivery } from "@/lib/services/delivery-execution.service";
import { createDispatchOrder, createDriver, createRegion, createUser, disconnectIntegrationPrisma } from "./phase7-5-fixtures";
import { createCustomerAsset, ledgerPrisma, ledgerTag } from "./ledger-fixtures";

afterAll(async () => {
  await Promise.all([ledgerPrisma.$disconnect(), disconnectIntegrationPrisma()]);
});

describe("Phase 9 live ledger invariants", () => {
  it("detects a deliberately tampered projection in the disposable database", async () => {
    const customer = await createCustomerAsset("invariant-tamper");
    await ledgerPrisma.ledgerAccount.update({ where: { id: customer.account.id }, data: { currentBalance: "1.00" } });
    try {
      const result = spawnSync(process.execPath, ["scripts/verify-ledger-invariants.mjs"], { cwd: process.cwd(), env: process.env, encoding: "utf8", shell: false });
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toContain("account current balance projections match entries");
    } finally {
      await ledgerPrisma.ledgerAccount.update({ where: { id: customer.account.id }, data: { currentBalance: "0.00" } });
    }
  });

  it("keeps the twice-seeded platform wallet, codes, and zero-evidence accounts consistent", async () => {
    expect(await ledgerPrisma.wallet.count({ where: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" } })).toBe(1);
    const platformAccounts = await ledgerPrisma.ledgerAccount.findMany({ where: { wallet: { ownerType: "PLATFORM", ownerId: "platform" } } });
    expect(new Set(platformAccounts.map((account) => account.code)).size).toBe(platformAccounts.length);
    for (const account of platformAccounts.filter((item) => item.currentBalance.isZero() && item.debitTotal.isZero() && item.creditTotal.isZero())) {
      expect(await ledgerPrisma.ledgerEntry.count({ where: { accountId: account.id } })).toBe(0);
    }
  });

  it("completes a delivery without creating a financial journal", async () => {
    const tag = ledgerTag("cross-module");
    const admin = await createUser(`${tag}-admin`, UserRole.ADMIN);
    const customer = await createUser(`${tag}-customer`, UserRole.CUSTOMER);
    const region = await createRegion(tag);
    const driver = await createDriver(`${tag}-driver`, region.id);
    const order = await createDispatchOrder(tag, customer.id, region.id);
    const offered = await offerAssignment(admin.id, order.id, { driverProfileId: driver.profile.id, reasonCode: "INITIAL" });
    const accepted = await acceptDispatchAssignment(driver.profile.id, offered.id, { expectedVersion: offered.version });
    await completePickup(accepted.id, driver.profile.id, driver.user.id, { operationId: randomUUID(), assignmentVersion: accepted.version, parcelCount: 1, parcelCondition: "GOOD", confirmPickup: true });
    const pickedUp = await ledgerPrisma.orderAssignment.findUniqueOrThrow({ where: { id: accepted.id } });
    await startDelivery(accepted.id, driver.profile.id, driver.user.id, { operationId: randomUUID(), assignmentVersion: pickedUp.version });
    const journalCountBefore = await ledgerPrisma.ledgerJournal.count();
    expect(await adminManualDeliveryComplete(order.id, admin.id, UserRole.ADMIN, { recipientName: "Ledger Test", reason: "Phase 9 cross-module non-posting verification" })).toEqual({ ok: true });
    expect(await ledgerPrisma.ledgerJournal.count()).toBe(journalCountBefore);
  });
});
