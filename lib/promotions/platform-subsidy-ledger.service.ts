import { Prisma } from "@prisma/client";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";

export const PLATFORM_PROMOTION_EXPENSE_ACCOUNT_CODE = "PLATFORM-PROMOTION-EXPENSE-ZAR";
export const PLATFORM_CUSTOMER_FUNDS_HELD_ACCOUNT_CODE = "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR";

export class PlatformSubsidyLedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformSubsidyLedgerError";
  }
}

/**
 * Asserts the existence, currency, and active status of both canonical platform subsidy ledger accounts.
 * Fails closed if either account is missing, inactive, or not ZAR.
 */
async function assertSubsidyAccounts(tx: Prisma.TransactionClient) {
  const platformExpenseAccount = await tx.ledgerAccount.findUnique({
    where: { code: PLATFORM_PROMOTION_EXPENSE_ACCOUNT_CODE },
  });
  const customerHeldAccount = await tx.ledgerAccount.findUnique({
    where: { code: PLATFORM_CUSTOMER_FUNDS_HELD_ACCOUNT_CODE },
  });

  if (!platformExpenseAccount || !customerHeldAccount) {
    throw new PlatformSubsidyLedgerError(
      `Canonical platform subsidy ledger accounts (${PLATFORM_PROMOTION_EXPENSE_ACCOUNT_CODE} or ${PLATFORM_CUSTOMER_FUNDS_HELD_ACCOUNT_CODE}) are missing.`
    );
  }

  if (platformExpenseAccount.currency !== "ZAR" || customerHeldAccount.currency !== "ZAR") {
    throw new PlatformSubsidyLedgerError("Canonical platform subsidy ledger accounts must have currency ZAR.");
  }

  if (platformExpenseAccount.status !== "ACTIVE" || customerHeldAccount.status !== "ACTIVE") {
    throw new PlatformSubsidyLedgerError("Canonical platform subsidy ledger accounts must be ACTIVE.");
  }

  return { platformExpenseAccount, customerHeldAccount };
}

/**
 * Posts the canonical promotional platform subsidy journal for a paid marketplace order.
 * Fails closed within the transaction if required accounts are unavailable.
 */
export async function postPlatformSubsidyJournalInTx(
  tx: Prisma.TransactionClient,
  params: {
    orderId: string;
    orderPublicReference: string;
    amount: Prisma.Decimal | string;
  }
): Promise<{ reference: string }> {
  const subsidyAmount = new Prisma.Decimal(params.amount);
  if (subsidyAmount.lessThanOrEqualTo(0)) {
    throw new PlatformSubsidyLedgerError("Subsidy amount must be strictly positive to post a subsidy journal.");
  }

  const { platformExpenseAccount, customerHeldAccount } = await assertSubsidyAccounts(tx);

  const journal = await postLedgerJournalWithinTransaction(tx, {
    idempotencyKey: `LJ-PROMO-SUBSIDY-${params.orderId}`,
    type: "GENERAL",
    currency: "ZAR",
    sourceReference: params.orderPublicReference,
    correlationId: params.orderId,
    memo: `Platform Promotion Subsidy for order ${params.orderPublicReference}`,
    actor: { kind: "SYSTEM" },
    entries: [
      {
        accountId: platformExpenseAccount.id,
        direction: "DEBIT",
        amount: subsidyAmount.toFixed(2),
        lineCode: "PLATFORM_PROMO_EXPENSE",
        memo: `Debit platform promotional subsidy for order ${params.orderPublicReference}`,
      },
      {
        accountId: customerHeldAccount.id,
        direction: "CREDIT",
        amount: subsidyAmount.toFixed(2),
        lineCode: "CUSTOMER_FUNDS_PROMO_CREDIT",
        memo: `Credit customer funds held promotional subsidy for order ${params.orderPublicReference}`,
      },
    ],
  });

  return { reference: journal.reference };
}

/**
 * Reverses the canonical promotional platform subsidy journal for a store order adjustment.
 * Fails closed within the transaction if required accounts are unavailable.
 */
export async function reversePlatformSubsidyJournalInTx(
  tx: Prisma.TransactionClient,
  params: {
    adjustmentId: string;
    adjustmentPublicReference: string;
    amount: Prisma.Decimal | string;
  }
): Promise<{ reference: string }> {
  const subsidyAmount = new Prisma.Decimal(params.amount);
  if (subsidyAmount.lessThanOrEqualTo(0)) {
    throw new PlatformSubsidyLedgerError("Subsidy reversal amount must be strictly positive to post a reversal journal.");
  }

  const { platformExpenseAccount, customerHeldAccount } = await assertSubsidyAccounts(tx);

  const reversalJournal = await postLedgerJournalWithinTransaction(tx, {
    idempotencyKey: `LJ-PROMO-REV-${params.adjustmentId}`,
    type: "GENERAL",
    currency: "ZAR",
    sourceReference: params.adjustmentPublicReference,
    correlationId: params.adjustmentId,
    memo: `Platform Promotion Subsidy Reversal for adjustment ${params.adjustmentPublicReference}`,
    actor: { kind: "SYSTEM" },
    entries: [
      {
        accountId: customerHeldAccount.id,
        direction: "DEBIT",
        amount: subsidyAmount.toFixed(2),
        lineCode: "CUSTOMER_FUNDS_PROMO_DEBIT",
        memo: `Debit customer funds held platform subsidy reversal`,
      },
      {
        accountId: platformExpenseAccount.id,
        direction: "CREDIT",
        amount: subsidyAmount.toFixed(2),
        lineCode: "PLATFORM_PROMO_CREDIT",
        memo: `Credit platform promotional expense reversal`,
      },
    ],
  });

  return { reference: reversalJournal.reference };
}
