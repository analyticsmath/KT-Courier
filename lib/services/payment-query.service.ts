import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type {
  PaymentDetailDto,
  PaymentListDto,
  PaymentProviderListDto,
} from "@/lib/dto/payment.dto";
import { LedgerMoney } from "@/lib/ledger/money";
import {
  toPaymentAttemptDto,
  toPaymentHistoryDto,
  toPaymentSummaryDto,
} from "@/lib/payments/payment-dto-mappers";
import {
  createProductionPaymentProviderRegistry,
  type PaymentProviderRegistry,
} from "@/lib/payments/providers/payment-provider-registry";
import type { PaymentListQuery } from "@/lib/validation/payments";

const PAYMENT_SUMMARY_INCLUDE = {
  order: { select: { id: true, orderNumber: true } },
  user: { select: { id: true, name: true } },
} as const;

function pagination(page: number, pageSize: number, total: number) {
  return Object.freeze({ page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
}

export async function listPayments(query: PaymentListQuery): Promise<PaymentListDto> {
  const where: Prisma.PaymentWhereInput = {
    ...(query.publicReference && { publicReference: { contains: query.publicReference, mode: "insensitive" } }),
    ...(query.orderReference && { order: { orderNumber: { contains: query.orderReference, mode: "insensitive" } } }),
    ...(query.payer && {
      user: {
        OR: [
          { name: { contains: query.payer, mode: "insensitive" } },
          { email: { contains: query.payer, mode: "insensitive" } },
        ],
      },
    }),
    ...(query.status && { status: query.status }),
    ...(query.provider && { provider: query.provider }),
    ...(query.from || query.to ? {
      createdAt: {
        ...(query.from && { gte: new Date(query.from) }),
        ...(query.to && { lte: new Date(query.to) }),
      },
    } : {}),
    ...(query.minimumAmount || query.maximumAmount ? {
      amount: {
        ...(query.minimumAmount && { gte: LedgerMoney.parse(query.minimumAmount).toDecimal() }),
        ...(query.maximumAmount && { lte: LedgerMoney.parse(query.maximumAmount).toDecimal() }),
      },
    } : {}),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      include: PAYMENT_SUMMARY_INCLUDE,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return Object.freeze({
    data: Object.freeze(rows.map((row: any) => toPaymentSummaryDto(row))),
    pagination: pagination(query.page, query.pageSize, total),
  });
}

export async function getPaymentDetail(id: string): Promise<PaymentDetailDto | null> {
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      ...PAYMENT_SUMMARY_INCLUDE,
      attempts: { orderBy: [{ attemptNumber: "asc" }, { id: "asc" }] },
      statusHistory: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
    },
  });
  if (!payment) return null;
  return Object.freeze({
    payment: toPaymentSummaryDto(payment as any),
    attempts: Object.freeze(payment.attempts.map(toPaymentAttemptDto)),
    history: Object.freeze(payment.statusHistory.map(toPaymentHistoryDto)),
  });
}

export function listPaymentProviders(
  registry: PaymentProviderRegistry = createProductionPaymentProviderRegistry(),
): PaymentProviderListDto {
  return Object.freeze({ data: Object.freeze([...registry.readiness()]) });
}

