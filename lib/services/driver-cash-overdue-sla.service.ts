import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { dispatchAdminAlertsForEvent } from "@/lib/notifications/admin-alert-dispatch.service";
import {
  buildOverdueDriverCashWhere,
  DRIVER_CASH_TIMEZONE,
  formatJohannesburgDate,
} from "./driver-cash-overdue-policy";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function johannesburgRemittanceSlot(now: Date): {
  sastDate: string;
  slotIndex: number;
} {
  const shiftedMs = now.getTime() + SAST_OFFSET_MS;
  const sastDate = formatJohannesburgDate(now);
  const msWithinDay = ((shiftedMs % DAY_MS) + DAY_MS) % DAY_MS;
  const slotIndex = Math.floor(msWithinDay / SIX_HOURS_MS);
  return { sastDate, slotIndex };
}

export type OverdueDriverCashScanResult = Readonly<{
  itemsExamined: number;
  itemsClaimed: number;
  itemsCompleted: number;
  itemsSkipped: number;
  itemsRetried: number;
  itemsReconciled: number;
  driversAlerted: number;
  safeSummary: string;
}>;

/**
 * Monitors overdue collected COD cash obligations past the Johannesburg
 * end-of-operating-day SLA (`remittanceDueAt` or legacy `collectedAt < SAST midnight`).
 *
 * Strictly observational + operational escalation:
 * - Never settles, waives, or creates ledger clearing journals.
 * - Pending deposit submissions are reported for context only; they never
 *   unblock overdue custody before independent admin bank verification.
 */
export async function scanOverdueDriverCashRemittanceBatch(input?: {
  mode?: "DRY_RUN" | "APPLY";
  batchSize?: number;
  now?: Date;
}): Promise<OverdueDriverCashScanResult> {
  const mode = input?.mode ?? "APPLY";
  const now = input?.now ?? new Date();
  const limit = Math.min(Math.max(input?.batchSize ?? 100, 1), 500);

  const overdueRows = await prisma.cashOnDelivery.findMany({
    where: buildOverdueDriverCashWhere(now, {
      collectorDriverId: { not: null },
    }),
    select: {
      id: true,
      orderId: true,
      collectorDriverId: true,
      cashCollected: true,
      cashReconciled: true,
      collectedAt: true,
      remittanceDueAt: true,
      order: { select: { orderNumber: true } },
    },
    orderBy: [{ remittanceDueAt: "asc" }, { collectedAt: "asc" }, { id: "asc" }],
    take: limit,
  });

  const itemsExamined = overdueRows.length;
  if (mode === "DRY_RUN" || itemsExamined === 0) {
    return {
      itemsExamined,
      itemsClaimed: 0,
      itemsCompleted: 0,
      itemsSkipped: itemsExamined,
      itemsRetried: 0,
      itemsReconciled: 0,
      driversAlerted: 0,
      safeSummary:
        mode === "DRY_RUN"
          ? `[DRY_RUN] Identified ${itemsExamined} overdue collected COD cash obligation(s); 0 alerts dispatched.`
          : "No overdue collected COD cash obligations found.",
    };
  }

  const driverIds = [
    ...new Set(
      overdueRows
        .map((r) => r.collectorDriverId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  const driverProfiles = driverIds.length
    ? await prisma.driverProfile.findMany({
        where: { id: { in: driverIds } },
        select: { id: true, driverCode: true, displayName: true },
      })
    : [];
  const driverMetaById = new Map(driverProfiles.map((d) => [d.id, d]));

  const byDriver = new Map<
    string,
    {
      driverCode: string;
      driverName: string;
      orderIds: string[];
      orderCount: number;
      outstandingTotal: Prisma.Decimal;
      oldestDueAt: Date | null;
    }
  >();

  for (const row of overdueRows) {
    const driverId = row.collectorDriverId;
    if (!driverId) continue;
    const driverMeta = driverMetaById.get(driverId);
    const outstanding = Prisma.Decimal.max(
      row.cashCollected.sub(row.cashReconciled),
      new Prisma.Decimal(0),
    );
    const effectiveDue =
      row.remittanceDueAt ?? row.collectedAt ?? now;
    const existing = byDriver.get(driverId);
    if (!existing) {
      byDriver.set(driverId, {
        driverCode: driverMeta?.driverCode ?? driverId,
        driverName:
          driverMeta?.displayName ??
          driverMeta?.driverCode ??
          driverId,
        orderIds: [row.orderId],
        orderCount: 1,
        outstandingTotal: outstanding,
        oldestDueAt: effectiveDue,
      });
    } else {
      existing.orderIds.push(row.orderId);
      existing.orderCount += 1;
      existing.outstandingTotal = existing.outstandingTotal.add(outstanding);
      if (!existing.oldestDueAt || effectiveDue < existing.oldestDueAt) {
        existing.oldestDueAt = effectiveDue;
      }
    }
  }

  const pendingDeposits = driverIds.length
    ? await prisma.driverCashDeposit.groupBy({
        by: ["driverProfileId"],
        where: {
          driverProfileId: { in: driverIds },
          status: { in: ["PENDING", "PROCESSING"] },
        },
        _count: { _all: true },
        _sum: { amount: true },
      })
    : [];
  const pendingByDriver = new Map(
    pendingDeposits.map((item) => [item.driverProfileId, item]),
  );

  const { sastDate, slotIndex } = johannesburgRemittanceSlot(now);
  let driversAlerted = 0;

  for (const [driverId, group] of byDriver.entries()) {
    const pending = pendingByDriver.get(driverId);
    const pendingCount = pending?._count._all ?? 0;
    const pendingZar = (pending?._sum.amount ?? new Prisma.Decimal(0)).toFixed(2);
    const outstandingZar = group.outstandingTotal.toFixed(2);
    const oldestIso = group.oldestDueAt ? group.oldestDueAt.toISOString() : null;

    await dispatchAdminAlertsForEvent({
      eventType: "DRIVER_CASH_REMITTANCE_OVERDUE",
      aggregateReference: `cod-overdue:${driverId}:${sastDate}:w${slotIndex}`,
      adminPath: "/admin/cash-deposits",
      title: `Overdue driver cash remittance (${group.driverCode} · R${outstandingZar})`,
      summary: `${group.driverName} (${group.driverCode}) holds ${group.orderCount} overdue un-reconciled COD collection(s) totaling R${outstandingZar}. New COD assignments remain blocked until bank deposit is verified (${pendingCount} pending review).`,
      metadata: {
        driverProfileId: driverId,
        driverCode: group.driverCode,
        overdueOrderCount: group.orderCount,
        overdueAmountZar: outstandingZar,
        oldestDueAt: oldestIso,
        sastDate,
        timezone: DRIVER_CASH_TIMEZONE,
        pendingDepositCount: pendingCount,
        pendingDepositAmountZar: pendingZar,
        newCodAssignmentsBlocked: true,
      },
    });
    driversAlerted += 1;
  }

  return {
    itemsExamined,
    itemsClaimed: itemsExamined,
    itemsCompleted: itemsExamined,
    itemsSkipped: 0,
    itemsRetried: 0,
    itemsReconciled: 0,
    driversAlerted,
    safeSummary: `Monitored ${itemsExamined} overdue COD obligation(s) across ${driversAlerted} driver(s); overdue remittance escalations recorded.`,
  };
}
