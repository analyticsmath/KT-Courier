import type { Prisma } from "@prisma/client";

export const DRIVER_CASH_TIMEZONE = "Africa/Johannesburg";
const JOHANNESBURG_UTC_OFFSET_MS = 2 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * South Africa observes SAST (UTC+02:00) year-round with no DST.
 */
export function johannesburgDayStart(reference: Date): Date {
  const shifted = new Date(reference.getTime() + JOHANNESBURG_UTC_OFFSET_MS);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ) - JOHANNESBURG_UTC_OFFSET_MS,
  );
}

/**
 * Computes the end-of-operating-day remittance deadline (24:00 SAST of the
 * collection civil day) when a driver collects COD cash.
 */
export function computeDriverCashRemittanceDueAt(collectedAt: Date): Date {
  return new Date(johannesburgDayStart(collectedAt).getTime() + DAY_MS);
}

export function formatJohannesburgDate(reference: Date): string {
  return new Date(reference.getTime() + JOHANNESBURG_UTC_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

export function isCashOnDeliveryOverdue(
  record: Readonly<{
    status: string;
    remittanceDueAt: Date | null;
    collectedAt: Date | null;
  }>,
  now: Date = new Date(),
): boolean {
  if (record.status !== "COLLECTED") return false;
  if (record.remittanceDueAt) {
    return record.remittanceDueAt.getTime() <= now.getTime();
  }
  if (!record.collectedAt) return false;
  return record.collectedAt.getTime() < johannesburgDayStart(now).getTime();
}

export function buildOverdueDriverCashWhere(
  now: Date = new Date(),
  extra?: Prisma.CashOnDeliveryWhereInput,
): Prisma.CashOnDeliveryWhereInput {
  const dayStart = johannesburgDayStart(now);
  return {
    ...(extra ?? {}),
    status: "COLLECTED",
    OR: [
      { remittanceDueAt: { lte: now } },
      { remittanceDueAt: null, collectedAt: { lt: dayStart } },
    ],
  };
}
