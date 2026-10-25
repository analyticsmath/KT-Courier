import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
import { DriverCash } from "@/components/forms/DriverCash";
import { CashDepositReview } from "@/components/forms/CashDepositReview";
import type { driverCashSummary, listCashDeposits, readBankInstructions } from "@/lib/client-platform/driver-cash.service";

const bank = {
  bankName: "Verified Example Bank", accountName: "KT Couriers Pty Ltd",
  accountNumber: "123456789", branchCode: "123456",
  referenceHint: "Use your delivery reference", handoverEnabled: true,
  expectedVersion: 3,
} as Awaited<ReturnType<typeof readBankInstructions>>;
const cash = {
  totals: { collected: "125.00", remitted: "0.00", held: "125.00" },
  bankInstructions: bank, handoverEnabled: true, hasMoreActionableOrders: false,
  orders: [{ orderId: "order-fixture", orderNumber: "KT-123",
    total: "125.00", digitalPaid: "0.00", cashRequired: "125.00",
    cashCollected: "125.00", cashDeposited: "0.00", status: "COLLECTED",
    canCollect: false, canDeposit: true }], deposits: [],
} as Awaited<ReturnType<typeof driverCashSummary>>;

describe("cash remittance interfaces", () => {
  it("shares saved bank details with the active driver's secure cash dashboard", () => {
    const html = renderToStaticMarkup(createElement(DriverCash, { summary: cash }));
    expect(html).toContain("Verified Example Bank");
    expect(html).toContain("123456789");
    expect(html).toContain("Copy bank details");
    expect(html).toContain("Bank deposit reference");
    expect(html).toContain("Hand cash directly to KT");
    expect(html).toContain("Cash in your custody");
  });
  it("never advertises in-person handover when the owner has disabled it", () => {
    const html = renderToStaticMarkup(createElement(DriverCash, {
      summary: { ...cash, handoverEnabled: false },
    }));
    expect(html).not.toContain("Hand cash directly to KT");
  });
  it("shows the bank configuration and separately verified physical handover in admin", () => {
    const deposits = [{ id:"dep-1", driverName:"Driver fixture", driverCode:"CODE", orderNumber:"KT-123",
      amount:"125.00", bankReference:"INPERSON-123", remittanceMethod:"IN_PERSON", status:"PENDING",
      note:null, createdAt:"2026-10-25T00:00:00Z" }] as Awaited<ReturnType<typeof listCashDeposits>>;
    const html = renderToStaticMarkup(createElement(CashDepositReview, { bank, deposits }));
    expect(html).toContain("Save and share instructions");
    expect(html).toContain("Allow physical cash handover");
    expect(html).toContain("received and counted");
    expect(html).toContain("In-person cash handover");
  });
});
