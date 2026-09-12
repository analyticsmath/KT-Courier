import { randomBytes } from "node:crypto";
import { Prisma, WithdrawalEarningType, WithdrawalEarningAllocationStatus } from "@prisma/client";
import {
  ensureLedgerAccountInTx,
  ensureWalletForOwnerInTx,
} from "@/lib/services/wallet-account.service";
import {
  resolveOwnerWithdrawableAccount,
  resolveOwnerDisputeHeldAccount,
  resolveOwnerReceivableAccount,
} from "@/lib/services/payment-dispute.service";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";
import { WithdrawalError } from "@/lib/withdrawals/errors";

export interface SettledAllocationDetail {
  allocationId: string;
  withdrawalId: string;
  allocatedAmountCents: number;
}

export interface ActiveWithdrawalAllocationDetail {
  allocationId: string;
  withdrawalId: string;
  withdrawalPublicReference: string;
  withdrawalStatus: string;
  allocatedAmountCents: number;
  isPreProviderCancellable: boolean;
  isInFlightProcessing: boolean;
}

export interface EarningProvenanceSummary {
  earningId: string;
  earningType: "STORE" | "DRIVER";
  totalReleasedCents: number;
  externallySettledCents: number;
  activelyReservedCents: number;
  unallocatedAvailableCents: number;
  activeAllocations: ActiveWithdrawalAllocationDetail[];
  settledAllocations: SettledAllocationDetail[];
  settledAllocationIds: string[];
}

export interface PartitionedDisputeShare {
  settled: Array<{ allocationId: string; amountCents: number }>;
  inFlightProcessing: Array<{ allocationId: string; withdrawalId: string; amountCents: number }>;
  preProviderReserved: Array<{ allocationId: string; withdrawalId: string; amountCents: number }>;
  availableCents: number;
}

function generateAllocationPublicReference(): string {
  return `wea_${randomBytes(12).toString("hex")}`;
}

/**
 * Allocates released earnings to a newly created withdrawal request in FIFO order.
 * Acquires row locks on candidate earnings to guarantee no two concurrent withdrawal
 * requests can allocate the same earning capacity twice.
 */
export async function allocateEarningsForWithdrawal(
  tx: Prisma.TransactionClient,
  withdrawal: Readonly<{
    id: string;
    walletId: string;
    ownerType: "STORE" | "DRIVER" | string;
    ownerId: string;
    amount: Prisma.Decimal | number | string;
    currency?: "ZAR";
  }>,
): Promise<void> {
  if (withdrawal.ownerType !== "STORE" && withdrawal.ownerType !== "DRIVER") {
    return;
  }
  if (!tx.withdrawalEarningAllocation) {
    return;
  }

  const withdrawalAmountDecimal = new Prisma.Decimal(withdrawal.amount);
  let remainingNeededCents = Math.round(Number(withdrawalAmountDecimal) * 100);
  if (remainingNeededCents <= 0) return;

  if (withdrawal.ownerType === "STORE") {
    // 1. Lock released candidate StoreEarnings in deterministic FIFO order
    const lockedRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "StoreEarning"
      WHERE "walletId" = ${withdrawal.walletId}
        AND "status" = 'RELEASED'
      ORDER BY "releasedAt" ASC, "id" ASC
      FOR UPDATE
    `);

    if (lockedRows.length > 0) {
      const lockedIds = lockedRows.map((r) => r.id);
      const earnings = await tx.storeEarning.findMany({
        where: { id: { in: lockedIds } },
        include: {
          withdrawalAllocations: {
            where: { status: { in: [WithdrawalEarningAllocationStatus.RESERVED, WithdrawalEarningAllocationStatus.SETTLED] } },
          },
        },
        orderBy: [{ releasedAt: "asc" }, { id: "asc" }],
      });

      for (const earning of earnings) {
        if (remainingNeededCents <= 0) break;

        const releasedCents = Math.round(Number(earning.releasedAmount) * 100);
        const allocatedCents = earning.withdrawalAllocations.reduce(
          (sum, a) => sum + Math.round(Number(a.allocatedAmount) * 100),
          0,
        );
        const remainingAllocatableCents = Math.max(0, releasedCents - allocatedCents);

        if (remainingAllocatableCents > 0) {
          const toAllocateCents = Math.min(remainingNeededCents, remainingAllocatableCents);
          const allocatedDecimal = new Prisma.Decimal(toAllocateCents).div(100);

          await tx.withdrawalEarningAllocation.create({
            data: {
              publicReference: generateAllocationPublicReference(),
              withdrawalRequestId: withdrawal.id,
              earningType: WithdrawalEarningType.STORE,
              storeEarningId: earning.id,
              allocatedAmount: allocatedDecimal,
              currency: "ZAR",
              status: WithdrawalEarningAllocationStatus.RESERVED,
            },
          });

          remainingNeededCents -= toAllocateCents;
        }
      }
    }
  } else if (withdrawal.ownerType === "DRIVER") {
    // Lock released candidate DriverEarnings in deterministic FIFO order
    const lockedRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "DriverEarning"
      WHERE "walletId" = ${withdrawal.walletId}
        AND "status" = 'RELEASED'
      ORDER BY "releasedAt" ASC, "id" ASC
      FOR UPDATE
    `);

    if (lockedRows.length > 0) {
      const lockedIds = lockedRows.map((r) => r.id);
      const earnings = await tx.driverEarning.findMany({
        where: { id: { in: lockedIds } },
        include: {
          withdrawalAllocations: {
            where: { status: { in: [WithdrawalEarningAllocationStatus.RESERVED, WithdrawalEarningAllocationStatus.SETTLED] } },
          },
        },
        orderBy: [{ releasedAt: "asc" }, { id: "asc" }],
      });

      for (const earning of earnings) {
        if (remainingNeededCents <= 0) break;

        const releasedCents = Math.round(Number(earning.releasedAmount) * 100);
        const allocatedCents = earning.withdrawalAllocations.reduce(
          (sum, a) => sum + Math.round(Number(a.allocatedAmount) * 100),
          0,
        );
        const remainingAllocatableCents = Math.max(0, releasedCents - allocatedCents);

        if (remainingAllocatableCents > 0) {
          const toAllocateCents = Math.min(remainingNeededCents, remainingAllocatableCents);
          const allocatedDecimal = new Prisma.Decimal(toAllocateCents).div(100);

          await tx.withdrawalEarningAllocation.create({
            data: {
              publicReference: generateAllocationPublicReference(),
              withdrawalRequestId: withdrawal.id,
              earningType: WithdrawalEarningType.DRIVER,
              driverEarningId: earning.id,
              allocatedAmount: allocatedDecimal,
              currency: "ZAR",
              status: WithdrawalEarningAllocationStatus.RESERVED,
            },
          });

          remainingNeededCents -= toAllocateCents;
        }
      }
    }
  }

  if (remainingNeededCents > 0) {
    throw new WithdrawalError(
      "WITHDRAWAL_INSUFFICIENT_BALANCE",
      `Complete withdrawal amount cannot be attributed to canonical released earnings; unprovenanced shortfall: R${(remainingNeededCents / 100).toFixed(2)}.`,
    );
  }
}

/**
 * Transitions active allocations to SETTLED when payout reaches terminal confirmed success.
 */
export async function settleWithdrawalEarningAllocations(
  tx: Prisma.TransactionClient,
  withdrawalId: string,
): Promise<void> {
  if (!tx.withdrawalEarningAllocation) return;
  const now = new Date();
  await tx.withdrawalEarningAllocation.updateMany({
    where: {
      withdrawalRequestId: withdrawalId,
      status: WithdrawalEarningAllocationStatus.RESERVED,
    },
    data: {
      status: WithdrawalEarningAllocationStatus.SETTLED,
      settledAt: now,
    },
  });
}

/**
 * Marks active allocations as CANCELLED when a withdrawal is cancelled or definitively rejected.
 */
export async function cancelWithdrawalEarningAllocations(
  tx: Prisma.TransactionClient,
  withdrawalId: string,
): Promise<void> {
  if (!tx.withdrawalEarningAllocation) return;
  await tx.withdrawalEarningAllocation.updateMany({
    where: {
      withdrawalRequestId: withdrawalId,
      status: WithdrawalEarningAllocationStatus.RESERVED,
    },
    data: {
      status: WithdrawalEarningAllocationStatus.CANCELLED,
    },
  });
}

/**
 * Queries the granular 4-tier financial provenance for a specific earning:
 * - externally settled (terminal provider success)
 * - actively reserved (in withdrawal request)
 * - unallocated available (economically spendable)
 */
export async function getEarningProvenanceSummary(
  tx: Prisma.TransactionClient,
  earningType: "STORE" | "DRIVER",
  earningId: string,
): Promise<EarningProvenanceSummary> {
  let totalReleasedCents = 0;

  if (earningType === "STORE") {
    const earning = await tx.storeEarning.findUnique({
      where: { id: earningId },
      select: { releasedAmount: true, status: true },
    });
    if (earning && earning.status === "RELEASED") {
      totalReleasedCents = Math.round(Number(earning.releasedAmount) * 100);
    }
  } else {
    const earning = await tx.driverEarning.findUnique({
      where: { id: earningId },
      select: { releasedAmount: true, status: true },
    });
    if (earning && earning.status === "RELEASED") {
      totalReleasedCents = Math.round(Number(earning.releasedAmount) * 100);
    }
  }

  if (!tx.withdrawalEarningAllocation) {
    return {
      earningId,
      earningType,
      totalReleasedCents,
      externallySettledCents: 0,
      activelyReservedCents: 0,
      unallocatedAvailableCents: totalReleasedCents,
      activeAllocations: [],
      settledAllocations: [],
      settledAllocationIds: [],
    };
  }

  const allocations = await tx.withdrawalEarningAllocation.findMany({
    where: earningType === "STORE" ? { storeEarningId: earningId } : { driverEarningId: earningId },
    include: {
      withdrawal: {
        include: {
          payoutAttempts: true,
        },
      },
    },
  });

  let externallySettledCents = 0;
  let activelyReservedCents = 0;
  const activeAllocations: ActiveWithdrawalAllocationDetail[] = [];
  const settledAllocations: SettledAllocationDetail[] = [];
  const settledAllocationIds: string[] = [];

  for (const alloc of allocations) {
    const allocCents = Math.round(Number(alloc.allocatedAmount) * 100);
    const withdrawal = alloc.withdrawal;

    const hasManualSuccess = withdrawal.payoutAttempts.some(
      (a) => a.method === "MANUAL_EXTERNAL" && a.status === "SUCCEEDED",
    ) && withdrawal.payoutLedgerJournalId !== null;

    const hasPaystackSuccess = withdrawal.payoutAttempts.some(
      (a) => a.method === "PAYSTACK_TRANSFER" && a.status === "SUCCEEDED" && (a.transferCode !== null || a.providerReference !== null),
    ) && withdrawal.payoutLedgerJournalId !== null;

    const isTerminalSettled = alloc.status === WithdrawalEarningAllocationStatus.SETTLED &&
      withdrawal.status === "PAID" &&
      (hasManualSuccess || hasPaystackSuccess);

    if (isTerminalSettled) {
      externallySettledCents += allocCents;
      settledAllocations.push({
        allocationId: alloc.id,
        withdrawalId: withdrawal.id,
        allocatedAmountCents: allocCents,
      });
      settledAllocationIds.push(alloc.id);
    } else if (alloc.status === WithdrawalEarningAllocationStatus.RESERVED) {
      const isPreProvider = withdrawal.status === "REQUESTED" ||
        withdrawal.status === "UNDER_REVIEW" ||
        (withdrawal.status === "APPROVED" && !withdrawal.payoutAttempts.some((a) => a.status === "PROCESSING"));

      const isInFlight = withdrawal.status === "PROCESSING" ||
        withdrawal.status === "RECONCILIATION_REQUIRED" ||
        withdrawal.payoutAttempts.some((a) => a.status === "PROCESSING" || a.status === "UNKNOWN");

      if (isPreProvider || isInFlight) {
        activelyReservedCents += allocCents;
        activeAllocations.push({
          allocationId: alloc.id,
          withdrawalId: withdrawal.id,
          withdrawalPublicReference: withdrawal.publicReference,
          withdrawalStatus: withdrawal.status,
          allocatedAmountCents: allocCents,
          isPreProviderCancellable: isPreProvider,
          isInFlightProcessing: isInFlight,
        });
      }
    }
  }

  const unallocatedAvailableCents = Math.max(
    0,
    totalReleasedCents - externallySettledCents - activelyReservedCents,
  );

  return {
    earningId,
    earningType,
    totalReleasedCents,
    externallySettledCents,
    activelyReservedCents,
    unallocatedAvailableCents,
    activeAllocations,
    settledAllocations,
    settledAllocationIds,
  };
}

/**
 * Evaluates the required provenance dispute split using the strict canonical precedence order:
 * 1. Externally settled exposure first -> RECOVERY_RECEIVABLE
 * 2. In-flight / reserved exposure second -> IN_FLIGHT_HOLD (or pre-provider cancelled -> RELEASED_HOLD)
 * 3. Still-available exposure third -> RELEASED_HOLD
 */
export function partitionDisputedShareByProvenance(
  summary: EarningProvenanceSummary,
  disputeShareCents: number,
): PartitionedDisputeShare {
  let remainingCents = disputeShareCents;
  const settled: Array<{ allocationId: string; amountCents: number }> = [];
  const inFlightProcessing: Array<{ allocationId: string; withdrawalId: string; amountCents: number }> = [];
  const preProviderReserved: Array<{ allocationId: string; withdrawalId: string; amountCents: number }> = [];

  // 1. Externally settled first
  for (const s of summary.settledAllocations) {
    if (remainingCents <= 0) break;
    const share = Math.min(remainingCents, s.allocatedAmountCents);
    if (share > 0) {
      settled.push({ allocationId: s.allocationId, amountCents: share });
      remainingCents -= share;
    }
  }

  // 2. In-flight / reserved second
  for (const a of summary.activeAllocations) {
    if (remainingCents <= 0) break;
    const share = Math.min(remainingCents, a.allocatedAmountCents);
    if (share > 0) {
      if (a.isPreProviderCancellable) {
        preProviderReserved.push({ allocationId: a.allocationId, withdrawalId: a.withdrawalId, amountCents: share });
      } else {
        inFlightProcessing.push({ allocationId: a.allocationId, withdrawalId: a.withdrawalId, amountCents: share });
      }
      remainingCents -= share;
    }
  }

  // 3. Still available third
  const availableCents = Math.min(remainingCents, summary.unallocatedAvailableCents);
  remainingCents -= availableCents;

  return {
    settled,
    inFlightProcessing,
    preProviderReserved,
    availableCents,
  };
}

export async function recomputeDisputeReconciliationRequired(
  tx: Prisma.TransactionClient,
  disputeId: string,
): Promise<boolean> {
  const dispute = await tx.paymentDispute.findUnique({
    where: { id: disputeId },
    include: { allocations: true },
  });
  if (!dispute) return false;

  // 1. Unresolved in-flight hold: holdingState is IN_FLIGHT_HOLD and not settled
  const hasInFlightHold = dispute.allocations.some(
    (a) => a.holdingState === "IN_FLIGHT_HOLD" && a.settledAt === null,
  );
  if (hasInFlightHold) return true;

  // 2. Unresolved LOST dispute: if dispute is LOST, any allocation that has not been settled
  if (dispute.status === "LOST") {
    const hasUnsettledLost = dispute.allocations.some((a) => a.settledAt === null);
    if (hasUnsettledLost) return true;
  }

  // 3. Provenance conservation: sum(allocations) must equal dispute amount
  const totalAllocated = dispute.allocations.reduce(
    (sum, a) => sum.add(a.allocatedAmount),
    new Prisma.Decimal(0),
  );
  if (!totalAllocated.equals(dispute.amount)) {
    return true;
  }

  // 4. Incomplete journal backing on active holds/receivables
  const hasIncompleteBacking = dispute.allocations.some((a) => {
    if (a.holdingState === "RECOVERY_RECEIVABLE") {
      return a.holdJournalId === null && a.settlementJournalId === null;
    }
    if (a.holdingState === "RELEASED_HOLD" || a.holdingState === "UNRELEASED_HELD") {
      return a.holdJournalId === null && a.settlementJournalId === null && dispute.status !== "WON";
    }
    return false;
  });
  if (hasIncompleteBacking) return true;

  return false;
}

/**
 * When a withdrawal payout succeeds, transition any linked IN_FLIGHT_HOLD dispute allocations
 * according to authoritative dispute outcome:
 * - WON dispute: financial no-op (never create receivable or hold journal)
 * - LOST dispute: finish outstanding LOST accounting exactly once (receivable + provider clearing deduction)
 * - OPEN/UNDER_REVIEW dispute: transition into RECOVERY_RECEIVABLE
 */
export async function transitionInFlightDisputesOnPayoutSuccess(
  tx: Prisma.TransactionClient,
  withdrawalId: string,
): Promise<void> {
  if (!tx.paymentDisputeAllocation) return;
  const inFlightAllocations = await tx.paymentDisputeAllocation.findMany({
    where: {
      holdingState: "IN_FLIGHT_HOLD",
      withdrawalEarningAllocation: {
        withdrawalRequestId: withdrawalId,
      },
    },
    include: {
      dispute: true,
      withdrawalEarningAllocation: true,
    },
  });

  if (inFlightAllocations.length === 0) return;

  const now = new Date();

  for (const alloc of inFlightAllocations) {
    const isDisputeWon = alloc.dispute.status === "WON";
    const isDisputeLost = alloc.dispute.status === "LOST";
    const isDisputeOpen = alloc.dispute.status === "OPEN" || alloc.dispute.status === "UNDER_REVIEW";
    const isAlreadySettled = alloc.settledAt !== null || alloc.settlementJournalId !== null;

    if (isDisputeWon || isAlreadySettled) {
      // Terminal WON dispute outcome is authoritative:
      // A component already settled by a WON dispute must be a financial no-op on later payout success.
      // Never create a recovery receivable or new hold for a WON dispute.
      if (alloc.settledAt === null) {
        await tx.paymentDisputeAllocation.update({
          where: { id: alloc.id },
          data: { settledAt: now },
        });
      }
      const requiresRecon = await recomputeDisputeReconciliationRequired(tx, alloc.disputeId);
      await tx.paymentDispute.update({
        where: { id: alloc.disputeId },
        data: { reconciliationRequired: requiresRecon },
      });
      continue;
    }

    const allocAmountStr = alloc.allocatedAmount.toFixed(2);
    const ownerType = alloc.participantType as "STORE" | "DRIVER";
    const ownerId = alloc.participantId ?? "unknown";

    const wallet = await ensureWalletForOwnerInTx(tx, {
      ownerType,
      ownerId,
      currency: "ZAR",
    });

    const receivableAccount = await resolveOwnerReceivableAccount(tx, wallet.id, ownerType, ownerId);

    if (isDisputeLost) {
      // Finish the outstanding LOST accounting exactly once!
      // Final economic result: participant recovery receivable exposure and provider chargeback clearing deduction.
      const platformWallet = await ensureWalletForOwnerInTx(tx, {
        ownerType: "PLATFORM",
        ownerId: "platform",
        currency: "ZAR",
      });
      const platformCashClearing = await ensureLedgerAccountInTx(tx, {
        walletId: platformWallet.id,
        code: "PLATFORM-CASH-CLEARING-ZAR",
        purpose: "CASH_CLEARING",
        category: "ASSET",
        currency: "ZAR",
      });

      const journal = await postLedgerJournalWithinTransaction(tx, {
        idempotencyKey: `dispute-inflight-settle-lost-success:${alloc.publicReference}`,
        type: "GENERAL",
        currency: "ZAR",
        sourceReference: `dispute:${alloc.dispute.publicReference}:lost-settle:${alloc.publicReference}`,
        correlationId: alloc.dispute.publicReference,
        memo: `In-flight LOST dispute settled to recovery receivable and provider chargeback deduction upon payout success`,
        actor: { kind: "SYSTEM" },
        metadata: {
          disputePublicReference: alloc.dispute.publicReference,
          allocationPublicReference: alloc.publicReference,
          withdrawalId,
          resolution: "LOST",
        },
        entries: [
          {
            accountId: receivableAccount.id,
            direction: "DEBIT",
            amount: allocAmountStr,
            lineCode: `${ownerType}_RECOVERY_RECEIVABLE_INFLIGHT_TRANSITION`,
          },
          {
            accountId: platformCashClearing.id,
            direction: "CREDIT",
            amount: allocAmountStr,
            lineCode: `DISPUTE_LOST_PROVIDER_CLEARING_DEDUCTION`,
          },
        ],
      });

      await tx.paymentDisputeAllocation.update({
        where: { id: alloc.id },
        data: {
          holdingState: "RECOVERY_RECEIVABLE",
          recoveryReceivableAmount: alloc.allocatedAmount,
          heldAmount: new Prisma.Decimal(0),
          settledAt: now,
          settlementJournalId: journal.id,
        },
      });

      const requiresRecon = await recomputeDisputeReconciliationRequired(tx, alloc.disputeId);
      await tx.paymentDispute.update({
        where: { id: alloc.disputeId },
        data: {
          lossLedgerJournalId: alloc.dispute.lossLedgerJournalId ?? journal.id,
          reconciliationRequired: requiresRecon,
        },
      });
    } else if (isDisputeOpen) {
      // OPEN / UNDER_REVIEW: later payout success transitions into RECOVERY_RECEIVABLE with dispute-held liability
      if (alloc.holdingState === "RECOVERY_RECEIVABLE" && alloc.holdJournalId !== null) {
        continue;
      }

      const disputeHeldAccount = await resolveOwnerDisputeHeldAccount(tx, wallet.id, ownerType, ownerId);

      const journal = await postLedgerJournalWithinTransaction(tx, {
        idempotencyKey: `dispute-inflight-settle-success:${alloc.publicReference}`,
        type: "GENERAL",
        currency: "ZAR",
        sourceReference: `dispute:${alloc.dispute.publicReference}:settle:${alloc.publicReference}`,
        correlationId: alloc.dispute.publicReference,
        memo: `In-flight dispute allocation transitioned to recovery receivable upon payout success`,
        actor: { kind: "SYSTEM" },
        metadata: {
          disputePublicReference: alloc.dispute.publicReference,
          allocationPublicReference: alloc.publicReference,
          withdrawalId,
        },
        entries: [
          {
            accountId: receivableAccount.id,
            direction: "DEBIT",
            amount: allocAmountStr,
            lineCode: `${ownerType}_RECOVERY_RECEIVABLE_INFLIGHT_TRANSITION`,
          },
          {
            accountId: disputeHeldAccount.id,
            direction: "CREDIT",
            amount: allocAmountStr,
            lineCode: `${ownerType}_DISPUTE_HELD_INFLIGHT_TRANSITION`,
          },
        ],
      });

      await tx.paymentDisputeAllocation.update({
        where: { id: alloc.id },
        data: {
          holdingState: "RECOVERY_RECEIVABLE",
          recoveryReceivableAmount: alloc.allocatedAmount,
          heldAmount: new Prisma.Decimal(0),
          ledgerAccountId: disputeHeldAccount.id,
          holdJournalId: journal.id,
        },
      });

      const requiresRecon = await recomputeDisputeReconciliationRequired(tx, alloc.disputeId);
      await tx.paymentDispute.update({
        where: { id: alloc.disputeId },
        data: { reconciliationRequired: requiresRecon },
      });
    }
  }
}

/**
 * When a withdrawal payout fails definitively, capture or handle linked IN_FLIGHT_HOLD dispute allocations
 * according to authoritative dispute outcome:
 * - WON dispute: financial no-op (never create hold or debit withdrawable)
 * - LOST dispute: capture participant funds and finish LOST chargeback accounting exactly once from restored funds
 * - OPEN/UNDER_REVIEW dispute: capture into real RELEASED_HOLD
 */
export async function transitionInFlightDisputesOnPayoutFailure(
  tx: Prisma.TransactionClient,
  withdrawalId: string,
): Promise<void> {
  if (!tx.paymentDisputeAllocation) return;
  const inFlightAllocations = await tx.paymentDisputeAllocation.findMany({
    where: {
      holdingState: "IN_FLIGHT_HOLD",
      withdrawalEarningAllocation: {
        withdrawalRequestId: withdrawalId,
      },
    },
    include: {
      dispute: true,
      withdrawalEarningAllocation: true,
    },
  });

  if (inFlightAllocations.length === 0) return;

  const now = new Date();

  for (const alloc of inFlightAllocations) {
    const isDisputeWon = alloc.dispute.status === "WON";
    const isDisputeLost = alloc.dispute.status === "LOST";
    const isDisputeOpen = alloc.dispute.status === "OPEN" || alloc.dispute.status === "UNDER_REVIEW";
    const isAlreadySettled = alloc.settledAt !== null || alloc.settlementJournalId !== null;

    if (isDisputeWon || isAlreadySettled) {
      // Terminal WON dispute outcome is authoritative:
      // A component already settled by a WON dispute must be a financial no-op on later payout failure.
      // Never create a new hold or debit withdrawable.
      if (alloc.settledAt === null) {
        await tx.paymentDisputeAllocation.update({
          where: { id: alloc.id },
          data: { settledAt: now },
        });
      }
      const requiresRecon = await recomputeDisputeReconciliationRequired(tx, alloc.disputeId);
      await tx.paymentDispute.update({
        where: { id: alloc.disputeId },
        data: { reconciliationRequired: requiresRecon },
      });
      continue;
    }

    const allocAmountStr = alloc.allocatedAmount.toFixed(2);
    const ownerType = alloc.participantType as "STORE" | "DRIVER";
    const ownerId = alloc.participantId ?? "unknown";

    const wallet = await ensureWalletForOwnerInTx(tx, {
      ownerType,
      ownerId,
      currency: "ZAR",
    });

    const ownerWithdrawable = await resolveOwnerWithdrawableAccount(tx, wallet.id);

    if (isDisputeLost) {
      // Finish the outstanding LOST accounting exactly once from restored withdrawable funds!
      // Final economic result: reduce owner's withdrawable liability and recognize provider cash deduction.
      const platformWallet = await ensureWalletForOwnerInTx(tx, {
        ownerType: "PLATFORM",
        ownerId: "platform",
        currency: "ZAR",
      });
      const platformCashClearing = await ensureLedgerAccountInTx(tx, {
        walletId: platformWallet.id,
        code: "PLATFORM-CASH-CLEARING-ZAR",
        purpose: "CASH_CLEARING",
        category: "ASSET",
        currency: "ZAR",
      });

      const journal = await postLedgerJournalWithinTransaction(tx, {
        idempotencyKey: `dispute-inflight-settle-lost-failure:${alloc.publicReference}`,
        type: "GENERAL",
        currency: "ZAR",
        sourceReference: `dispute:${alloc.dispute.publicReference}:lost-failure:${alloc.publicReference}`,
        correlationId: alloc.dispute.publicReference,
        memo: `In-flight LOST dispute captured from restored withdrawable funds to provider clearing deduction upon payout failure`,
        actor: { kind: "SYSTEM" },
        metadata: {
          disputePublicReference: alloc.dispute.publicReference,
          allocationPublicReference: alloc.publicReference,
          withdrawalId,
          resolution: "LOST",
        },
        entries: [
          {
            accountId: ownerWithdrawable.id,
            direction: "DEBIT",
            amount: allocAmountStr,
            lineCode: `${ownerType}_AVAILABLE_DISPUTE_HOLD_INFLIGHT_TRANSITION`,
          },
          {
            accountId: platformCashClearing.id,
            direction: "CREDIT",
            amount: allocAmountStr,
            lineCode: `DISPUTE_LOST_PROVIDER_CLEARING_DEDUCTION`,
          },
        ],
      });

      await tx.paymentDisputeAllocation.update({
        where: { id: alloc.id },
        data: {
          holdingState: "RELEASED_HOLD",
          heldAmount: new Prisma.Decimal(0),
          recoveryReceivableAmount: new Prisma.Decimal(0),
          settledAt: now,
          settlementJournalId: journal.id,
        },
      });

      const requiresRecon = await recomputeDisputeReconciliationRequired(tx, alloc.disputeId);
      await tx.paymentDispute.update({
        where: { id: alloc.disputeId },
        data: {
          lossLedgerJournalId: alloc.dispute.lossLedgerJournalId ?? journal.id,
          reconciliationRequired: requiresRecon,
        },
      });
    } else if (isDisputeOpen) {
      if (alloc.holdingState === "RELEASED_HOLD" && alloc.holdJournalId !== null) {
        continue;
      }

      const disputeHeldAccount = await resolveOwnerDisputeHeldAccount(tx, wallet.id, ownerType, ownerId);

      const journal = await postLedgerJournalWithinTransaction(tx, {
        idempotencyKey: `dispute-inflight-capture-failure:${alloc.publicReference}`,
        type: "GENERAL",
        currency: "ZAR",
        sourceReference: `dispute:${alloc.dispute.publicReference}:capture:${alloc.publicReference}`,
        correlationId: alloc.dispute.publicReference,
        memo: `In-flight dispute allocation captured into released hold upon payout failure`,
        actor: { kind: "SYSTEM" },
        metadata: {
          disputePublicReference: alloc.dispute.publicReference,
          allocationPublicReference: alloc.publicReference,
          withdrawalId,
        },
        entries: [
          {
            accountId: ownerWithdrawable.id,
            direction: "DEBIT",
            amount: allocAmountStr,
            lineCode: `${ownerType}_AVAILABLE_DISPUTE_HOLD_INFLIGHT_TRANSITION`,
          },
          {
            accountId: disputeHeldAccount.id,
            direction: "CREDIT",
            amount: allocAmountStr,
            lineCode: `${ownerType}_DISPUTE_HELD_INFLIGHT_TRANSITION`,
          },
        ],
      });

      await tx.paymentDisputeAllocation.update({
        where: { id: alloc.id },
        data: {
          holdingState: "RELEASED_HOLD",
          heldAmount: alloc.allocatedAmount,
          recoveryReceivableAmount: new Prisma.Decimal(0),
          ledgerAccountId: disputeHeldAccount.id,
          holdJournalId: journal.id,
        },
      });

      const requiresRecon = await recomputeDisputeReconciliationRequired(tx, alloc.disputeId);
      await tx.paymentDispute.update({
        where: { id: alloc.disputeId },
        data: { reconciliationRequired: requiresRecon },
      });
    }
  }
}
