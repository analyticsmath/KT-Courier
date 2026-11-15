import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { LedgerError } from "@/lib/ledger/errors";
import { LedgerMoney } from "@/lib/ledger/money";
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
import { membershipAllows } from "@/lib/client-platform/store-permissions";
import { resolveOrderPaymentSubject, type ResolvedOrderPaymentSubject } from "./payment-subject.service";
import { activateDepositCashOnDeliveryWithinTransaction } from "./cash-on-delivery.service";
import { transitionOrderStatusInTx } from "./order-status.service";
import { customerAccountPrefix } from "./customer-wallet.service";

export type CanonicalOrderPaymentPreparationIntent = Readonly<{
  subjectType: "ORDER";
  orderId: string;
  payerId: string;
  walletOwnerType: "CUSTOMER" | "STORE";
  walletOwnerId: string;
  currency: "ZAR";
  policyVersion: string;
  authoritativeDigitalPayableAmount: string;
  authoritativeDigitalPayableMinorUnits: string;
  requestedWalletAmount: string;
  requestedWalletMinorUnits: string;
  rawRequestedWalletAmount: string | null;
  providerRemainderAmount: string;
  providerRemainderMinorUnits: string;
  fundingMode: "PROVIDER_ONLY" | "WALLET_ONLY" | "SPLIT_PAYSTACK" | "EXCEEDS_PAYABLE";
  fundingSource: "PROVIDER" | "WALLET";
  requestHash: string;
  legacyCoordinatorHash: string;
  legacyWalletHelperHash: string | null;
}>;

function zarDecimalToMinorUnits(amountFixed2: string): string {
  const [whole, fraction = "00"] = amountFixed2.split(".");
  return (BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0").slice(0, 2))).toString();
}

export function buildCanonicalOrderPaymentPreparationIntent(
  subject: Pick<ResolvedOrderPaymentSubject, "subjectType" | "subjectId" | "payerUserId" | "currency"> & {
    readonly amount: LedgerMoney | string;
    readonly storeId?: string | null;
    readonly walletOwnerType?: "CUSTOMER" | "STORE";
    readonly walletOwnerId?: string;
  },
  rawWalletAmount?: string | null,
): CanonicalOrderPaymentPreparationIntent {
  const payableMoney =
    typeof subject.amount === "string"
      ? LedgerMoney.parse(subject.amount)
      : subject.amount;
  const authoritativeDigitalPayableAmount = payableMoney.toString();
  const authoritativeDigitalPayableMinorUnits = zarDecimalToMinorUnits(authoritativeDigitalPayableAmount);

  const trimmedWallet = (rawWalletAmount ?? "").trim();
  let walletMoney = LedgerMoney.zero();
  if (trimmedWallet && trimmedWallet !== "0" && trimmedWallet !== "0.0" && trimmedWallet !== "0.00") {
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(trimmedWallet)) {
      throw new PaymentError("PAYMENT_INVALID_AMOUNT", "Wallet spend amount is invalid.");
    }
    walletMoney = LedgerMoney.parse(trimmedWallet);
  }

  const requestedWalletAmount = walletMoney.toString();
  const requestedWalletMinorUnits = zarDecimalToMinorUnits(requestedWalletAmount);

  let fundingMode: CanonicalOrderPaymentPreparationIntent["fundingMode"];
  let fundingSource: CanonicalOrderPaymentPreparationIntent["fundingSource"];
  let providerRemainderAmount: string;
  let providerRemainderMinorUnits: string;

  if (walletMoney.isZero()) {
    fundingMode = "PROVIDER_ONLY";
    fundingSource = "PROVIDER";
    providerRemainderAmount = authoritativeDigitalPayableAmount;
    providerRemainderMinorUnits = authoritativeDigitalPayableMinorUnits;
  } else if (walletMoney.equals(payableMoney)) {
    fundingMode = "WALLET_ONLY";
    fundingSource = "WALLET";
    providerRemainderAmount = "0.00";
    providerRemainderMinorUnits = "0";
  } else if (walletMoney.lessThan(payableMoney)) {
    fundingMode = "SPLIT_PAYSTACK";
    fundingSource = "WALLET";
    const remainderMoney = payableMoney.subtract(walletMoney);
    providerRemainderAmount = remainderMoney.toString();
    providerRemainderMinorUnits = zarDecimalToMinorUnits(providerRemainderAmount);
  } else {
    fundingMode = "EXCEEDS_PAYABLE";
    fundingSource = "WALLET";
    providerRemainderAmount = "0.00";
    providerRemainderMinorUnits = "0";
  }

  const isStoreOwner = subject.walletOwnerType === "STORE" || Boolean(subject.storeId);
  const walletOwnerType: "CUSTOMER" | "STORE" = isStoreOwner ? "STORE" : "CUSTOMER";
  const walletOwnerId = isStoreOwner
    ? (subject.walletOwnerId ?? subject.storeId ?? subject.payerUserId)
    : subject.payerUserId;

  const requestHash = canonicalPaymentHash({
    subjectType: subject.subjectType,
    orderId: subject.subjectId,
    payerId: subject.payerUserId,
    currency: subject.currency,
    policyVersion: PAYMENT_POLICY_VERSION,
    amount: authoritativeDigitalPayableAmount,
    authoritativeDigitalPayableMinorUnits,
    walletAmount: walletMoney.isZero() ? null : requestedWalletAmount,
    requestedWalletMinorUnits,
    providerRemainderAmount,
    providerRemainderMinorUnits,
    fundingMode,
    fundingSource,
    ...(walletOwnerType === "STORE" ? { walletOwnerType, walletOwnerId } : {}),
  });

  const legacyCoordinatorHash = canonicalPaymentHash({
    subjectType: subject.subjectType,
    orderId: subject.subjectId,
    payerId: subject.payerUserId,
    amount: authoritativeDigitalPayableAmount,
    currency: subject.currency,
    policyVersion: PAYMENT_POLICY_VERSION,
    walletAmount: rawWalletAmount ?? null,
    fundingSource: rawWalletAmount && rawWalletAmount !== "0.00" ? "WALLET" : "PROVIDER",
  });

  const legacyWalletHelperHash =
    fundingMode === "WALLET_ONLY" || fundingMode === "SPLIT_PAYSTACK"
      ? canonicalPaymentHash({
          subjectType: subject.subjectType,
          orderId: subject.subjectId,
          payerId: subject.payerUserId,
          amount: fundingMode === "WALLET_ONLY" ? authoritativeDigitalPayableAmount : providerRemainderAmount,
          currency: subject.currency,
          policyVersion: PAYMENT_POLICY_VERSION,
          walletAmount: rawWalletAmount ?? requestedWalletAmount,
          fundingSource: "WALLET",
        })
      : null;

  return Object.freeze({
    subjectType: subject.subjectType,
    orderId: subject.subjectId,
    payerId: subject.payerUserId,
    walletOwnerType,
    walletOwnerId,
    currency: subject.currency,
    policyVersion: PAYMENT_POLICY_VERSION,
    authoritativeDigitalPayableAmount,
    authoritativeDigitalPayableMinorUnits,
    requestedWalletAmount,
    requestedWalletMinorUnits,
    rawRequestedWalletAmount: rawWalletAmount ?? null,
    providerRemainderAmount,
    providerRemainderMinorUnits,
    fundingMode,
    fundingSource,
    requestHash,
    legacyCoordinatorHash,
    legacyWalletHelperHash,
  });
}

export function verifyLegacyOrderPaymentReplay(
  existing: Readonly<{
    orderId: string | null;
    userId: string | null;
    currency: string;
    amount: { toFixed(n: number): string };
    creationIdempotencyKey?: string | null;
    creationRequestHash: string;
    successLedgerJournalId?: string | null;
    metadata?: unknown;
  }>,
  intent: CanonicalOrderPaymentPreparationIntent,
  idempotencyKey: string,
): boolean {
  if (
    existing.orderId !== intent.orderId ||
    existing.userId !== intent.payerId ||
    existing.currency !== intent.currency
  ) {
    return false;
  }
  if (existing.creationIdempotencyKey && existing.creationIdempotencyKey !== idempotencyKey) {
    return false;
  }
  const meta =
    existing.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
      ? (existing.metadata as Record<string, unknown>)
      : null;
  if (!meta || meta.policyVersion !== intent.policyVersion || meta.subjectType !== "ORDER") {
    return false;
  }

  const existingAmount = existing.amount.toFixed(2);

  if (intent.fundingMode === "PROVIDER_ONLY") {
    return (
      meta.walletSettled !== true &&
      meta.walletSplit !== true &&
      existingAmount === intent.authoritativeDigitalPayableAmount &&
      existing.creationRequestHash === intent.legacyCoordinatorHash
    );
  }

  if (intent.fundingMode === "WALLET_ONLY") {
    return (
      meta.walletSettled === true &&
      meta.walletAmount === intent.requestedWalletAmount &&
      typeof meta.walletJournalId === "string" &&
      meta.walletJournalId.length > 0 &&
      (existing.successLedgerJournalId === undefined || existing.successLedgerJournalId === meta.walletJournalId) &&
      existingAmount === intent.authoritativeDigitalPayableAmount &&
      (existing.creationRequestHash === intent.legacyWalletHelperHash ||
        existing.creationRequestHash === intent.legacyCoordinatorHash)
    );
  }

  if (intent.fundingMode === "SPLIT_PAYSTACK") {
    return (
      meta.walletSplit === true &&
      meta.walletAmount === intent.requestedWalletAmount &&
      meta.totalPayableAmount === intent.authoritativeDigitalPayableAmount &&
      meta.walletReserveOperationId === idempotencyKey &&
      typeof meta.walletReserveJournalId === "string" &&
      meta.walletReserveJournalId.length > 0 &&
      existingAmount === intent.providerRemainderAmount &&
      existing.creationRequestHash === intent.legacyWalletHelperHash
    );
  }

  return false;
}

export function matchesOrderPaymentPreparationReplay(
  existing: Readonly<{
    orderId: string | null;
    userId: string | null;
    currency: string;
    amount: { toFixed(n: number): string };
    creationIdempotencyKey?: string | null;
    creationRequestHash: string;
    successLedgerJournalId?: string | null;
    metadata?: unknown;
  }>,
  intent: CanonicalOrderPaymentPreparationIntent,
  idempotencyKey: string,
): boolean {
  if (
    existing.orderId !== intent.orderId ||
    existing.userId !== intent.payerId ||
    existing.currency !== intent.currency
  ) {
    return false;
  }
  if (existing.creationIdempotencyKey && existing.creationIdempotencyKey !== idempotencyKey) {
    return false;
  }
  if (existing.creationRequestHash === intent.requestHash) {
    if (intent.walletOwnerType === "STORE") {
      const meta =
        existing.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
          ? (existing.metadata as Record<string, unknown>)
          : null;
      if (meta?.walletOwnerType !== "STORE" || meta?.walletOwnerId !== intent.walletOwnerId) {
        return false;
      }
    }
    const expectedAmount =
      intent.fundingMode === "SPLIT_PAYSTACK"
        ? intent.providerRemainderAmount
        : intent.authoritativeDigitalPayableAmount;
    return existing.amount.toFixed(2) === expectedAmount;
  }
  return verifyLegacyOrderPaymentReplay(existing, intent, idempotencyKey);
}

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

  const purpose = owner.ownerType === "CUSTOMER"
    ? "CUSTOMER_WALLET_AVAILABLE"
    : "STORE_REFERRAL_WALLET_AVAILABLE";

  const existingByPurpose = await tx.ledgerAccount.findUnique({
    where: {
      walletId_purpose_currency: {
        walletId: wallet.id,
        purpose,
        currency: "ZAR",
      },
    },
  });
  if (existingByPurpose) {
    if (
      existingByPurpose.category !== "LIABILITY" ||
      existingByPurpose.status !== "ACTIVE" ||
      existingByPurpose.allowNegative
    ) {
      throw new LedgerError("LEDGER_OWNER_INVALID", "Existing wallet account is not valid for spending.");
    }
    return existingByPurpose;
  }

  const prefix = owner.ownerType === "CUSTOMER"
    ? customerAccountPrefix(owner.ownerId)
    : storeAccountPrefix(owner.ownerId);

  const code = owner.ownerType === "CUSTOMER"
    ? `${prefix}-WALLET-ZAR`
    : `${prefix}-REFERRAL-ZAR`;

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

export type ParcelWalletFundingAuthority = Readonly<{
  orderId: string;
  orderNumber: string;
  actorUserId: string;
  owner: WalletOwner;
  actorRoleInOrder: "CUSTOMER" | "STORE_OWNER" | "STORE_FINANCE_EMPLOYEE";
  storeId: string | null;
  storeOwnerUserId: string | null;
}>;

/**
 * Authoritative transactional wallet-funding resolver for parcel orders.
 * Acquires the canonical Order FOR UPDATE lock before reading store ownership,
 * active employee memberships, and funding owner identity.
 */
export async function resolveParcelWalletFundingAuthorityInTx(
  tx: Prisma.TransactionClient,
  input: Readonly<{
    orderId: string;
    actorUserId: string;
    explicitStoreId?: string | null;
    requestedWalletAmount?: string | null;
  }>,
): Promise<ParcelWalletFundingAuthority> {
  if (typeof tx.$queryRaw === "function") {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${input.orderId} FOR UPDATE`;
  }

  const explicitStoreId = input.explicitStoreId?.trim() || null;

  if (typeof tx.user?.findUnique === "function") {
    const actor = await tx.user.findUnique({
      where: { id: input.actorUserId },
      select: { id: true, status: true, role: true },
    });
    if (!actor || actor.status !== "ACTIVE" || !["CUSTOMER", "STORE"].includes(actor.role)) {
      throw new PaymentError("PAYMENT_PAYER_NOT_AUTHORIZED", "Account is not active for parcel payments.");
    }
  }

  const order = await tx.order.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      orderNumber: true,
      customerId: true,
      storeId: true,
      store: { select: { id: true, ownerUserId: true, status: true } },
    },
  });
  if (!order) {
    throw new PaymentError("PAYMENT_ORDER_NOT_FOUND", "Order is not available for payment.");
  }

  if (order.storeId) {
    if (explicitStoreId && explicitStoreId !== order.storeId) {
      throw new PaymentError(
        "PAYMENT_PAYER_NOT_AUTHORIZED",
        "Order does not belong to the selected store workspace.",
      );
    }
    if (!order.store || order.store.status === "SUSPENDED" || order.store.status === "DISABLED") {
      throw new PaymentError(
        "PAYMENT_PAYER_NOT_AUTHORIZED",
        "Store account is suspended or unavailable.",
      );
    }

    const [ownedStores, activeMemberships] = await Promise.all([
      tx.store.findMany({
        where: { ownerUserId: input.actorUserId, status: { notIn: ["SUSPENDED", "DISABLED"] } },
        select: { id: true },
      }),
      tx.storeEmployeeMembership.findMany({
        where: { userId: input.actorUserId, status: "ACTIVE", store: { status: "ACTIVE" } },
        select: { storeId: true, permissions: true },
      }),
    ]);

    const ownsTarget = ownedStores.some((s) => s.id === order.storeId);
    const hasFinanceMembership = activeMemberships.some(
      (m) => m.storeId === order.storeId && membershipAllows(m.permissions, "finance"),
    );
    if (!ownsTarget && !hasFinanceMembership) {
      throw new PaymentError(
        "PAYMENT_PAYER_NOT_AUTHORIZED",
        "Order is not available for this payer.",
      );
    }

    const allActorStoreIds = new Set<string>([
      ...ownedStores.map((s) => s.id),
      ...activeMemberships.map((m) => m.storeId),
    ]);
    if (!explicitStoreId && allActorStoreIds.size > 1) {
      throw new PaymentError(
        "STORE_CONTEXT_AMBIGUOUS",
        "Multiple store workspaces exist; explicitly select the store before paying.",
      );
    }

    return Object.freeze({
      orderId: order.id,
      orderNumber: order.orderNumber,
      actorUserId: input.actorUserId,
      owner: Object.freeze({ ownerType: "STORE", ownerId: order.storeId }),
      actorRoleInOrder: ownsTarget ? "STORE_OWNER" : "STORE_FINANCE_EMPLOYEE",
      storeId: order.storeId,
      storeOwnerUserId: order.store.ownerUserId,
    });
  }

  if (explicitStoreId) {
    throw new PaymentError(
      "PAYMENT_PAYER_NOT_AUTHORIZED",
      "Customer parcel order does not belong to a store workspace.",
    );
  }
  if (order.customerId !== input.actorUserId) {
    throw new PaymentError("PAYMENT_PAYER_NOT_AUTHORIZED", "Order is not available for this payer.");
  }

  return Object.freeze({
    orderId: order.id,
    orderNumber: order.orderNumber,
    actorUserId: input.actorUserId,
    owner: Object.freeze({ ownerType: "CUSTOMER", ownerId: input.actorUserId }),
    actorRoleInOrder: "CUSTOMER",
    storeId: null,
    storeOwnerUserId: null,
  });
}

export async function spendWalletForParcelOrderWithinTransaction(
  tx: Prisma.TransactionClient,
  input: {
    payer: Readonly<{ id: string; email?: string }>;
    orderId: string;
    idempotencyKey: string;
    walletAmount?: string | null;
    explicitStoreId?: string | null;
    preparationIntent?: CanonicalOrderPaymentPreparationIntent;
  },
): Promise<PaymentSummaryDto | null> {
  const PAYMENT_SUMMARY_INCLUDE = {
    order: { select: { id: true, orderNumber: true } },
    user: { select: { id: true, name: true } },
  } as const;

  const authority = await resolveParcelWalletFundingAuthorityInTx(tx, {
    orderId: input.orderId,
    actorUserId: input.payer.id,
    explicitStoreId: input.explicitStoreId,
    requestedWalletAmount: input.walletAmount,
  });

  const existingForOrder = await tx.payment.findUnique({
    where: { orderId: input.orderId },
    include: PAYMENT_SUMMARY_INCLUDE,
  });
  if (existingForOrder) {
    const checkIntent =
      input.preparationIntent ??
      buildCanonicalOrderPaymentPreparationIntent(
        await resolveOrderPaymentSubject(input.orderId, input.payer.id, tx, {
          explicitStoreId: input.explicitStoreId,
        }),
        input.walletAmount,
      );
    if (
      existingForOrder.creationIdempotencyKey !== input.idempotencyKey ||
      !matchesOrderPaymentPreparationReplay(existingForOrder, checkIntent, input.idempotencyKey)
    ) {
      throw new PaymentError("PAYMENT_IDEMPOTENCY_CONFLICT", "Order already has a payment under different key or evidence.");
    }
    return toPaymentSummaryDto(existingForOrder);
  }

  const subject = await resolveOrderPaymentSubject(input.orderId, input.payer.id, tx, {
    explicitStoreId: input.explicitStoreId,
  });
  const payable = subject.amount.toString();
  const intent =
    input.preparationIntent ??
    buildCanonicalOrderPaymentPreparationIntent(subject, input.walletAmount);

  if (
    intent.authoritativeDigitalPayableAmount !== payable ||
    intent.currency !== subject.currency ||
    intent.walletOwnerType !== authority.owner.ownerType ||
    intent.walletOwnerId !== authority.owner.ownerId
  ) {
    throw new PaymentError("PAYMENT_CONCURRENCY_CONFLICT", "Payment policy changed. Reload before preparing payment.");
  }

  const order = await tx.order.findUniqueOrThrow({
    where: { id: input.orderId },
    include: { cashOnDelivery: true },
  });

  const owner = authority.owner;

  const walletBalance = await getWalletSpendableBalance(tx, owner);
  const breakdown = resolveWalletSpendBreakdown({
    payableAmount: payable,
    availableBalance: walletBalance.availableAmount,
    requestedWalletAmount: input.walletAmount,
  });

  if (breakdown.mode === "PROVIDER_ONLY") {
    return null;
  }

  const requestHash = intent.requestHash;

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
          actingActorUserId: input.payer.id,
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
        actingActorUserId: input.payer.id,
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

const UNRESOLVED_ATTEMPT_STATES = [
  "RESERVED",
  "REQUESTING",
  "REQUIRES_ACTION",
  "PROCESSING",
  "UNKNOWN",
] as const;

export async function releaseParcelOrderWalletReservationWithinTransaction(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    reason: string;
    actorUserId?: string;
  },
): Promise<{ released: boolean; journalId: string | null; amount: string | null; replayed: boolean }> {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${input.orderId} FOR UPDATE`;
  const orderWithStore = await tx.order.findUnique({
    where: { id: input.orderId },
    select: { id: true, orderNumber: true, storeId: true },
  });
  if (!orderWithStore) {
    throw new PaymentError("PAYMENT_ORDER_NOT_FOUND", "Order was not found for wallet reservation release.");
  }

  const payment = await tx.payment.findUnique({
    where: { orderId: input.orderId },
    include: {
      attempts: {
        select: { id: true, status: true },
      },
    },
  });
  if (!payment) {
    return { released: false, journalId: null, amount: null, replayed: false };
  }

  await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${payment.id} FOR UPDATE`;
  const freshPayment = await tx.payment.findUnique({
    where: { id: payment.id },
    include: {
      attempts: {
        select: { id: true, status: true },
      },
    },
  });
  if (!freshPayment) {
    return { released: false, journalId: null, amount: null, replayed: false };
  }

  const meta =
    freshPayment.metadata && typeof freshPayment.metadata === "object" && !Array.isArray(freshPayment.metadata)
      ? (freshPayment.metadata as Record<string, unknown>)
      : null;

  if (!meta || meta.walletSplit !== true || typeof meta.walletAmount !== "string") {
    return { released: false, journalId: null, amount: null, replayed: false };
  }

  if (freshPayment.status === "SUCCEEDED" || freshPayment.attempts.some((a) => a.status === "SUCCEEDED")) {
    throw new PaymentError("PAYMENT_ORDER_ALREADY_PAID", "Cannot release wallet reservation for a succeeded payment.");
  }

  if (
    ["PROVIDER_PENDING", "REQUIRES_ACTION", "PROCESSING"].includes(freshPayment.status) ||
    freshPayment.attempts.some((a) => (UNRESOLVED_ATTEMPT_STATES as readonly string[]).includes(a.status))
  ) {
    throw new PaymentError(
      "PAYMENT_PROVIDER_OUTCOME_UNKNOWN",
      "Cannot release wallet reservation while provider outcome is unresolved.",
    );
  }

  const resolvedOwnerType: "CUSTOMER" | "STORE" =
    meta.walletOwnerType === "STORE" || Boolean(orderWithStore.storeId) ? "STORE" : "CUSTOMER";
  const resolvedOwnerId =
    (typeof meta.walletOwnerId === "string" && meta.walletOwnerId) ||
    (resolvedOwnerType === "STORE" ? (orderWithStore.storeId ?? "") : (freshPayment.userId ?? ""));
  const reserveOperationId =
    (typeof meta.walletReserveOperationId === "string" && meta.walletReserveOperationId) ||
    freshPayment.creationIdempotencyKey;

  const released = await releaseWalletSpendWithinTransaction(tx, {
    owner: { ownerType: resolvedOwnerType, ownerId: resolvedOwnerId },
    amount: meta.walletAmount,
    operationId: reserveOperationId,
    subject: {
      subjectType: "COURIER_ORDER",
      subjectId: orderWithStore.id,
      subjectReference: orderWithStore.orderNumber,
    },
    reason: input.reason,
    actorUserId: input.actorUserId,
  });

  if (freshPayment.status !== "CANCELLED") {
    const now = new Date();
    await tx.payment.update({
      where: { id: freshPayment.id },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        version: { increment: 1 },
        metadata: {
          ...meta,
          walletReservationReleased: true,
          walletReleaseJournalId: released.journalId,
          walletReleasedAt: now.toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
    await tx.paymentStatusHistory.create({
      data: {
        paymentId: freshPayment.id,
        fromStatus: freshPayment.status,
        toStatus: "CANCELLED",
        reasonCode: "WALLET_RESERVATION_RELEASED",
        actorType: input.actorUserId ? "PAYER" : "SYSTEM",
        actorId: input.actorUserId ?? null,
        metadata: {
          reason: input.reason,
          walletAmount: meta.walletAmount,
          walletReleaseJournalId: released.journalId,
        },
      },
    });
  }

  return {
    released: true,
    journalId: released.journalId,
    amount: released.amount,
    replayed: released.replayed,
  };
}

export async function releaseParcelOrderWalletReservation(input: {
  orderId: string;
  reason: string;
  actorUserId?: string;
}): Promise<{ released: boolean; journalId: string | null; amount: string | null; replayed: boolean }> {
  return prisma.$transaction(
    (tx) => releaseParcelOrderWalletReservationWithinTransaction(tx, input),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

/**
 * Restores the consumed wallet portion of a split-wallet parcel payment to the
 * authoritative funding owner (`CUSTOMER` or `STORE`) when an order is
 * cancelled before custody after payment success. Idempotent per paymentId.
 */
export async function restoreConsumedParcelWalletWithinTransaction(
  tx: Prisma.TransactionClient,
  input: Readonly<{
    paymentId: string;
    orderId: string;
    orderNumber: string;
    owner: WalletOwner;
    amount: string;
    reason: string;
    actorUserId?: string;
  }>,
): Promise<{ journalId: string; journalReference: string; amount: string; replayed: boolean }> {
  const amountDec = new Prisma.Decimal(input.amount);
  if (amountDec.lessThanOrEqualTo(0)) {
    throw new LedgerError("LEDGER_INVALID_AMOUNT", "Restored wallet amount must be positive.");
  }

  const idempotencyKey = `wallet-cancel-restore:${input.paymentId}`;
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

  const platformHeld = await ensurePlatformCustomerFundsHeldAccountInTx(tx);
  const available = await ensureWalletAvailableAccountInTx(tx, input.owner);

  const lockIds = [platformHeld.id, available.id].sort();
  await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "LedgerAccount" WHERE "id" IN (${Prisma.join(lockIds)}) ORDER BY "id" ASC FOR UPDATE`,
  );

  const freshHeld = await tx.ledgerAccount.findUnique({ where: { id: platformHeld.id } });
  if (!freshHeld || freshHeld.currentBalance.lessThan(amountDec)) {
    throw new LedgerError("LEDGER_INSUFFICIENT_BALANCE", "Platform held funds do not cover consumed wallet restoration.");
  }

  const journal = await postLedgerJournalWithinTransaction(tx, {
    idempotencyKey,
    type: "REFUND_WALLET_CREDIT",
    currency: "ZAR",
    sourceReference: `WALLET_CANCEL_RESTORE:${input.orderNumber}`,
    correlationId: input.orderNumber,
    memo: `Restore consumed split-wallet funds for cancelled parcel ${input.orderNumber}`,
    actor: input.actorUserId
      ? { kind: "USER", userId: input.actorUserId }
      : { kind: "SYSTEM" },
    metadata: {
      category: "PARCEL_CANCELLATION_SPLIT_WALLET_RESTORE",
      paymentId: input.paymentId,
      orderId: input.orderId,
      ownerType: input.owner.ownerType,
      ownerId: input.owner.ownerId,
      amount: input.amount,
      reason: input.reason,
    },
    entries: [
      {
        accountId: platformHeld.id,
        direction: "DEBIT",
        amount: input.amount,
        lineCode: "PLATFORM_HELD_SPLIT_WALLET_RESTORE",
      },
      {
        accountId: available.id,
        direction: "CREDIT",
        amount: input.amount,
        lineCode: "OWNER_WALLET_AVAILABLE_RESTORE",
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
