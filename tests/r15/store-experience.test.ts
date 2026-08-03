import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getPrioritisedStoreFulfilmentRows, getStoreFulfilmentSummary, type StoreFulfilmentQueue } from "@/lib/store-presentation/store-fulfilment-priority";
import { PROTECTED_NAVIGATION_REGISTRY } from "@/lib/protected-navigation";

const root = process.cwd();
const source = (file: string) => readFileSync(path.join(root, file), "utf8");
const storeRoutes = [
  "page.tsx", "advertising/page.tsx", "catalog/page.tsx", "catalog/imports/page.tsx", "catalog/inventory/page.tsx", "catalog/media/page.tsx", "catalog/modifiers/page.tsx", "catalog/offers/page.tsx", "catalog/offers/[publicReference]/page.tsx", "catalog/products/page.tsx", "catalog/products/new/page.tsx", "catalog/products/[publicReference]/page.tsx", "earnings/page.tsx", "earnings/[publicReference]/page.tsx", "marketplace-orders/[reference]/page.tsx", "new-delivery/page.tsx", "notifications/page.tsx", "orders/page.tsx", "orders/[id]/page.tsx", "profile/page.tsx", "promotions/page.tsx", "promotions/new/page.tsx", "promotions/[reference]/page.tsx", "promotions/[reference]/budget/page.tsx", "promotions/[reference]/redemptions/page.tsx", "subscription/page.tsx", "subscription/benefits/page.tsx", "subscription/billing/page.tsx", "subscription/plans/page.tsx", "support/page.tsx",
];

describe("R15 store operations experience", () => {
  it("keeps every verified store route at its canonical path", () => {
    for (const route of storeRoutes) expect(existsSync(path.join(root, "app/(store)/store", route))).toBe(true);
  });

  it("keeps store navigation registry-driven and route-backed", () => {
    for (const item of PROTECTED_NAVIGATION_REGISTRY.filter((item) => item.contexts.includes("STORE"))) {
      const suffix = item.href === "/store" ? "page.tsx" : `${item.href.slice("/store/".length)}/page.tsx`;
      expect(existsSync(path.join(root, "app/(store)/store", suffix))).toBe(true);
    }
  });

  it("uses deterministic server-preserved fulfilment section precedence", () => {
    const queue: StoreFulfilmentQueue = {
      customerActionRequired: [{ publicReference: "attention", acceptanceStatus: "CUSTOMER_ACTION_REQUIRED", preparationStatus: "NOT_STARTED", resolutionStatus: "ISSUE_OPEN", deliveryBridgeStatus: "NOT_REQUESTED", reviewDeadlineAt: null, createdAt: new Date("2026-01-01") }],
      needsReview: [{ publicReference: "review", acceptanceStatus: "PENDING_STORE_REVIEW", preparationStatus: "NOT_STARTED", resolutionStatus: "CLEAR", deliveryBridgeStatus: "NOT_REQUESTED", reviewDeadlineAt: null, createdAt: new Date("2026-01-02") }],
      readyForPickup: [{ publicReference: "ready", acceptanceStatus: "ACCEPTED", preparationStatus: "READY_FOR_HANDOFF", resolutionStatus: "CLEAR", deliveryBridgeStatus: "NOT_REQUESTED", reviewDeadlineAt: null, createdAt: new Date("2026-01-03") }],
      accepted: [], preparing: [], handoffInProgress: [], completedHandoff: [], rejectedOrCancelled: [], reconciliationRequired: [],
    };
    expect(getPrioritisedStoreFulfilmentRows(queue).map((row) => row.publicReference)).toEqual(["attention", "review", "ready"]);
    expect(getStoreFulfilmentSummary(queue)).toMatchObject({ needsAttention: 2, needsPreparation: 0, readyForCollection: 1 });
  });

  it("keeps preparation and readiness bound to the canonical server action", () => {
    const actions = source("components/protected-v2/store/StoreFulfilmentActions.tsx");
    expect(actions).toContain("/api/store/orders/${encodeURIComponent(reference)}/actions");
    expect(actions).toContain('submit("mark-ready")');
    expect(actions).toContain('name="preparationMinutes"');
    expect(actions).toContain('name="pickupInstructions"');
    expect(actions).not.toContain("preparationMinutes: 30");
    expect(actions).toContain("router.refresh()");
  });

  it("uses protected, source-backed page presentation without fixture commerce or prohibited visual treatment", () => {
    const pages = storeRoutes.map((route) => source(`app/(store)/store/${route}`)).join("\n");
    expect(pages).toContain("ProtectedPageHeader");
    expect(pages).not.toMatch(/Summer Collection Launch|My Store|Save 20%|fake ETA|driver exact location/i);
    expect(pages).not.toMatch(/linear-gradient|backdrop-blur|\bpurple\b|\bviolet\b/i);
    expect(pages).not.toMatch(/journalReference|releaseJournalReference|ledgerAccount|accountId/);
  });

  it("keeps locked commercial capabilities honest", () => {
    const commercial = ["advertising/page.tsx", "promotions/page.tsx", "subscription/page.tsx"].map((route) => source(`app/(store)/store/${route}`)).join("\n");
    expect(commercial).toContain("StoreCommercialUnavailablePage");
    expect(commercial).not.toMatch(/Create Draft|Fund Campaign|Campaign funded successfully|Phase 23/i);
  });
});
