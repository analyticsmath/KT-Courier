import type { Prisma } from "@prisma/client";
import { WithdrawalError } from "./errors";

export const WITHDRAWAL_OWNER_TYPES = ["STORE", "DRIVER", "PROMOTER"] as const;
export type WithdrawalOwnerType = (typeof WITHDRAWAL_OWNER_TYPES)[number];

export type WithdrawalOwnerSnapshot = Readonly<{
  ownerType: WithdrawalOwnerType;
  ownerId: string;
  userId: string;
  active: boolean;
  suspended: boolean;
}>;

export function isWithdrawalOwnerType(value: string): value is WithdrawalOwnerType {
  return (WITHDRAWAL_OWNER_TYPES as readonly string[]).includes(value);
}

export function assertWithdrawalOwnerEligibility(input: WithdrawalOwnerSnapshot): void {
  if (!input.active || input.suspended) {
    throw new WithdrawalError("WITHDRAWAL_OWNER_INELIGIBLE", "This owner is not eligible to withdraw funds.");
  }
}

export async function resolveWithdrawalOwnerForUser(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<WithdrawalOwnerSnapshot> {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, status: true, role: true } });
  if (!user || user.status !== "ACTIVE") {
    throw new WithdrawalError("WITHDRAWAL_OWNER_INELIGIBLE", "An active owner account is required.");
  }

  const [store, driver, promoter] = await Promise.all([
    tx.store.findFirst({ where: { ownerUserId: user.id }, select: { id: true, status: true } }),
    tx.driverProfile.findUnique({ where: { userId: user.id }, select: { id: true, active: true, status: true } }),
    tx.promoterAccount.findUnique({ where: { userId: user.id }, select: { id: true, status: true, identityStatus: true, taxProfileStatus: true, payoutReadinessStatus: true } }),
  ]);

  if (store && user.role === "STORE") {
    const snapshot = { ownerType: "STORE" as const, ownerId: store.id, userId: user.id, active: store.status === "ACTIVE", suspended: store.status === "SUSPENDED" || store.status === "DISABLED" };
    assertWithdrawalOwnerEligibility(snapshot);
    return snapshot;
  }
  if (driver && user.role === "DRIVER") {
    const snapshot = { ownerType: "DRIVER" as const, ownerId: driver.id, userId: user.id, active: driver.active && driver.status === "ACTIVE", suspended: driver.status === "SUSPENDED" };
    assertWithdrawalOwnerEligibility(snapshot);
    return snapshot;
  }
  if (promoter && user.role === "PROMOTER") {
    if (promoter.identityStatus !== "VERIFIED" || promoter.taxProfileStatus !== "READY" || promoter.payoutReadinessStatus !== "READY") throw new WithdrawalError("WITHDRAWAL_OWNER_INELIGIBLE", "Promoter compliance and payout readiness are required.");
    const snapshot = { ownerType: "PROMOTER" as const, ownerId: promoter.id, userId: user.id, active: promoter.status === "ACTIVE", suspended: promoter.status !== "ACTIVE" };
    assertWithdrawalOwnerEligibility(snapshot);
    return snapshot;
  }
  throw new WithdrawalError("WITHDRAWAL_OWNER_INELIGIBLE", "This account has no supported withdrawal ownership relationship.");
}
