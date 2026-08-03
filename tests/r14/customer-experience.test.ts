import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CUSTOMER_ACTIVE_ORDER_STATUSES,
  formatCustomerMoney,
  getCustomerOrderStatus,
} from "@/lib/customer-presentation/customer-order-presentation";
import { PROTECTED_NAVIGATION_REGISTRY, projectProtectedNavigation } from "@/lib/protected-navigation";

const root = process.cwd();
const source = (file: string) => readFileSync(path.join(root, file), "utf8");

const customerRoutes = [
  "account/page.tsx",
  "account/addresses/page.tsx",
  "account/business/page.tsx",
  "account/membership/page.tsx",
  "account/membership/benefits/page.tsx",
  "account/membership/invoices/page.tsx",
  "account/notifications/page.tsx",
  "account/orders/page.tsx",
  "account/orders/[id]/page.tsx",
  "account/orders/[id]/exception/page.tsx",
  "account/payout-destinations/page.tsx",
  "account/profile/page.tsx",
  "account/promotions/page.tsx",
  "account/recipients/page.tsx",
  "account/refunds/page.tsx",
  "account/refunds/[publicReference]/page.tsx",
  "account/request-delivery/page.tsx",
  "account/request-delivery/freight/page.tsx",
  "account/request-delivery/moving/page.tsx",
  "account/request-delivery/shuttle/page.tsx",
  "account/security/page.tsx",
  "account/support/page.tsx",
  "account/wallet/page.tsx",
  "account/wallet/payment-methods/page.tsx",
  "account/wallet/transactions/page.tsx",
  "account/withdrawals/page.tsx",
  "account/withdrawals/[publicReference]/page.tsx",
];

describe("R14 customer account experience", () => {
  it("keeps every verified customer route at its canonical path", () => {
    for (const route of customerRoutes) {
      expect(existsSync(path.join(root, "app/(account)", route))).toBe(true);
    }
  });

  it("keeps customer navigation registry-driven and route-backed", () => {
    const customer = projectProtectedNavigation("CUSTOMER", new Set());
    expect(customer.mobileNavigation.map((item) => item.href)).toEqual([
      "/account",
      "/account/request-delivery",
      "/account/orders",
      "/account/wallet",
      "/account/notifications",
    ]);
    for (const item of PROTECTED_NAVIGATION_REGISTRY.filter((item) => item.contexts.includes("CUSTOMER"))) {
      if (item.href === "/account") continue;
      expect(existsSync(path.join(root, "app/(account)/account", item.href.replace("/account/", ""), "page.tsx"))).toBe(true);
    }
  });

  it("uses the protected customer page architecture without fixture customer data", () => {
    const pages = customerRoutes.map((route) => source(`app/(account)/${route}`)).join("\n");
    expect(pages).toContain("CustomerPage");
    expect(pages).not.toMatch(/Sarah Connor|John Connor|john@example\.co\.za|WELCOMEZA|MacBook Pro|iPhone 15|Visa.*4321|Mastercard.*8765/);
    expect(pages).not.toContain("regional warehouse");
  });

  it("keeps active delivery selection deterministic and without fabricated analytics", () => {
    const overview = source("app/(account)/account/page.tsx");
    expect(overview).toContain('orderBy: [{ updatedAt: "desc" }, { id: "asc" }]');
    expect(overview).toContain("CUSTOMER_ACTIVE_ORDER_STATUSES");
    expect(overview).not.toMatch(/chart|sparkline|percent|growth/i);
    expect(CUSTOMER_ACTIVE_ORDER_STATUSES).toContain("IN_TRANSIT");
  });

  it("uses explicit customer-safe status maps and a neutral unknown state", () => {
    expect(getCustomerOrderStatus("DELIVERED")).toMatchObject({ label: "Delivered", tone: "success" });
    expect(getCustomerOrderStatus("UNRECOGNIZED_STATUS")).toMatchObject({ label: "Status update unavailable", tone: "neutral" });
  });

  it("keeps address-provider fallback honest and quote authority server-side", () => {
    const autocomplete = source("components/maps/AddressAutocomplete.tsx");
    const form = source("components/forms/DeliveryRequestForm.tsx");
    expect(autocomplete).toContain("latitude: null");
    expect(autocomplete).toContain("longitude: null");
    expect(autocomplete).not.toMatch(/-26\.2041|-26\.1|28\.0473|28\.1/);
    expect(form).toContain("/api/pricing/quotes");
    expect(form).toContain("/api/orders");
    expect(form).not.toMatch(/calculatePrice|priceEstimate\s*=/);
    expect(form).toContain("confirmed mapped pickup and destination");
  });

  it("keeps finance presentation decimal-text based and omits ledger implementation fields", () => {
    expect(formatCustomerMoney("1250.50", "ZAR")).toBe("ZAR 1,250.50");
    const wallet = `${source("app/(account)/account/wallet/page.tsx")}\n${source("app/(account)/account/wallet/transactions/page.tsx")}`;
    expect(wallet).toContain("formatCustomerMoney");
    expect(wallet).not.toContain("journalReference}</");
    expect(wallet).not.toMatch(/ledgerAccount|accountId/);
  });

  it("uses structured mobile delivery records and semantic timeline/table foundations", () => {
    const presentation = source("components/protected-v2/customer/CustomerPresentation.tsx");
    const table = source("components/protected-v2/data/EditorialTable.tsx");
    expect(presentation).toContain('<ul aria-label="Your delivery records"');
    expect(presentation).toContain("ActivityTimeline");
    expect(table).toContain("column.sortDirection ? column.sortDirection : undefined");
    expect(table).not.toContain('"none"');
  });

  it("does not introduce anonymous customer tracking", () => {
    const customerSources = customerRoutes.map((route) => source(`app/(account)/${route}`)).join("\n");
    expect(customerSources).not.toMatch(/anonymous tracking|tracking number|live location|fake ETA/i);
  });
});
