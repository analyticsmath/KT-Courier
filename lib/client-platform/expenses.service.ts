import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { storeAccess } from "./store-access";
import { PlatformError } from "./contracts";
export const EXPENSE_TYPES = [
  "DELIVERY",
  "COMMISSION",
  "SUBSCRIPTION",
  "ADVERTISING",
  "REFUND",
] as const;
export const ExpenseQuerySchema = z
  .object({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    type: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.enum(EXPENSE_TYPES).optional(),
    ),
    status: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z
        .enum([
          "PAID",
          "UNPAID",
          "PARTIAL",
          "DEDUCTED",
          "VOID",
          "REFUNDED",
          "OVERPAID",
        ])
        .optional(),
    ),
    page: z.coerce.number().int().min(1).max(50).default(1),
  })
  .strict();
export type ExpenseRow = {
  id: string;
  date: string;
  type: (typeof EXPENSE_TYPES)[number];
  description: string;
  reference: string;
  amount: string;
  paidAmount: string;
  status: string;
};
export function expenseDates(
  input: z.infer<typeof ExpenseQuerySchema>,
  now = new Date(),
) {
  const from = input.from ?? `${now.toISOString().slice(0, 7)}-01`,
    to = input.to ?? now.toISOString().slice(0, 10),
    start = new Date(`${from}T00:00:00Z`),
    end = new Date(`${to}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  if (start >= end || end.getTime() - start.getTime() > 366 * 86400000)
    throw new PlatformError(
      "EXPENSE_DATE_RANGE",
      "Choose a valid range of up to 366 days.",
      422,
    );
  return { from, to, start, end };
}
const ZERO = new Prisma.Decimal(0);
const moneyStatus = (paid: Prisma.Decimal, amount: Prisma.Decimal) =>
  paid.gt(amount)
    ? "OVERPAID"
    : paid.equals(amount)
      ? "PAID"
      : paid.gt(0)
        ? "PARTIAL"
        : "UNPAID";
export async function storeExpenses(userId: string, raw: unknown = {}) {
  const input = ExpenseQuerySchema.parse(raw),
    a = await storeAccess(userId, "finance"),
    range = expenseDates(input),
    dates = { gte: range.start, lt: range.end },
    storeId = a.store.id,
    take = 5001;
  const [orders, commissions, invoices, marketing, refunds] = await Promise.all(
    [
      prisma.order.findMany({
        where: { storeId, createdAt: dates, priceEstimate: { not: null } },
        select: {
          id: true,
          createdAt: true,
          orderNumber: true,
          status: true,
          priceEstimate: true,
          cashOnDelivery: {
            select: { digitalPaid: true, cashCollected: true },
          },
          payments: {
            where: { status: "SUCCEEDED" },
            select: { amount: true },
          },
        },
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.storeEarningCommissionCharge.findMany({
        where: { storeEarning: { storeId }, createdAt: dates },
        select: {
          id: true,
          publicReference: true,
          createdAt: true,
          amount: true,
        },
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.subscriptionInvoice.findMany({
        where: { contract: { storeId }, issuedAt: dates },
        select: {
          id: true,
          invoiceNumber: true,
          issuedAt: true,
          total: true,
          status: true,
        },
        take,
        orderBy: { issuedAt: "desc" },
      }),
      prisma.managedMarketingRequest.findMany({
        where: { storeId, createdAt: dates, status: { not: "DRAFT" } },
        select: {
          id: true,
          publicReference: true,
          createdAt: true,
          objective: true,
          status: true,
          priceSnapshot: true,
          taxSnapshot: true,
          billingEvidence: { select: { grossAmount: true } },
          payment: { select: { amount: true, status: true } },
        },
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.paymentRefund.findMany({
        where: {
          payment: { order: { storeId } },
          status: "SUCCEEDED",
          completedAt: dates,
        },
        select: {
          id: true,
          publicReference: true,
          completedAt: true,
          amount: true,
        },
        take,
        orderBy: { completedAt: "desc" },
      }),
    ],
  );
  if (
    [orders, commissions, invoices, marketing, refunds].some(
      (r) => r.length >= take,
    )
  )
    throw new PlatformError(
      "EXPENSE_RANGE_TOO_LARGE",
      "Choose a smaller date range to display all records and accurate totals.",
      422,
    );
  const rows: ExpenseRow[] = [];
  for (const o of orders) {
    const amount = o.priceEstimate!,
      paid = o.cashOnDelivery
        ? o.cashOnDelivery.digitalPaid.add(o.cashOnDelivery.cashCollected)
        : o.payments.reduce((sum, p) => sum.add(p.amount), ZERO);
    rows.push({
      id: `delivery:${o.id}`,
      date: o.createdAt.toISOString(),
      type: "DELIVERY",
      description: `Delivery ${o.orderNumber}`,
      reference: o.orderNumber,
      amount: amount.toFixed(2),
      paidAmount: paid.toFixed(2),
      status:
        ["CANCELLED", "FAILED"].includes(o.status) && paid.isZero()
          ? "VOID"
          : moneyStatus(paid, amount),
    });
  }
  for (const c of commissions)
    rows.push({
      id: `commission:${c.id}`,
      date: c.createdAt.toISOString(),
      type: "COMMISSION",
      description: "Recorded store commission deduction",
      reference: c.publicReference,
      amount: c.amount.toFixed(2),
      paidAmount: c.amount.toFixed(2),
      status: "DEDUCTED",
    });
  for (const i of invoices)
    rows.push({
      id: `subscription:${i.id}`,
      date: i.issuedAt.toISOString(),
      type: "SUBSCRIPTION",
      description: `Membership invoice ${i.invoiceNumber}`,
      reference: i.invoiceNumber,
      amount: i.total.toFixed(2),
      paidAmount: i.status === "PAID" ? i.total.toFixed(2) : "0.00",
      status: i.status === "ISSUED" ? "UNPAID" : i.status,
    });
  for (const m of marketing) {
    const amount =
        m.billingEvidence?.grossAmount ??
        m.priceSnapshot.add(
          m.priceSnapshot
            .mul(m.taxSnapshot)
            .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
        ),
      paid = m.payment?.status === "SUCCEEDED" ? m.payment.amount : ZERO;
    rows.push({
      id: `advertising:${m.id}`,
      date: m.createdAt.toISOString(),
      type: "ADVERTISING",
      description: m.objective,
      reference: m.publicReference,
      amount: amount.toFixed(2),
      paidAmount: paid.toFixed(2),
      status:
        ["CANCELLED", "REJECTED"].includes(m.status) && paid.isZero()
          ? "VOID"
          : moneyStatus(paid, amount),
    });
  }
  for (const r of refunds)
    rows.push({
      id: `refund:${r.id}`,
      date: r.completedAt!.toISOString(),
      type: "REFUND",
      description: "Completed delivery refund credit",
      reference: r.publicReference,
      amount: r.amount.negated().toFixed(2),
      paidAmount: r.amount.negated().toFixed(2),
      status: "REFUNDED",
    });
  const filtered = rows
    .filter(
      (r) =>
        (!input.type || r.type === input.type) &&
        (!input.status || r.status === input.status),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  if (filtered.length > 5000)
    throw new PlatformError(
      "EXPENSE_RANGE_TOO_LARGE",
      "Choose a smaller date range for complete records.",
      422,
    );
  const charged = filtered
      .filter(
        (r) => !["VOID", "REFUNDED"].includes(r.status) || r.type === "REFUND",
      )
      .reduce((sum, r) => sum.add(r.amount), ZERO),
    paid = filtered.reduce((sum, r) => sum.add(r.paidAmount), ZERO);
  return {
    storeName: a.store.name,
    filters: { ...input, from: range.from, to: range.to },
    totals: {
      recorded: charged.toFixed(2),
      paid: paid.toFixed(2),
      outstanding: Prisma.Decimal.max(charged.sub(paid), ZERO).toFixed(2),
    },
    count: filtered.length,
    rows: filtered,
  };
}
export function expenseCsv(rows: ExpenseRow[]) {
  const cell = (v: string, numeric = false) =>
    `"${(/^[=+\-@\t\r\n]/.test(v) && !(numeric && /^-?\d+(\.\d{1,2})?$/.test(v)) ? "'" : "") + v.replaceAll('"', '""')}"`;
  return (
    "\ufeff" +
    [
      [
        "Date",
        "Type",
        "Description",
        "Reference",
        "Amount (ZAR)",
        "Paid / deducted (ZAR)",
        "Status",
      ],
      ...rows.map((r) => [
        r.date,
        r.type,
        r.description,
        r.reference,
        r.amount,
        r.paidAmount,
        r.status,
      ]),
    ]
      .map((row) => row.map((v, i) => cell(v, i === 4 || i === 5)).join(","))
      .join("\r\n") +
    "\r\n"
  );
}
