import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/auth/permissions";
import type { AuthenticatedUser } from "@/types/domain";
import { PlatformError } from "./contracts";

/** South Africa has a fixed UTC+02:00 civil clock (no daylight-saving time). */
export function johannesburgDayStart(reference: Date): Date {
  const offset = 2 * 60 * 60 * 1000;
  const shifted = new Date(reference.getTime() + offset);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - offset);
}

export async function getDailyDriverCashReconciliation(
  actor: AuthenticatedUser, referenceTime: Date = new Date(),
) {
  if (actor.status !== "ACTIVE" ||
      !["ADMIN", "SUPER_ADMIN"].includes(actor.role) ||
      !await hasPermission({ userId: actor.id, role: actor.role, permissionKey: "cod_operations.manage" })) {
    throw new PlatformError("CASH_REVIEW_FORBIDDEN", "Cash operations permission required.", 403);
  }
  const cutoff = johannesburgDayStart(referenceTime);
  const [driverCount, drivers] = await Promise.all([
    // Suspended/deactivated drivers may still hold customer cash. Exclusion
    // would erase unreconciled liabilities from finance's daily visibility.
    prisma.driverProfile.count(),
    prisma.driverProfile.findMany({
      select: { id: true, displayName: true, driverCode: true, status: true, cashLimitAmount: true },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      take: 500,
    }),
  ]);
  const ids = drivers.map(driver => driver.id);
  const [accounts, overdueCod, pendingRemittances, assignedCash] = ids.length ? await Promise.all([
    prisma.ledgerAccount.findMany({
      where: { wallet: { ownerType: "DRIVER", ownerId: { in: ids } },
        purpose: "CASH_CLEARING", category: "ASSET", currency: "ZAR", status: "ACTIVE" },
      select: { currentBalance: true, wallet: { select: { ownerId: true } } },
    }),
    prisma.cashOnDelivery.groupBy({
      by: ["collectorDriverId"],
      where: { collectorDriverId: { in: ids }, status: "COLLECTED", collectedAt: { lt: cutoff } },
      _sum: { cashCollected: true, cashReconciled: true }, _count: { _all: true },
    }),
    prisma.driverCashDeposit.groupBy({
      by: ["driverProfileId"],
      where: { driverProfileId: { in: ids }, status: { in: ["PENDING", "PROCESSING"] } },
      _sum: { amount: true }, _count: { _all: true },
    }),
    prisma.orderAssignment.findMany({
      where: { driverProfileId: { in: ids }, status: { in: ["ASSIGNED", "ACCEPTED"] } },
      select: { driverProfileId: true, order: { select: { cashOnDelivery: {
        select: { cashObligation: true, cashCollected: true, status: true },
      } } } },
    }),
  ]) : [[], [], [], []];
  const held = new Map<string, Prisma.Decimal>();
  for (const account of accounts) {
    const id = account.wallet.ownerId;
    held.set(id, (held.get(id) ?? new Prisma.Decimal(0)).add(account.currentBalance));
  }
  const old = new Map(overdueCod.map(entry => [entry.collectorDriverId, entry]));
  const pending = new Map(pendingRemittances.map(entry => [entry.driverProfileId, entry]));
  const reserved = new Map<string, Prisma.Decimal>();
  for (const entry of assignedCash) {
    const cod = entry.order.cashOnDelivery;
    if (!cod || ["CANCELLED", "RECONCILED"].includes(cod.status)) continue;
    reserved.set(entry.driverProfileId, (reserved.get(entry.driverProfileId) ?? new Prisma.Decimal(0))
      .add(Prisma.Decimal.max(cod.cashObligation.sub(cod.cashCollected), new Prisma.Decimal(0))));
  }
  const rows = drivers.map(driver => {
    const cash = held.get(driver.id) ?? new Prisma.Decimal(0);
    const overdue = old.get(driver.id);
    const pastDue = Prisma.Decimal.max(
      (overdue?._sum.cashCollected ?? new Prisma.Decimal(0)).sub(overdue?._sum.cashReconciled ?? new Prisma.Decimal(0)),
      new Prisma.Decimal(0),
    );
    const awaiting = pending.get(driver.id);
    const assigned = reserved.get(driver.id) ?? new Prisma.Decimal(0);
    return {
      id: driver.id, name: driver.displayName ?? driver.driverCode, driverCode: driver.driverCode,
      status: driver.status,
      held: cash.toFixed(2), reserved: assigned.toFixed(2),
      exposure: cash.add(assigned).toFixed(2), limit: driver.cashLimitAmount.toFixed(2),
      atLimit: cash.add(assigned).greaterThanOrEqualTo(driver.cashLimitAmount),
      overnightOutstanding: pastDue.toFixed(2), overnightOrderCount: overdue?._count._all ?? 0,
      pendingDepositAmount: (awaiting?._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
      pendingDepositCount: awaiting?._count._all ?? 0,
    };
  }).sort((a, b) =>
    Number(b.atLimit) - Number(a.atLimit) ||
    new Prisma.Decimal(b.overnightOutstanding).cmp(a.overnightOutstanding) ||
    new Prisma.Decimal(b.held).cmp(a.held) ||
    a.name.localeCompare(b.name),
  );
  const totalHeld = rows.reduce((sum, row) => sum.add(row.held), new Prisma.Decimal(0));
  const totalOvernight = rows.reduce((sum, row) => sum.add(row.overnightOutstanding), new Prisma.Decimal(0));
  return {
    asOf: referenceTime.toISOString(),
    date: new Date(cutoff.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10),
    timezone: "Africa/Johannesburg",
    driverCount, hasMoreDrivers: driverCount > drivers.length,
    totalHeld: totalHeld.toFixed(2), totalOvernight: totalOvernight.toFixed(2),
    atLimitCount: rows.filter(row => row.atLimit).length,
    drivers: rows,
    note: "Pending deposits have NOT cleared driver custody. Only independently verified and reconciled bank funds reduce the held balance.",
  };
}
