import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createDisposableDriverSettlement } from "@/scripts/e2e-driver-settlement-fixture";
import { accrueDriverEarning } from "@/lib/services/driver-earning-accrual.service";
import { releaseDriverEarning } from "@/lib/services/driver-earning-release.service";
import { getDriverEarningForOwner, listDriverEarningsForOwner } from "@/lib/services/driver-earning-query.service";
import { getDriverEarningSummaryForOwner } from "@/lib/services/driver-earning-summary.service";

describe("driver earning canonical services on isolated PostgreSQL", () => {
  it("rejects a mismatched payment reference without creating an earning or accrual journal", async () => {
    const source = await createDisposableDriverSettlement();
    await expect(accrueDriverEarning({ operationId: source.tag, snapshot: { ...source.snapshot, paymentPublicReference: "PAY-MISMATCHED-REFERENCE" } })).rejects.toMatchObject({ code: "DRIVER_EARNING_PAYMENT_INVALID" });
    expect(await prisma.driverEarning.count({ where: { assignmentId: source.assignment.id } })).toBe(0);
    expect((await prisma.ledgerAccount.findUniqueOrThrow({ where: { id: source.accounts.account.id } })).currentBalance.toFixed(2)).toBe("0.00");
  });
  it("posts exact balanced accrual, returns safe owner evidence and preserves source history", async () => {
    const source = await createDisposableDriverSettlement();
    const earning = await accrueDriverEarning({ operationId: source.tag, snapshot: source.snapshot });
    expect(earning).toMatchObject({ status: "ACCRUED", amount: "100.25", currency: "ZAR", settlementBasisAmount: "100.25", attributedCommissionAmount: "0.00" });
    const journal = await prisma.ledgerJournal.findUniqueOrThrow({ where: { reference: earning.accrualLedgerJournalReference }, include: { entries: true } });
    expect(journal.entries).toHaveLength(2); expect(journal.totalDebits.toFixed(2)).toBe("100.25"); expect(journal.totalCredits.toFixed(2)).toBe("100.25");
    const detail = await getDriverEarningForOwner(source.driverUser.id, earning.publicReference);
    expect(detail).toMatchObject({ originalEarningAmount: "100.25", availablePayableAmount: "100.25", refundReservedAmount: "0.00", releasedAmount: "0.00", productionLock: { active: false, blockReason: null } });
    expect(detail?.history.map(event => event.reasonCode)).toEqual(["ACCRUAL_POSTED", "COMMISSION_CHARGES_ATTRIBUTED"]);
    for (const field of ["id", "driverId", "walletId", "payableAccountId", "paymentId", "customer", "journals", "safeMetadata", "latitude", "proofOfDelivery"]) expect(detail).not.toHaveProperty(field);
    expect(JSON.stringify(detail)).not.toMatch(/PRIVATE_CUSTOMER|PRIVATE_RECIPIENT|PRIVATE_POD/);
    expect(await getDriverEarningSummaryForOwner(source.driverUser.id)).toMatchObject({ totalAccrued: "100.25", payableBalance: "100.25", refundReserved: "0.00", releaseEligible: "100.25", releasedToOwnerWithdrawable: "0.00" });
  });
  it("concurrent same-operation accrual yields one earning, journal and financial projection", async () => {
    const source = await createDisposableDriverSettlement();
    const command = { operationId: source.tag, snapshot: source.snapshot };
    const results = await Promise.all([accrueDriverEarning(command), accrueDriverEarning(command), accrueDriverEarning(command)]);
    expect(new Set(results.map(row => row.id)).size).toBe(1);
    expect(await prisma.driverEarning.count({ where: { assignmentId: source.assignment.id } })).toBe(1);
    expect(await prisma.ledgerJournal.count({ where: { sourceReference: `DRIVER-EARNING:${results[0]!.publicReference}:ACCRUE` } })).toBe(1);
    expect((await prisma.ledgerAccount.findUniqueOrThrow({ where: { id: source.accounts.account.id } })).currentBalance.toFixed(2)).toBe("100.25");
    const before = await prisma.ledgerAccount.findUniqueOrThrow({ where: { id: source.accounts.account.id } });
    await expect(accrueDriverEarning({ ...command, snapshot: { ...source.snapshot, driverSettlementBasisAmount: "101.25", netDriverEarningAmount: "101.25" } })).rejects.toMatchObject({ code: "DRIVER_EARNING_IDEMPOTENCY_CONFLICT" });
    expect(await prisma.ledgerAccount.findUniqueOrThrow({ where: { id: source.accounts.account.id } })).toEqual(before);
  });
  it("release transfers exact liability once and retains immutable accrual/history", async () => {
    const source = await createDisposableDriverSettlement({ amount: "25.40" });
    const earning = await accrueDriverEarning({ operationId: source.tag, snapshot: source.snapshot });
    const input = { earningId: earning.id, operationId: `${source.tag}:release` };
    expect(await releaseDriverEarning(input)).toMatchObject({ status: "RELEASED", releasedAmount: "25.40", idempotent: false });
    const canonical = await prisma.driverEarning.findUniqueOrThrow({ where: { id: earning.id }, include: { releaseLedgerJournal: true } });
    expect(canonical.releaseLedgerJournal).not.toBeNull();
    expect(await releaseDriverEarning(input)).toMatchObject({ releaseLedgerJournalReference: canonical.releaseLedgerJournal!.reference, idempotent: true });
    expect((await prisma.ledgerAccount.findUniqueOrThrow({ where: { id: source.accounts.account.id } })).currentBalance.toFixed(2)).toBe("0.00");
    expect((await prisma.ledgerAccount.findUniqueOrThrow({ where: { id: source.accounts.ownerWithdrawable.id } })).currentBalance.toFixed(2)).toBe("25.40");
    expect(await getDriverEarningSummaryForOwner(source.driverUser.id)).toMatchObject({ totalAccrued: "25.40", payableBalance: "0.00", releasedToOwnerWithdrawable: "25.40" });
    expect((await getDriverEarningForOwner(source.driverUser.id, earning.publicReference))?.history.map(event => event.reasonCode)).toEqual(["ACCRUAL_POSTED", "COMMISSION_CHARGES_ATTRIBUTED", "RELEASE_COMPLETED"]);
    expect(await prisma.ledgerJournal.findUnique({ where: { reference: earning.accrualLedgerJournalReference } })).not.toBeNull();
  });
  it("foreign owners and suspended drivers cannot read another driver's earning", async () => {
    const [first, other] = await Promise.all([createDisposableDriverSettlement(), createDisposableDriverSettlement()]);
    const earning = await accrueDriverEarning({ operationId: first.tag, snapshot: first.snapshot });
    expect(await getDriverEarningForOwner(other.driverUser.id, earning.publicReference)).toBeNull();
    expect((await listDriverEarningsForOwner(other.driverUser.id, { page: 1, pageSize: 20 })).data).toEqual([]);
    await prisma.driverProfile.update({ where: { id: first.driver.id }, data: { status: "SUSPENDED" } });
    await expect(getDriverEarningForOwner(first.driverUser.id, earning.publicReference)).rejects.toMatchObject({ code: "DRIVER_EARNING_FORBIDDEN" });
    await expect(getDriverEarningSummaryForOwner(first.driverUser.id)).rejects.toMatchObject({ code: "DRIVER_EARNING_FORBIDDEN" });
  });
  it("earning write failure rolls back journal posting and balances", async () => {
    const source = await createDisposableDriverSettlement();
    const before = await prisma.ledgerAccount.findUniqueOrThrow({ where: { id: source.accounts.account.id } });
    const identifier = `closure_driver_earning_${randomUUID().replaceAll("-", "")}`;
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${identifier}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."assignmentId" = '${source.assignment.id}' THEN RAISE EXCEPTION 'DISPOSABLE_DRIVER_EARNING_WRITE_FAILURE'; END IF; RETURN NEW; END $$`);
    try {
      await prisma.$executeRawUnsafe(`CREATE TRIGGER "${identifier}" BEFORE INSERT ON "DriverEarning" FOR EACH ROW EXECUTE FUNCTION "${identifier}"()`);
      await expect(accrueDriverEarning({ operationId: source.tag, snapshot: source.snapshot })).rejects.toThrow("DISPOSABLE_DRIVER_EARNING_WRITE_FAILURE");
      expect(await prisma.driverEarning.count({ where: { assignmentId: source.assignment.id } })).toBe(0);
      expect(await prisma.ledgerJournal.count({ where: { type: "DRIVER_EARNING_ACCRUAL", metadata: { path: ["assignmentReference"], equals: source.snapshot.assignmentPublicReference } } })).toBe(0);
      expect(await prisma.ledgerAccount.findUniqueOrThrow({ where: { id: source.accounts.account.id } })).toEqual(before);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${identifier}" ON "DriverEarning"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION "${identifier}"()`);
    }
  });
  // Source facts are synthetic. Provider verification, physical delivery and
  // production financial approval require their independent acceptance gates.
});

import { produceDriverSettlement } from "@/lib/services/driver-settlement-producer.service";
import { ensureLedgerAccount, ensureWalletForOwner } from "@/lib/services/wallet-account.service";

describe("real courier settlement producer on isolated PostgreSQL", () => {
  it("derives approved deductions from a real quote, commits once under concurrency and rolls back commission if earning fails", async () => {
    const completedAt = new Date("2001-01-01T12:00:00.000Z");
    const tag = randomUUID();
    const reviewer = await prisma.user.create({ data: { email: `producer-reviewer-${tag}@example.test`, role: "SUPER_ADMIN", status: "ACTIVE" } });
    const platform = await ensureWalletForOwner({ ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" });
    await ensureLedgerAccount({ walletId: platform.id, code: "PLATFORM-COMMISSION-REVENUE-ZAR", purpose: "PLATFORM_REVENUE", category: "REVENUE", currency: "ZAR" });
    await prisma.commissionPlan.create({ data: { publicReference: `CP-PRODUCER-${tag}`, subjectType: "COURIER_ORDER", scopeKey: "GLOBAL:COURIER_ORDER", currency: "ZAR", status: "ACTIVE", versionNumber: 1, basisType: "ORDER_TOTAL", calculationVersion: "producer-proof-v1", effectiveFrom: new Date("2001-01-01T00:00:00Z"), effectiveUntil: new Date("2001-01-02T00:00:00Z"), approvedAt: new Date("2000-12-01T00:00:00Z"), approvedByUserId: reviewer.id, createdByUserId: reviewer.id, rules: { create: { publicReference: `CR-PRODUCER-${tag}`, ruleCode: "PLATFORM", allocationType: "PLATFORM_COMMISSION_REVENUE", beneficiaryType: "PLATFORM", calculationMethod: "PERCENTAGE_BPS", rateBasisPoints: 1000, priority: 1, isRequired: true } } } });
    async function source() {
      const s = await createDisposableDriverSettlement();
      const quote = await prisma.pricingQuote.create({ data: { status: "USED", ownerType: "CUSTOMER", ownerId: s.customer.id, deliveryType: "SAME_DAY", currency: "ZAR", calculationVersion: "producer-proof-v1", inputHash: s.tag, distanceMeters: 1000, rawDistanceKm: "1.0000", billableDistanceKm: "1.0000", subtotal: "100.25", taxRate: "0.0000", taxAmount: "0.00", total: "100.25", inputSnapshot: {}, ruleSnapshot: {}, regionSnapshot: {}, taxSnapshot: {}, expiresAt: completedAt, usedAt: completedAt } });
      await prisma.order.update({ where: { id: s.order.id }, data: { pricingQuoteId: quote.id } });
      await prisma.orderAssignment.update({ where: { id: s.assignment.id }, data: { completedAt } });
      await prisma.proofOfDelivery.update({ where: { id: s.pod.id }, data: { deliveredAt: completedAt } });
      return s;
    }
    const s = await source();
    const results = await Promise.all([produceDriverSettlement(s.order.id), produceDriverSettlement(s.order.id)]);
    expect(new Set(results.map(r => r.publicReference)).size).toBe(1);
    const earning = await prisma.driverEarning.findFirstOrThrow({ where: { orderId: s.order.id } });
    expect(earning.amount.toFixed(2)).toBe("90.22");
    expect(earning.attributedCommissionAmount.toFixed(2)).toBe("10.03");
    expect(earning.releaseEligibleAt).toBeNull();
    expect(await prisma.commissionAccrual.count({ where: { subjectId: s.order.id } })).toBe(1);
    expect(await prisma.driverEarning.count({ where: { orderId: s.order.id } })).toBe(1);
    const failed = await source();
    const identifier = `producer_failure_${randomUUID().replaceAll("-", "")}`;
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${identifier}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."orderId" = '${failed.order.id}' THEN RAISE EXCEPTION 'PRODUCER_EARNING_WRITE_FAILURE'; END IF; RETURN NEW; END $$`);
    try {
      await prisma.$executeRawUnsafe(`CREATE TRIGGER "${identifier}" BEFORE INSERT ON "DriverEarning" FOR EACH ROW EXECUTE FUNCTION "${identifier}"()`);
      await expect(produceDriverSettlement(failed.order.id)).rejects.toThrow("PRODUCER_EARNING_WRITE_FAILURE");
      expect(await prisma.commissionAccrual.count({ where: { subjectId: failed.order.id } })).toBe(0);
      expect(await prisma.driverEarning.count({ where: { orderId: failed.order.id } })).toBe(0);
      expect((await prisma.ledgerAccount.findUniqueOrThrow({ where: { id: failed.accounts.account.id } })).currentBalance.toFixed(2)).toBe("0.00");
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${identifier}" ON "DriverEarning"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION "${identifier}"()`);
    }
    const unfunded = await source();
    await prisma.payment.update({ where: { id: unfunded.payment.id }, data: { amount: "50.00" } });
    await expect(produceDriverSettlement(unfunded.order.id)).rejects.toMatchObject({ code: "DRIVER_EARNING_PAYMENT_INVALID" });
    expect(await prisma.commissionAccrual.count({ where: { subjectId: unfunded.order.id } })).toBe(0);
  });
});
