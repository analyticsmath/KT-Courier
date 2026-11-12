import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { LedgerError } from "@/lib/ledger/errors";
import { PaymentError } from "@/lib/payments/errors";
import { PAYMENT_POLICY_VERSION } from "@/lib/payments/types";
import { canonicalPaymentHash } from "@/lib/payments/hash";
import { toPaymentSummaryDto } from "@/lib/payments/payment-dto-mappers";
import type { PaymentSummaryDto } from "@/lib/dto/payment.dto";
import {
  ensureLedgerAccountInTx,
  ensureWalletForOwnerInTx,
} from "./wallet-account.service";
import { postLedgerJournalWithinTransaction } from "./ledger-posting.service";
import { resolveOrderPaymentSubject } from "./payment-subject.service";
import { activateDepositCashOnDeliveryWithinTransaction } from "./cash-on-delivery.service";
import { transitionOrderStatusInTx } from "./order-status.service";
import { customerAccountPrefix } from "./customer-wallet.service";

export type WalletOwner = Readonly<{
  ownerType: "CUSTOMER" | "STORE";
  ownerId: string;
}>;

export type WalletSpendSubject = Readonly<{
  subjectType: "COURIER_ORDER" | "MARKETPLACE_CHECKOUT";
  subjectId: string;
  subjectReference: string;
}>;

export type WalletSpendBreakdown = Readonly<{
  payableAmount: string;
  walletAmount: string;
  remainingProviderAmount: string;
  mode: "WALLET_ONLY" | "SPLIT_PAYSTACK" | "PROVIDER_ONLY";
}>;

function storeAccountPrefix(storeId: string): string {
  return `STORE-${storeId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24).toUpperCase()}`;
}

export function newPublicPaymentReference(): string {
  return `pay_${randomBytes(18).toString("base64url")}`;
}

export function resolveWalletSpendBreakdown(input: {
  payableAmount: string;
  availableBalance: string;
  requestedWalletAmount?: string | null;
}): WalletSpendBreakdown {
  const payableDec = new Prisma.Decimal(input.payableAmount);
  if (payableDec.lessThanOrEqualTo(0)) {
    throw new PaymentError("PAYMENT_INVALID_AMOUNT", "Payable amount must be positive.");
  }
  const availDec = new Prisma.Decimal(input.availableBalance ?? "0.00");
  const reqStr = (input.requestedWalletAmount ?? "").trim();
  let walletDec = new Prisma.Decimal(0);
  if (reqStr && reqStr !== "0.00") {
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(reqStr)) {
      throw new PaymentError("PAYMENT_INVALID_AMOUNT", "Wallet spend amount is invalid.");
    }
    walletDec = new Prisma.Decimal(reqStr);
    if (walletDec.gt(availDec)) {
      throw new PaymentError("PAYMENT_WALLET_INSUFFICIENT_FUNDS", "Wallet balance is insufficient.");
    }
    if (walletDec.gt(payableDec)) {
      throw new PaymentError("PAYMENT_WALLET_EXCEEDS_PAYABLE", "Wallet spend amount cannot exceed total payable.");
    }
  }

  const walletAmount = walletDec.toFixed(2);
  const remainingDec = payableDec.sub(walletDec);
  const remainingProviderAmount = remainingDec.toFixed(2);
  const mode = walletDec.equals(payableDec)
    ? "WALLET_ONLY"
    : walletDec.gt(0)
      ? "SPLIT_PAYSTACK"
      : "PROVIDER_ONLY";

  return Object.freeze({
    payableAmount: payableDec.toFixed(2),
    walletAmount,
    remainingProviderAmount,
    mode,
  });
}

export async function getWalletSpendableBalance(
  tx: Prisma.TransactionClient,
  owner: WalletOwner,
): Promise<{ availableAmount: string; accountId: string; walletId: string }> {
  const wallet = await tx.wallet.findUnique({
    where: {
      ownerType_ownerId_currency: {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        currency: "ZAR",
      },
    },
    include: {
      accounts: {
        where: {
          purpose: owner.ownerType === "CUSTOMER"
            ? "CUSTOMER_WALLET_AVAILABLE"
            : "STORE_REFERRAL_WALLET_AVAILABLE",
          currency: "ZAR",
        },
      },
    },
  });

  const account = wallet?.accounts[0];
  if (!wallet || wallet.status !== "ACTIVE" || !account || account.status !== "ACTIVE" || account.allowNegative) {
    return { availableAmount: "0.00", accountId: "", walletId: wallet?.id ?? "" };
  }

  return {
    availableAmount: account.currentBalance.toFixed(2),
    accountId: account.id,
    walletId: wallet.id,
  };
}

export async function ensureWalletAvailableAccountInTx(
  tx: Prisma.TransactionClient,
  owner: WalletOwner,
) {
  const wallet = await ensureWalletForOwnerInTx(tx, {
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    currency: "ZAR",
  });

  const prefix = owner.ownerType === "CUSTOMER"
    ? customerAccountPrefix(owner.ownerId)
    : storeAccountPrefix(owner.ownerId);

  const code = owner.ownerType === "CUSTOMER"
    ? `${prefix}-WALLET-ZAR`
    : `${prefix}-REFERRAL-ZAR`;

  const purpose = owner.ownerType === "CUSTOMER"
    ? "CUSTOMER_WALLET_AVAILABLE"
    : "STORE_REFERRAL_WALLET_AVAILABLE";

  return ensureLedgerAccountInTx(tx, {
    walletId: wallet.id,
    code,
    purpose,
    category: "LIABILITY",
    currency: "ZAR",
  });
}

export async function ensureWalletReserveAccountInTx(
  tx: Prisma.TransactionClient,
  owner: WalletOwner,
) {
  const wallet = await ensureWalletForOwnerInTx(tx, {
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    currency: "ZAR",
  });

  const prefix = owner.ownerType === "CUSTOMER"
    ? customerAccountPrefix(owner.ownerId)
    : storeAccountPrefix(owner.ownerId);

  const code = owner.ownerType === "CUSTOMER"
    ? `${prefix}-WALLET-RESERVED-ZAR`
    : `${prefix}-REFERRAL-RESERVED-ZAR`;

  return ensureLedgerAccountInTx(tx, {
    walletId: wallet.id,
    code,
    purpose: "HELD",
    category: "LIABILITY",
    currency: "ZAR",
  });
}

export async function ensurePlatformCustomerFundsHeldAccountInTx(
  tx: Prisma.TransactionClient,
) {
  const platformWallet = await ensureWalletForOwnerInTx(tx, {
    ownerType: "PLATFORM",
    ownerId: "platform",
    currency: "ZAR",
  });

  return ensureLedgerAccountInTx(tx, {
    walletId: platformWallet.id,
    code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR",
    purpose: "HELD",
    category: "LIABILITY",
    currency: "ZAR",
  });
}

export async function reserveWalletSpendWithinTransaction(
  tx: Prisma.TransactionClient,
  input: {
    owner: WalletOwner;
    amount: string;
    operationId: string;
    subject: WalletSpendSubject;
    actorUserId?: string;
  },
): Promise<{ journalId: string; amount: string; replayed: boolean }> {
  const amountDec = new Prisma.Decimal(input.amount);
  if (amountDec.lessThanOrEqualTo(0)) {
    throw new LedgerError("LEDGER_INVALID_AMOUNT", "Reserved amount must be positive.");
  }

  const idempotencyKey = `wallet-reserve:${input.operationId}`;
  const existing = await tx.ledgerJournal.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    return { journalId: existing.id, amount: input.amount, replayed: true };
  }

  const available = await ensureWalletAvailableAccountInTx(tx, input.owner);
  const reserve = await ensureWalletReserveAccountInTx(tx, input.owner);

  // Lock available account row
  const locked = await tx.$queryRaw<Array<{ id: string; currentBalance: Prisma.Decimal }>>(
    Prisma.sql`SELECT "id", "currentBalance" FROM "LedgerAccount" WHERE "id" = ${available.id} FOR UPDATE`
  );
  if (locked.length === 0 || locked[0].currentBalance.lessThan(amountDec)) {
    throw new PaymentError("PAYMENT_WALLET_INSUFFICIENT_FUNDS", "Wallet balance is insufficient for reservation.");
  }

  const journal = await postLedgerJournalWithinTransaction(tx, {
    idempotencyKey,
    type: "ACCOUNT_TRANSFER",
    currency: "ZAR",
    sourceReference: `WALLET_RESERVE:${input.subject.subjectReference}`,
    correlationId: input.subject.subjectReference,
    memo: `Wallet spend reserved for ${input.subject.subjectReference}`,
    actor: input.actorUserId
      ? { kind: "USER", userId: input.actorUserId }
      : { kind: "SYSTEM" },
    metadata: {
      category: "WALLET_SPEND_RESERVATION",
      operationId: input.operationId,
      ownerType: input.owner.ownerType,
      ownerId: input.owner.ownerId,
      subjectType: input.subject.subjectType,
      subjectId: input.subject.subjectId,
      subjectReference: input.subject.subjectReference,
      amount: input.amount,
    },
    entries: [
      {
        accountId: available.id,
        direction: "DEBIT",
        amount: input.amount,
        lineCode: "WALLET_SPEND_AVAILABLE_DEBIT",
      },
      {
        accountId: reserve.id,
        direction: "CREDIT",
        amount: input.amount,
        lineCode: "WALLET_SPEND_RESERVE_CREDIT",
      },
    ],
  });

  return { journalId: journal.id, amount: input.amount, replayed: false };
}

export async function releaseWalletSpendWithinTransaction(
  tx: Prisma.TransactionClient,
  input: {
    owner: WalletOwner;
    amount: string;
    operationId: string;
    subject: WalletSpendSubject;
    reason: string;
    actorUserId?: string;
  },
): Promise<{ journalId: string; amount: string; replayed: boolean }> {
  const amountDec = new Prisma.Decimal(input.amount);
  if (amountDec.lessThanOrEqualTo(0)) {
    throw new LedgerError("LEDGER_INVALID_AMOUNT", "Released amount must be positive.");
  }

  const idempotencyKey = `wallet-release:${input.operationId}`;
  const existing = await tx.ledgerJournal.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    return { journalId: existing.id, amount: input.amount, replayed: true };
  }

  const available = await ensureWalletAvailableAccountInTx(tx, input.owner);
  const reserve = await ensureWalletReserveAccountInTx(tx, input.owner);

  // Lock reserve account row
  const locked = await tx.$queryRaw<Array<{ id: string; currentBalance: Prisma.Decimal }>>(
    Prisma.sql`SELECT "id", "currentBalance" FROM "LedgerAccount" WHERE "id" = ${reserve.id} FOR UPDATE`
  );
  if (locked.length === 0 || locked[0].currentBalance.lessThan(amountDec)) {
    throw new PaymentError("PAYMENT_WALLET_INSUFFICIENT_FUNDS", "Reserved wallet balance is insufficient for release.");
  }

  const journal = await postLedgerJournalWithinTransaction(tx, {
    idempotencyKey,
    type: "ACCOUNT_TRANSFER",
    currency: "ZAR",
    sourceReference: `WALLET_RELEASE:${input.subject.subjectReference}`,
    correlationId: input.subject.subjectReference,
    memo: `Wallet reservation released: ${input.reason}`,
    actor: input.actorUserId
      ? { kind: "USER", userId: input.actorUserId }
      : { kind: "SYSTEM" },
    metadata: {
      category: "WALLET_SPEND_RELEASE",
      operationId: input.operationId,
      ownerType: input.owner.ownerType,
      ownerId: input.owner.ownerId,
      subjectType: input.subject.subjectType,
      subjectId: input.subject.subjectId,
      subjectReference: input.subject.subjectReference,
      amount: input.amount,
      reason: input.reason,
    },
    entries: [
      {
        accountId: reserve.id,
        direction: "DEBIT",
        amount: input.amount,
        lineCode: "WALLET_SPEND_RESERVE_DEBIT",
      },
      {
        accountId: available.id,
        direction: "CREDIT",
        amount: input.amount,
        lineCode: "WALLET_SPEND_AVAILABLE_RESTORE",
      },
    ],
  });

  return { journalId: journal.id, amount: input.amount, replayed: false };
}

export async function consumeWalletSpendWithinTransaction(
  tx: Prisma.TransactionClient,
  input: {
    owner: WalletOwner;
    amount: string;
    operationId: string;
    subject: WalletSpendSubject;
    fromReserved: boolean;
    correlationId?: string;
    actorUserId?: string;
  },
): Promise<{ journalId: string; journalReference: string; amount: string; replayed: boolean }> {
  const amountDec = new Prisma.Decimal(input.amount);
  if (amountDec.lessThanOrEqualTo(0)) {
    throw new LedgerError("LEDGER_INVALID_AMOUNT", "Consumed amount must be positive.");
  }

  const idempotencyKey = `wallet-consume:${input.operationId}`;
  const existing = await tx.ledgerJournal.findUnique({
    where: { idempotencyKey },
    select: { id: true, reference: true },
  });
  if (existing) {
    return {
      journalId: existing.id,
      journalReference: existing.reference,
      amount: input.amount,
      replayed: true,
    };
  }

  const sourceAccount = input.fromReserved
    ? await ensureWalletReserveAccountInTx(tx, input.owner)
    : await ensureWalletAvailableAccountInTx(tx, input.owner);

  const platformHeld = await ensurePlatformCustomerFundsHeldAccountInTx(tx);

  // Lock source account row
  const locked = await tx.$queryRaw<Array<{ id: string; currentBalance: Prisma.Decimal }>>(
    Prisma.sql`SELECT "id", "currentBalance" FROM "LedgerAccount" WHERE "id" = ${sourceAccount.id} FOR UPDATE`
  );
  if (locked.length === 0 || locked[0].currentBalance.lessThan(amountDec)) {
    throw new PaymentError("PAYMENT_WALLET_INSUFFICIENT_FUNDS", "Wallet balance is insufficient for consumption.");
  }

  const correlation = input.correlationId ?? input.subject.subjectReference;
  const journal = await postLedgerJournalWithinTransaction(tx, {
    idempotencyKey,
    type: "ACCOUNT_TRANSFER",
    currency: "ZAR",
    sourceReference: `WALLET_CONSUME:${input.subject.subjectReference}`,
    correlationId: correlation,
    memo: `Wallet funds applied to ${input.subject.subjectReference}`,
    actor: input.actorUserId
      ? { kind: "USER", userId: input.actorUserId }
      : { kind: "SYSTEM" },
    metadata: {
      category: "WALLET_SPEND_CONSUMPTION",
      operationId: input.operationId,
      ownerType: input.owner.ownerType,
      ownerId: input.owner.ownerId,
      subjectType: input.subject.subjectType,
      subjectId: input.subject.subjectId,
      subjectReference: input.subject.subjectReference,
      amount: input.amount,
      fromReserved: input.fromReserved,
    },
    entries: [
      {
        accountId: sourceAccount.id,
        direction: "DEBIT",
        amount: input.amount,
        lineCode: input.fromReserved
          ? "WALLET_RESERVE_CONSUMPTION"
          : "WALLET_AVAILABLE_CONSUMPTION",
      },
      {
        accountId: platformHeld.id,
        direction: "CREDIT",
        amount: input.amount,
        lineCode: "CUSTOMER_FUNDS_HELD",
      },
    ],
  });

  return {
    journalId: journal.id,
    journalReference: journal.reference,
    amount: input.amount,
    replayed: false,
  };
}

/** Wallet-funded parcels use the same audited status history as card funding. */
export async function recordWalletCourierConfirmationInTx(
  tx: Prisma.TransactionClient,
  input: Readonly<{
    orderId: string;
    orderStatus: import("@prisma/client").OrderStatus;
    payerUserId: string;
    pricingSnapshot: unknown;
    walletAmount: string;
    journalId: string;
    settledAt: Date;
  }>,
): Promise<void> {
  await transitionOrderStatusInTx(tx, {
    orderId: input.orderId,
    fromStatus: input.orderStatus,
    toStatus: "CONFIRMED",
    actorRole: "SYSTEM",
    actorUserId: input.payerUserId,
    source: "wallet_funded_courier_order",
    note: "Parcel funded using verified wallet balance.",
    context: { isPaid: true },
  });
  await tx.order.update({
    where: { id: input.orderId },
    data: {
      pricingSnapshot: {
        ...(input.pricingSnapshot && typeof input.pricingSnapshot === "object" &&
          !Array.isArray(input.pricingSnapshot)
          ? input.pricingSnapshot as Record<string, unknown>
          : {}),
        walletFunding: {
          walletAmount: input.walletAmount,
          providerAmount: "0.00",
          journalId: input.journalId,
          settledAt: input.settledAt.toISOString(),
        },
      } as Prisma.InputJsonValue,
    },
  });
}

export async function spendWalletForParcelOrderWithinTransaction(
  tx: Prisma.TransactionClient,
  input: {
    payer: Readonly<{ id: string; email?: string }>;
    orderId: string;
    idempotencyKey: string;
    walletAmount?: string | null;
  },
): Promise<PaymentSummaryDto | null> {
  const PAYMENT_SUMMARY_INCLUDE = {
    order: { select: { id: true, orderNumber: true } },
    user: { select: { id: true, name: true } },
  } as const;

  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${input.orderId} FOR UPDATE`;
  const subject = await resolveOrderPaymentSubject(input.orderId, input.payer.id, tx);
  const payable = subject.amount.toString();

  const order = await tx.order.findUniqueOrThrow({
    where: { id: input.orderId },
    include: { store: { select: { id: true, ownerUserId: true } }, cashOnDelivery: true },
  });

  const isStoreOrder = Boolean(order.store && order.store.ownerUserId === input.payer.id);
  const owner: WalletOwner = isStoreOrder
    ? { ownerType: "STORE", ownerId: order.store!.id }
    : { ownerType: "CUSTOMER", ownerId: input.payer.id };

  const walletBalance = await getWalletSpendableBalance(tx, owner);
  const breakdown = resolveWalletSpendBreakdown({
    payableAmount: payable,
    availableBalance: walletBalance.availableAmount,
    requestedWalletAmount: input.walletAmount,
  });

  if (breakdown.mode === "PROVIDER_ONLY") {
    return null;
  }

  const requestHash = canonicalPaymentHash({
    subjectType: subject.subjectType,
    orderId: subject.subjectId,
    payerId: subject.payerUserId,
    amount: breakdown.mode === "WALLET_ONLY" ? payable : breakdown.remainingProviderAmount,
    currency: subject.currency,
    policyVersion: PAYMENT_POLICY_VERSION,
    walletAmount: input.walletAmount,
    fundingSource: "WALLET",
  });

  const existingForOrder = await tx.payment.findUnique({
    where: { orderId: subject.subjectId },
    include: PAYMENT_SUMMARY_INCLUDE,
  });
  if (existingForOrder) {
    if (existingForOrder.creationIdempotencyKey !== input.idempotencyKey || existingForOrder.creationRequestHash !== requestHash) {
      throw new PaymentError("PAYMENT_IDEMPOTENCY_CONFLICT", "Order already has a payment under different key or evidence.");
    }
    return toPaymentSummaryDto(existingForOrder);
  }

  const publicReference = newPublicPaymentReference();

  const now = new Date();

  if (breakdown.mode === "WALLET_ONLY") {
    // Immediate full wallet settlement!
    const consume = await consumeWalletSpendWithinTransaction(tx, {
      owner,
      amount: payable,
      operationId: input.idempotencyKey,
      subject: {
        subjectType: "COURIER_ORDER",
        subjectId: order.id,
        subjectReference: order.orderNumber,
      },
      fromReserved: false,
      correlationId: publicReference,
      actorUserId: input.payer.id,
    });

    const payment = await tx.payment.create({
      data: {
        publicReference,
        orderId: subject.subjectId,
        userId: subject.payerUserId,
        subjectType: "COURIER_ORDER",
        provider: "MANUAL",
        purpose: "ORDER",
        status: "SUCCEEDED",
        amount: new Prisma.Decimal(payable),
        currency: "ZAR",
        creationIdempotencyKey: input.idempotencyKey,
        creationRequestHash: requestHash,
        version: 1,
        latestAttemptNumber: 0,
        successLedgerJournalId: consume.journalId,
        succeededAt: now,
        metadata: {
          subjectType: "ORDER",
          policyVersion: PAYMENT_POLICY_VERSION,
          walletSettled: true,
          walletAmount: payable,
          walletJournalId: consume.journalId,
          walletOwnerType: owner.ownerType,
          walletOwnerId: owner.ownerId,
        },
      },
      include: PAYMENT_SUMMARY_INCLUDE,
    });

    await tx.paymentStatusHistory.create({
      data: {
        paymentId: payment.id,
        fromStatus: null,
        toStatus: "SUCCEEDED",
        reasonCode: "WALLET_FULL_PAYMENT",
        actorType: "PAYER",
        actorId: input.payer.id,
        metadata: {
          policyVersion: PAYMENT_POLICY_VERSION,
          ledgerJournalReference: consume.journalReference,
        },
      },
    });

    await recordWalletCourierConfirmationInTx(tx, {
      orderId: order.id,
      orderStatus: order.status,
      payerUserId: input.payer.id,
      pricingSnapshot: order.pricingSnapshot,
      walletAmount: payable,
      journalId: consume.journalId,
      settledAt: now,
    });

    // If COD was zero digital requirement, activate COD
    if (order.cashOnDelivery) {
      await activateDepositCashOnDeliveryWithinTransaction(tx, {
        paymentId: payment.id,
        orderId: order.id,
        amount: payment.amount,
        verifiedEventReference: `wallet-full:${order.orderNumber}`,
      });
    }

    return toPaymentSummaryDto(payment);
  }

  // Split payment: reserve wallet amount atomically
  const reserve = await reserveWalletSpendWithinTransaction(tx, {
    owner,
    amount: breakdown.walletAmount,
    operationId: input.idempotencyKey,
    subject: {
      subjectType: "COURIER_ORDER",
      subjectId: order.id,
      subjectReference: order.orderNumber,
    },
    actorUserId: input.payer.id,
  });

  const payment = await tx.payment.create({
    data: {
      publicReference,
      orderId: subject.subjectId,
      userId: subject.payerUserId,
      subjectType: "COURIER_ORDER",
      provider: null,
      purpose: "ORDER",
      status: "CREATED",
      amount: new Prisma.Decimal(breakdown.remainingProviderAmount),
      currency: "ZAR",
      creationIdempotencyKey: input.idempotencyKey,
      creationRequestHash: requestHash,
      version: 0,
      latestAttemptNumber: 0,
      metadata: {
        subjectType: "ORDER",
        policyVersion: PAYMENT_POLICY_VERSION,
        walletSplit: true,
        walletAmount: breakdown.walletAmount,
        walletReserveJournalId: reserve.journalId,
        walletReserveOperationId: input.idempotencyKey,
        totalPayableAmount: payable,
        walletOwnerType: owner.ownerType,
        walletOwnerId: owner.ownerId,
      },
    },
    include: PAYMENT_SUMMARY_INCLUDE,
  });

  await tx.paymentStatusHistory.create({
    data: {
      paymentId: payment.id,
      fromStatus: null,
      toStatus: "CREATED",
      reasonCode: "PAYMENT_PREPARED_SPLIT_WALLET",
      actorType: "PAYER",
      actorId: input.payer.id,
      metadata: {
        policyVersion: PAYMENT_POLICY_VERSION,
        walletAmount: breakdown.walletAmount,
        remainingProviderAmount: breakdown.remainingProviderAmount,
      },
    },
  });

  return toPaymentSummaryDto(payment);
}
