import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withLedgerRetry } from "@/lib/ledger/retry";

export type AdjustLoyaltyInput = Readonly<{
  customerUserId: string;
  deltaPoints: bigint;
  reason: string;
  actorUserId: string;
}>;

export async function adjustCustomerLoyaltyPoints(input: AdjustLoyaltyInput) {
  if (!input.customerUserId || !input.actorUserId) {
    throw new Error("Customer user ID and admin actor user ID are required.");
  }
  if (!input.reason || input.reason.trim().length < 5) {
    throw new Error("A valid reason of at least 5 characters is required for loyalty adjustment.");
  }
  if (input.deltaPoints === 0n) {
    throw new Error("Delta points must be nonzero.");
  }

  return withLedgerRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const customer = await tx.user.findUnique({
          where: { id: input.customerUserId },
          select: { id: true, role: true, status: true },
        });
        if (!customer || customer.role !== "CUSTOMER" || customer.status !== "ACTIVE") {
          throw new Error("Active customer account is required for loyalty adjustment.");
        }

        const account =
          (await tx.customerLoyaltyAccount.findUnique({
            where: { userId: input.customerUserId },
          })) ??
          (await tx.customerLoyaltyAccount.create({
            data: { userId: input.customerUserId },
          }));

        let available = account.availablePoints;
        let debt = account.debtPoints;
        let lifetimeEarned = account.lifetimeEarnedPoints;
        let lifetimeReversed = account.lifetimeReversedPoints;

        if (input.deltaPoints > 0n) {
          const added = input.deltaPoints;
          lifetimeEarned += added;
          if (debt > 0n) {
            const repaid = debt < added ? debt : added;
            debt -= repaid;
            available += added - repaid;
          } else {
            available += added;
          }
        } else {
          const deducted = -input.deltaPoints;
          lifetimeReversed += deducted;
          if (available >= deducted) {
            available -= deducted;
          } else {
            const remaining = deducted - available;
            available = 0n;
            debt += remaining;
          }
        }

        const updated = await tx.customerLoyaltyAccount.update({
          where: { userId: input.customerUserId },
          data: {
            availablePoints: available,
            debtPoints: debt,
            lifetimeEarnedPoints: lifetimeEarned,
            lifetimeReversedPoints: lifetimeReversed,
            version: { increment: 1 },
          },
        });

        await tx.adminActivityLog.create({
          data: {
            actorUserId: input.actorUserId,
            entityType: "CustomerLoyaltyAccount",
            entityId: input.customerUserId,
            action: "UPDATE",
            message: `Admin loyalty adjustment: ${input.reason.trim()}`,
            metadata: {
              deltaPoints: input.deltaPoints.toString(),
              availablePointsBefore: account.availablePoints.toString(),
              availablePointsAfter: available.toString(),
              debtPointsBefore: account.debtPoints.toString(),
              debtPointsAfter: debt.toString(),
              reason: input.reason.trim(),
            },
          },
        });

        return {
          customerUserId: input.customerUserId,
          availablePoints: updated.availablePoints.toString(),
          debtPoints: updated.debtPoints.toString(),
          lifetimeEarnedPoints: updated.lifetimeEarnedPoints.toString(),
          lifetimeReversedPoints: updated.lifetimeReversedPoints.toString(),
          version: updated.version,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 },
    ),
  );
}
