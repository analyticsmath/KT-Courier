import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/** Cash custody is real money. Never use float arithmetic or treat deposits as cleared before review. */
export class DriverCashLimitError extends Error {
  readonly code = "DRIVER_CASH_LIMIT_EXCEEDED";
  constructor(readonly held: string, readonly reserved: string, readonly requested: string, readonly limit: string) {
    super("This driver has reached the approved cash-in-hand limit. Confirm and reconcile bank deposits before assigning more cash deliveries.");
    this.name = "DriverCashLimitError";
  }
}

type CashTx = Prisma.TransactionClient;
function amount(value: Prisma.Decimal | string | number | null | undefined) {
  return new Prisma.Decimal(value ?? 0);
}
async function driverAndHeld(tx: CashTx, driverId: string) {
  // All COD assignment and collection paths serialize on this exact row.
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "DriverProfile" WHERE "id" = ${driverId} FOR NO KEY UPDATE`);
  const driver = await tx.driverProfile.findUnique({ where: { id: driverId }, select: { cashLimitAmount: true } });
  if (!driver) throw new Error("Driver profile not found.");
  const custody = await tx.ledgerAccount.aggregate({
    where: { wallet: { ownerType: "DRIVER", ownerId: driverId }, purpose: "CASH_CLEARING", category: "ASSET", currency: "ZAR", status: "ACTIVE" },
    _sum: { currentBalance: true },
  });
  return { limit: driver.cashLimitAmount, held: amount(custody._sum.currentBalance) };
}
function rejectIfOverCap(held: Prisma.Decimal, reserved: Prisma.Decimal, requested: Prisma.Decimal, limit: Prisma.Decimal) {
  if (held.add(reserved).add(requested).greaterThan(limit)) {
    throw new DriverCashLimitError(held.toFixed(2), reserved.toFixed(2), requested.toFixed(2), limit.toFixed(2));
  }
}

/** Called inside the same transaction as manual/automatic driver assignment.
 * Reserved COD includes offered/accepted but uncollected cash deliveries.
 * The lock prevents concurrent offers from allocating beyond the cap.
 */
export async function assertDriverCashCapacityForAssignment(tx: CashTx, driverId: string, orderId: string): Promise<void> {
  const cod = await tx.cashOnDelivery.findUnique({ where: { orderId }, select: { cashObligation: true, cashCollected: true, status: true } });
  if (!cod || ["CANCELLED", "RECONCILED"].includes(cod.status)) return;
  const requested = Prisma.Decimal.max(cod.cashObligation.sub(cod.cashCollected), new Prisma.Decimal(0));
  if (requested.isZero()) return;
  const { limit, held } = await driverAndHeld(tx, driverId);
  const assigned = await tx.orderAssignment.findMany({
    where: { driverProfileId: driverId, status: { in: ["ASSIGNED", "ACCEPTED"] }, orderId: { not: orderId } },
    select: { order: { select: { cashOnDelivery: { select: { cashObligation: true, cashCollected: true, status: true } } } } },
  });
  const reserved = assigned.reduce((sum, row) => {
    const previous = row.order.cashOnDelivery;
    if (!previous || ["CANCELLED", "RECONCILED"].includes(previous.status)) return sum;
    return sum.add(Prisma.Decimal.max(previous.cashObligation.sub(previous.cashCollected), new Prisma.Decimal(0)));
  }, new Prisma.Decimal(0));
  rejectIfOverCap(held, reserved, requested, limit);
}

/** Defense in depth: a legacy assignment cannot collect above its driver's limit. */
export async function assertDriverCashCapacityForCollection(tx: CashTx, driverId: string, requestedAmount: Prisma.Decimal): Promise<void> {
  const { limit, held } = await driverAndHeld(tx, driverId);
  rejectIfOverCap(held, new Prisma.Decimal(0), requestedAmount, limit);
}

/** The limit is audited and protected against stale admin form submissions. */
export async function updateDriverCashLimit(driverId: string, adminUserId: string, amountZar: string, expectedRevision: number) {
  const value = new Prisma.Decimal(amountZar);
  if (!value.isFinite() || value.isNegative() || value.greaterThan(1_000_000) || value.decimalPlaces() > 2) {
    throw new Error("Set an amount between R0.00 and R1,000,000.00 with no more than two decimals.");
  }
  return prisma.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "DriverProfile" WHERE "id" = ${driverId} FOR NO KEY UPDATE`);
    const prior = await tx.driverProfile.findUnique({ where: { id: driverId }, select: { cashLimitAmount: true, cashLimitRevision: true } });
    if (!prior) return null;
    if (prior.cashLimitRevision !== expectedRevision) throw new Error("Cash limit was changed by another administrator. Reload the driver before saving.");
    const updated = await tx.driverProfile.update({
      where: { id: driverId },
      data: { cashLimitAmount: value, cashLimitRevision: { increment: 1 } },
      select: { id: true, cashLimitAmount: true, cashLimitRevision: true },
    });
    await tx.adminActivityLog.create({ data: {
      actorUserId: adminUserId, action: "UPDATE", entityType: "Driver", entityId: driverId,
      message: "Driver cash-in-hand assignment limit updated",
      metadata: { oldLimit: prior.cashLimitAmount.toFixed(2), newLimit: value.toFixed(2), oldRevision: prior.cashLimitRevision, newRevision: updated.cashLimitRevision },
    } });
    return { driverId, amount: updated.cashLimitAmount.toFixed(2), revision: updated.cashLimitRevision };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
