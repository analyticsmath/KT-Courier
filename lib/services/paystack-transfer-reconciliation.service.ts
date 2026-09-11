import { prisma } from "@/lib/db/prisma";
import { PaystackClient } from "@/lib/payments/providers/paystack/paystack-client";
import { resolvePaystackConfiguration } from "@/lib/payments/providers/paystack/paystack-config";
import {
  handlePaystackTransferSuccess,
  handlePaystackTransferFailed,
  handlePaystackTransferReversed,
} from "./paystack-transfer-execution.service";

export interface ScanPaystackTransferReconciliationOptions {
  limit?: number;
  staleThresholdMinutes?: number;
  clientOverride?: PaystackClient;
}

export interface ScanPaystackTransferReconciliationResult {
  itemsExamined: number;
  itemsSucceeded: number;
  itemsFailed: number;
  itemsReversed: number;
  itemsPending: number;
  itemsErrored: number;
  safeSummary: string;
}

export async function scanPaystackTransferReconciliation(
  options: ScanPaystackTransferReconciliationOptions = {},
): Promise<ScanPaystackTransferReconciliationResult> {
  const limit = options.limit ?? 50;
  const staleThresholdMinutes = options.staleThresholdMinutes ?? 15;
  const staleCutoff = new Date(Date.now() - staleThresholdMinutes * 60 * 1000);

  const secretKey = resolvePaystackConfiguration().runtime?.secretKey ?? process.env.PAYSTACK_SECRET_KEY?.trim();
  const client = options.clientOverride ?? (secretKey ? new PaystackClient({ secretKey }) : null);

  if (!client) {
    return {
      itemsExamined: 0,
      itemsSucceeded: 0,
      itemsFailed: 0,
      itemsReversed: 0,
      itemsPending: 0,
      itemsErrored: 0,
      safeSummary: "Paystack client not configured; reconciliation skipped.",
    };
  }

  const candidates = await prisma.withdrawalPayoutAttempt.findMany({
    where: {
      status: { in: ["PROCESSING", "UNKNOWN"] },
      externalReference: { not: null, startsWith: "kt_wpa_" },
      OR: [
        { lastPolledAt: null, createdAt: { lte: staleCutoff } },
        { lastPolledAt: { lte: staleCutoff } },
      ],
    },
    include: {
      withdrawal: {
        include: { payoutDestination: true },
      },
    },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  let itemsSucceeded = 0;
  let itemsFailed = 0;
  let itemsReversed = 0;
  let itemsPending = 0;
  let itemsErrored = 0;

  for (const attempt of candidates) {
    if (!attempt.externalReference) continue;

    try {
      const transferData = await client.verifyTransfer(attempt.externalReference);
      const providerStatus = (transferData.status || "").toLowerCase();

      if (providerStatus === "success") {
        const recipientCode = typeof transferData.recipient === "object" && transferData.recipient !== null
          ? (transferData.recipient as { recipient_code?: string }).recipient_code
          : undefined;

        await handlePaystackTransferSuccess({
          merchantReference: attempt.externalReference,
          transferCode: transferData.transfer_code,
          amountCents: transferData.amount,
          currency: transferData.currency || "ZAR",
          recipientCode,
        });
        itemsSucceeded += 1;
      } else if (providerStatus === "failed" || providerStatus === "rejected") {
        await handlePaystackTransferFailed({
          merchantReference: attempt.externalReference,
          transferCode: transferData.transfer_code,
          failureMessage: transferData.reason || "Paystack reported transfer failure during reconciliation scan.",
        });
        itemsFailed += 1;
      } else if (providerStatus === "reversed") {
        await handlePaystackTransferReversed({
          merchantReference: attempt.externalReference,
          transferCode: transferData.transfer_code,
          reason: transferData.reason || "Paystack reported transfer reversed during reconciliation scan.",
        });
        itemsReversed += 1;
      } else {
        // Still pending or processing at provider
        await prisma.withdrawalPayoutAttempt.update({
          where: { id: attempt.id },
          data: { lastPolledAt: new Date() },
        });
        itemsPending += 1;
      }
    } catch {
      itemsErrored += 1;
      await prisma.withdrawalPayoutAttempt.update({
        where: { id: attempt.id },
        data: { lastPolledAt: new Date() },
      }).catch(() => undefined);
    }
  }

  return {
    itemsExamined: candidates.length,
    itemsSucceeded,
    itemsFailed,
    itemsReversed,
    itemsPending,
    itemsErrored,
    safeSummary: `Examined ${candidates.length} stale payout attempts: ${itemsSucceeded} succeeded, ${itemsFailed} failed, ${itemsReversed} reversed, ${itemsPending} pending, ${itemsErrored} errored.`,
  };
}
