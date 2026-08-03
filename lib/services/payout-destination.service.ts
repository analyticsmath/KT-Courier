import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assertMaskedDestinationMetadata, assertPayoutDestinationExternalReference } from "@/lib/withdrawals/payout-reference-policy";
import { isWithdrawalOwnerType } from "@/lib/withdrawals/withdrawal-owner-policy";
import { WithdrawalError } from "@/lib/withdrawals/errors";

function destinationReference(): string {
  return `PD-${randomUUID().replaceAll("-", "").toUpperCase()}`;
}

export async function registerPayoutDestination(input: Readonly<{
  actorUserId: string;
  ownerType: string;
  ownerId: string;
  externalReference: string;
  maskedLabel: string;
  institutionName?: string;
  accountLast4?: string;
  countryCode?: string;
}>) {
  if (!isWithdrawalOwnerType(input.ownerType)) throw new WithdrawalError("WITHDRAWAL_DESTINATION_INVALID", "Only supported owners may have payout destinations.");
  const externalReference = assertPayoutDestinationExternalReference(input.externalReference);
  assertMaskedDestinationMetadata({ maskedLabel: input.maskedLabel, accountLast4: input.accountLast4 });
  const countryCode = (input.countryCode ?? "ZA").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new WithdrawalError("WITHDRAWAL_DESTINATION_INVALID", "Country code must be a two-letter code.");

  try {
    return await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { ownerType_ownerId_currency: { ownerType: input.ownerType as any, ownerId: input.ownerId, currency: "ZAR" } },
        select: { id: true, status: true },
      });
      if (!wallet || wallet.status !== "ACTIVE") throw new WithdrawalError("WITHDRAWAL_DESTINATION_INVALID", "A matching active owner wallet is required.");
      return tx.payoutDestination.create({
        data: {
          publicReference: destinationReference(),
          walletId: wallet.id,
          ownerType: input.ownerType as any,
          ownerId: input.ownerId,
          method: "MANUAL_EXTERNAL",
          providerCode: "MANUAL_FINANCE",
          externalReference,
          maskedLabel: input.maskedLabel.trim(),
          institutionName: input.institutionName?.trim() || undefined,
          accountLast4: input.accountLast4?.trim() || undefined,
          countryCode,
          currency: "ZAR",
          status: "PENDING_REVIEW",
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") throw new WithdrawalError("WITHDRAWAL_DESTINATION_INVALID", "This opaque payout destination reference is already registered.");
    throw error;
  }
}

export async function transitionPayoutDestination(input: Readonly<{
  actorUserId: string;
  publicReference: string;
  action: "ACTIVATE" | "SUSPEND" | "REVOKE";
}>) {
  return prisma.$transaction(async (tx) => {
    const destination = await tx.payoutDestination.findUnique({ where: { publicReference: input.publicReference } });
    if (!destination) throw new WithdrawalError("WITHDRAWAL_DESTINATION_INVALID", "Payout destination was not found.");
    if (input.action === "ACTIVATE") {
      if (destination.status === "REVOKED") throw new WithdrawalError("WITHDRAWAL_DESTINATION_INVALID", "A revoked payout destination cannot be reactivated.");
      return tx.payoutDestination.update({ where: { id: destination.id }, data: { status: "ACTIVE", verifiedAt: new Date(), verifiedByUserId: input.actorUserId, disabledAt: null, disabledByUserId: null, version: { increment: 1 } } });
    }
    if (destination.status === "REVOKED") return destination;
    return tx.payoutDestination.update({
      where: { id: destination.id },
      data: { status: input.action === "SUSPEND" ? "SUSPENDED" : "REVOKED", disabledAt: new Date(), disabledByUserId: input.actorUserId, version: { increment: 1 } },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
