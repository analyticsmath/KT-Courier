import { beforeEach, describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
const db = vi.hoisted(() => ({
  order: { findMany: vi.fn() },
  storeEarningCommissionCharge: { findMany: vi.fn() },
  subscriptionInvoice: { findMany: vi.fn() },
  managedMarketingRequest: { findMany: vi.fn() },
  paymentRefund: { findMany: vi.fn() },
}));
const access = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/client-platform/store-access", () => ({ storeAccess: access }));
import {
  storeExpenses,
  expenseCsv,
  expenseDates,
  ExpenseQuerySchema,
} from "@/lib/client-platform/expenses.service";
const date = new Date("2026-10-01T12:00:00Z"),
  query = { from: "2026-10-01", to: "2026-10-02" };
beforeEach(() => {
  vi.resetAllMocks();
  access.mockResolvedValue({ store: { id: "business", name: "Store" } });
  Object.values(db).forEach((d) => d.findMany.mockResolvedValue([]));
});
describe("business expense history", () => {
  it("scopes every source to the actual Finance business", async () => {
    await storeExpenses("employee", query);
    expect(access).toHaveBeenCalledWith("employee", "finance");
    expect(db.order.findMany.mock.calls[0][0].where.storeId).toBe("business");
    expect(
      db.subscriptionInvoice.findMany.mock.calls[0][0].where.contract.storeId,
    ).toBe("business");
    expect(
      db.managedMarketingRequest.findMany.mock.calls[0][0].where.storeId,
    ).toBe("business");
  });
  it("counts a COD deposit once and retains the unpaid cash component", async () => {
    db.order.findMany.mockResolvedValue([
      {
        id: "o",
        createdAt: date,
        orderNumber: "KT-1",
        status: "CONFIRMED",
        priceEstimate: new Prisma.Decimal(179),
        cashOnDelivery: {
          digitalPaid: new Prisma.Decimal("89.50"),
          cashCollected: new Prisma.Decimal(0),
        },
        payments: [{ amount: new Prisma.Decimal("89.50") }],
      },
    ]);
    const r = await storeExpenses("employee", query);
    expect(r.totals).toEqual({
      recorded: "179.00",
      paid: "89.50",
      outstanding: "89.50",
    });
    expect(r.rows[0].status).toBe("PARTIAL");
  });
  it("adds completed refund credits and excludes unpaid voided orders", async () => {
    db.order.findMany.mockResolvedValue([
      {
        id: "o",
        createdAt: date,
        orderNumber: "KT-1",
        status: "CANCELLED",
        priceEstimate: new Prisma.Decimal(100),
        cashOnDelivery: null,
        payments: [],
      },
    ]);
    db.paymentRefund.findMany.mockResolvedValue([
      {
        id: "r",
        publicReference: "REF-1",
        completedAt: date,
        amount: new Prisma.Decimal(25),
      },
    ]);
    const r = await storeExpenses("employee", query);
    expect(r.totals.recorded).toBe("-25.00");
    expect(r.totals.paid).toBe("-25.00");
  });
  it("does not silently truncate a financial total", async () => {
    db.order.findMany.mockResolvedValue(Array(5001).fill({}));
    await expect(storeExpenses("employee", query)).rejects.toMatchObject({
      code: "EXPENSE_RANGE_TOO_LARGE",
    });
  });
  it("rejects reversed or oversized date ranges", () => {
    expect(() =>
      expenseDates(
        ExpenseQuerySchema.parse({ from: "2026-10-02", to: "2026-10-01" }),
      ),
    ).toThrow();
    expect(() =>
      expenseDates(
        ExpenseQuerySchema.parse({ from: "2020-01-01", to: "2026-10-01" }),
      ),
    ).toThrow();
  });
  it("neutralizes spreadsheet formulas and quotes multiline text", () => {
    const csv = expenseCsv([
      {
        id: "x",
        date: date.toISOString(),
        type: "ADVERTISING",
        description: '=HYPERLINK("bad")\nline',
        reference: "@SUM(1)",
        amount: "10.00",
        paidAmount: "0.00",
        status: "UNPAID",
      },
    ]);
    expect(csv).toContain('"\'=HYPERLINK(""bad"")\nline"');
    expect(csv).toContain('"\'@SUM(1)"');
  });
  it("denies missing Finance access before reading records", async () => {
    access.mockRejectedValue(Error("denied"));
    await expect(storeExpenses("other", query)).rejects.toThrow("denied");
    expect(db.order.findMany).not.toHaveBeenCalled();
  });
});
