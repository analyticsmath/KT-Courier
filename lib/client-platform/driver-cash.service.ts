import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/auth/permissions";
import { reconcileCashCollection } from "@/lib/services/cash-on-delivery.service";
import { PlatformError } from "./contracts";
import type { AuthenticatedUser } from "@/types/domain";
import { withLedgerRetry } from "@/lib/ledger/retry";
export const DepositSchema = z
  .object({
    orderId: z.string().cuid(),
    amount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .refine(
        (v) =>
          new Prisma.Decimal(v).gt(0) && new Prisma.Decimal(v).lte("1000000"),
      ),
    bankReference: z.string().trim().min(4).max(120),
    operationId: z.string().regex(/^[A-Za-z0-9_-]{12,100}$/),
  })
  .strict();
export const DepositReviewSchema = z
  .object({
    decision: z.enum(["CONFIRM", "REJECT"]),
    note: z.string().trim().min(10).max(500),
    bankReceiptVerified: z.boolean(),
  })
  .strict()
  .refine((v) => v.decision !== "CONFIRM" || v.bankReceiptVerified, {
    message: "Verify actual bank receipt before confirming.",
  });
export const BankInstructionsSchema = z
  .object({
    bankName: z.string().trim().min(2).max(100),
    accountName: z.string().trim().min(2).max(150),
    accountNumber: z.string().regex(/^\d{6,30}$/),
    branchCode: z.string().regex(/^\d{4,12}$/),
    referenceHint: z.string().trim().min(3).max(150),
    expectedVersion: z.number().int().nonnegative(),
  })
  .strict();
const BANK_KEY = "client_cash_deposit_bank";
async function activeDriver(userId: string) {
  const d = await prisma.driverProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      status: true,
      user: { select: { role: true, status: true } },
    },
  });
  if (
    !d ||
    d.status !== "ACTIVE" ||
    d.user.status !== "ACTIVE" ||
    d.user.role !== "DRIVER"
  )
    throw new PlatformError(
      "DRIVER_ACCESS_DENIED",
      "An active driver profile is required.",
      403,
    );
  return d;
}
async function financeActor(user: AuthenticatedUser) {
  if (
    user.status !== "ACTIVE" ||
    !["ADMIN", "SUPER_ADMIN"].includes(user.role) ||
    !(await hasPermission({
      userId: user.id,
      role: user.role,
      permissionKey: "cod_operations.manage",
    }))
  )
    throw new PlatformError(
      "CASH_REVIEW_FORBIDDEN",
      "Cash operations permission is required.",
      403,
    );
}
export async function readBankInstructions() {
  const r = await prisma.systemSetting.findUnique({
    where: { key: BANK_KEY },
    select: { value: true },
  });
  const p = BankInstructionsSchema.safeParse(r?.value);
  return p.success ? p.data : null;
}
export async function saveBankInstructions(
  user: AuthenticatedUser,
  input: z.infer<typeof BankInstructionsSchema>,
) {
  await financeActor(user);
  input = BankInstructionsSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${BANK_KEY}))`;
    const prior = await tx.systemSetting.findUnique({
      where: { key: BANK_KEY },
      select: { value: true },
    });
    const parsed = BankInstructionsSchema.safeParse(prior?.value);
    const version = parsed.success ? parsed.data.expectedVersion : 0;
    if (version !== input.expectedVersion)
      throw new PlatformError(
        "BANK_CONFIGURATION_CHANGED",
        "Reload the bank instructions before saving.",
        409,
      );
    const value = { ...input, expectedVersion: version + 1 };
    await tx.systemSetting.upsert({
      where: { key: BANK_KEY },
      create: {
        key: BANK_KEY,
        label: "Driver cash deposit instructions",
        type: "JSON",
        value,
      },
      update: { value },
    });
    await tx.adminActivityLog.create({
      data: {
        actorUserId: user.id,
        action: "UPDATE",
        entityType: "SystemSetting",
        entityId: BANK_KEY,
        message: "Cash deposit banking instructions updated",
        metadata: { version: version + 1 },
      },
    });
    return { saved: true, version: version + 1 };
  });
}
export async function driverCashSummary(userId: string) {
  const driver = await activeDriver(userId);
  const [collected, custody, rows, deposits, bankInstructions] =
    await Promise.all([
      prisma.cashOnDelivery.aggregate({
        where: { collectorDriverId: driver.id },
        _sum: { cashCollected: true, cashReconciled: true },
      }),
      prisma.ledgerAccount.aggregate({
        where: {
          wallet: { ownerType: "DRIVER", ownerId: driver.id },
          purpose: "CASH_CLEARING",
          category: "ASSET",
          currency: "ZAR",
          status: "ACTIVE",
        },
        _sum: { currentBalance: true },
      }),
      prisma.cashOnDelivery.findMany({
        where: {
          OR: [
            { collectorDriverId: driver.id },
            { order: { currentDriverProfileId: driver.id } },
          ],
        },
        select: {
          orderId: true,
          collectorDriverId: true,
          authoritativePayable: true,
          digitalPaid: true,
          cashObligation: true,
          cashCollected: true,
          cashReconciled: true,
          status: true,
          order: { select: { orderNumber: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.driverCashDeposit.findMany({
        where: { driverProfileId: driver.id },
        select: {
          id: true,
          orderId: true,
          amount: true,
          bankReference: true,
          status: true,
          reviewNote: true,
          createdAt: true,
          reviewedAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      readBankInstructions(),
    ]);
  return {
    totals: {
      collected: (
        collected._sum.cashCollected ?? new Prisma.Decimal(0)
      ).toFixed(2),
      remitted: (
        collected._sum.cashReconciled ?? new Prisma.Decimal(0)
      ).toFixed(2),
      held: (custody._sum.currentBalance ?? new Prisma.Decimal(0)).toFixed(2),
    },
    bankInstructions,
    orders: rows.map((r) => ({
      orderId: r.orderId,
      orderNumber: r.order.orderNumber,
      total: r.authoritativePayable.toFixed(2),
      digitalPaid: r.digitalPaid.toFixed(2),
      cashRequired: r.cashObligation.toFixed(2),
      cashCollected: r.cashCollected.toFixed(2),
      cashDeposited: r.cashReconciled.toFixed(2),
      status: r.status,
      canCollect:
        r.status === "READY_FOR_COLLECTION" &&
        ["IN_TRANSIT", "DELIVERY_ATTEMPTED", "DELIVERED", "COMPLETED"].includes(
          r.order.status,
        ),
      canDeposit:
        r.collectorDriverId === driver.id &&
        r.status === "COLLECTED" &&
        !deposits.some(
          (d) =>
            d.orderId === r.orderId &&
            ["PENDING", "PROCESSING", "CONFIRMED"].includes(d.status),
        ),
    })),
    deposits: deposits.map((d) => ({
      ...d,
      amount: d.amount.toFixed(2),
      createdAt: d.createdAt.toISOString(),
      reviewedAt: d.reviewedAt?.toISOString() ?? null,
    })),
  };
}
export async function submitDriverDeposit(
  userId: string,
  input: z.infer<typeof DepositSchema>,
) {
  input = DepositSchema.parse(input);
  const driver = await activeDriver(userId);
  if (!(await readBankInstructions()))
    throw new PlatformError(
      "BANK_INSTRUCTIONS_MISSING",
      "Bank instructions have not been configured. Contact KT support.",
      409,
    );
  return withLedgerRetry(() => prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`deposit:${input.operationId}`}))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`deposit-order:${input.orderId}`}))`;
      const prior = await tx.driverCashDeposit.findUnique({
        where: { operationId: input.operationId },
      });
      const amount = new Prisma.Decimal(input.amount);
      if (prior) {
        if (
          prior.driverProfileId !== driver.id ||
          prior.orderId !== input.orderId ||
          !prior.amount.equals(amount) ||
          prior.bankReference !== input.bankReference
        )
          throw new PlatformError(
            "DEPOSIT_OPERATION_CONFLICT",
            "This deposit reference belongs to a different request.",
            409,
          );
        return { id: prior.id, status: prior.status, replayed: true };
      }
      const cod = await tx.cashOnDelivery.findUnique({
        where: { orderId: input.orderId },
      });
      if (
        !cod ||
        cod.collectorDriverId !== driver.id ||
        cod.status !== "COLLECTED"
      )
        throw new PlatformError(
          "CASH_DEPOSIT_NOT_ELIGIBLE",
          "Only your collected cash can be submitted for deposit verification.",
          403,
        );
      if (!amount.equals(cod.cashCollected.sub(cod.cashReconciled)))
        throw new PlatformError(
          "DEPOSIT_AMOUNT_MISMATCH",
          "Deposit the full outstanding collected cash for this delivery.",
          422,
        );
      if (await tx.driverCashDeposit.findFirst({ where: { orderId: input.orderId, status: { in: ["PENDING", "PROCESSING", "CONFIRMED"] } } }))
        throw new PlatformError("CASH_DEPOSIT_ALREADY_SUBMITTED", "This delivery already has a deposit awaiting review or confirmed receipt.", 409);
      const row = await tx.driverCashDeposit.create({
        data: { ...input, amount, driverProfileId: driver.id },
        select: { id: true, status: true },
      });
      await tx.adminActivityLog.create({
        data: {
          actorUserId: userId,
          action: "CREATE",
          entityType: "DriverCashDeposit",
          entityId: row.id,
          message: "Driver submitted bank deposit for verification",
          metadata: {
            orderId: input.orderId,
            driverProfileId: driver.id,
            amount: amount.toFixed(2),
          },
        },
      });
      return { ...row, replayed: false };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  ));
}
async function matchingReceipt(row: {
  id: string;
  orderId: string;
  driverProfileId: string;
  amount: Prisma.Decimal;
  bankReference: string;
  reviewedByUserId: string | null;
}) {
  const receipt = await prisma.cashOnDeliveryReconciliation.findUnique({
    where: { operationId: `cash-deposit:${row.id}` },
    include: { cashOnDelivery: { select: { orderId: true } } },
  });
  if (!receipt) return null;
  if (
    receipt.cashOnDelivery.orderId !== row.orderId ||
    receipt.collectorDriverId !== row.driverProfileId ||
    !receipt.receivedAmount.equals(row.amount) ||
    receipt.evidenceReference !== `BANK:${row.bankReference}` ||
    receipt.reconciledByUserId !== row.reviewedByUserId
  )
    throw new PlatformError(
      "DEPOSIT_RECEIPT_CONFLICT",
      "The reconciliation receipt does not match this deposit.",
      409,
    );
  return receipt;
}
export async function reviewDriverDeposit(
  user: AuthenticatedUser,
  id: string,
  input: z.infer<typeof DepositReviewSchema>,
) {
  await financeActor(user);
  input = DepositReviewSchema.parse(input);
  const row = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`deposit-review:${id}`}))`;
    const row = await tx.driverCashDeposit.findUnique({ where: { id } });
    if (!row)
      throw new PlatformError("DEPOSIT_NOT_FOUND", "Deposit not found.", 404);
    if (row.status === "CONFIRMED" && input.decision === "CONFIRM") return row;
    if (row.status === "REJECTED" && input.decision === "REJECT") return row;
    if (
      !["PENDING", "PROCESSING"].includes(row.status) ||
      (row.status === "PROCESSING" &&
        (input.decision !== "CONFIRM" || row.reviewedByUserId !== user.id))
    )
      throw new PlatformError(
        "DEPOSIT_REVIEW_CONFLICT",
        "This deposit is being processed or was already reviewed.",
        409,
      );
    if (row.status === "PROCESSING") return row;
    const updated = await tx.driverCashDeposit.update({
      where: { id },
      data: {
        status: input.decision === "REJECT" ? "REJECTED" : "PROCESSING",
        reviewedByUserId: user.id,
        reviewedAt: new Date(),
        reviewNote: input.note,
      },
    });
    await tx.adminActivityLog.create({
      data: {
        actorUserId: user.id,
        action: "UPDATE",
        entityType: "DriverCashDeposit",
        entityId: id,
        message:
          input.decision === "REJECT"
            ? "Bank deposit evidence rejected"
            : "Bank receipt verified; cash reconciliation started",
        metadata: { decision: input.decision, note: input.note },
      },
    });
    return updated;
  });
  if (["REJECTED", "CONFIRMED"].includes(row.status))
    return { id: row.id, status: row.status };
  if (!(await matchingReceipt(row))) {
    try {
      await reconcileCashCollection({
        orderId: row.orderId,
        actorUserId: user.id,
        receivedAmount: row.amount.toFixed(2),
        operationId: `cash-deposit:${row.id}`,
        evidenceReference: `BANK:${row.bankReference}`,
      });
    } catch (e) {
      if (!(await matchingReceipt(row))) throw e;
    }
  }
  if (!(await matchingReceipt(row)))
    throw new PlatformError(
      "DEPOSIT_RECEIPT_MISSING",
      "Cash reconciliation has not completed. Retry verification.",
      409,
    );
  await prisma.$transaction(async (tx) => {
    const changed = await tx.driverCashDeposit.updateMany({
      where: { id, status: "PROCESSING", reviewedByUserId: user.id },
      data: { status: "CONFIRMED", reviewedAt: new Date() },
    });
    if (!changed.count) {
      const current = await tx.driverCashDeposit.findUnique({
        where: { id },
        select: { status: true },
      });
      if (current?.status !== "CONFIRMED")
        throw new PlatformError(
          "DEPOSIT_REVIEW_CONFLICT",
          "The deposit state changed. Reload before retrying.",
          409,
        );
    }
    if (changed.count)
      await tx.adminActivityLog.create({
        data: {
          actorUserId: user.id,
          action: "UPDATE",
          entityType: "DriverCashDeposit",
          entityId: id,
          message:
            "Bank deposit confirmed against posted reconciliation receipt",
          metadata: { orderId: row.orderId },
        },
      });
  });
  return { id, status: "CONFIRMED" };
}
export async function listCashDeposits(user: AuthenticatedUser) {
  await financeActor(user);
  const rows = await prisma.driverCashDeposit.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      driver: { select: { driverCode: true, displayName: true } },
      order: { select: { orderNumber: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    driverName: r.driver.displayName ?? r.driver.driverCode,
    driverCode: r.driver.driverCode,
    orderNumber: r.order.orderNumber,
    amount: r.amount.toFixed(2),
    bankReference: r.bankReference,
    status: r.status,
    note: r.reviewNote,
    createdAt: r.createdAt.toISOString(),
  }));
}
