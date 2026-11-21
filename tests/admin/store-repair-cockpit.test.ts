import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  StoreRepairCockpit,
  type StoreRepairGateItem,
} from "@/components/admin/StoreRepairCockpit";

describe("StoreRepairCockpit component", () => {
  const gates: StoreRepairGateItem[] = [
    {
      key: "identity",
      category: "IDENTITY",
      title: "Seller Legal Identity",
      ready: false,
      explanation: "Missing approved legal entity verification.",
      actionHref: "/admin/stores/store-123/seller-identity",
      actionLabel: "Review Seller Identity",
    },
    {
      key: "collection",
      category: "COLLECTION",
      title: "Collection Address & Geocode",
      ready: true,
      explanation: "Complete address with valid coordinates.",
      actionHref: "#manage-pickup-address",
      actionLabel: "Edit Collection Address",
    },
    {
      key: "settlement",
      category: "SETTLEMENT",
      title: "Commission Settlement Plan",
      ready: false,
      explanation: "No active approved commission plan.",
      actionHref: "/admin/commission-plans?storeId=store-123",
      actionLabel: "Configure Commission",
    },
  ];

  it("renders blocked state with exact blockers and action links when store is not ready", () => {
    const html = renderToStaticMarkup(
      createElement(StoreRepairCockpit, {
        storeId: "store-123",
        storeName: "Test Store",
        isPubliclyVisible: false,
        blockers: [
          "Approved legal seller identity missing or expired",
          "Active store commission plan missing or expired",
        ],
        gates,
      }),
    );

    expect(html).toContain("Store Publication &amp; Checkout Repair Cockpit");
    expect(html).toContain("2 REPAIR ACTIONS NEEDED");
    expect(html).toContain("Publication Readiness Score: 1 of 3 Gates Satisfied");
    expect(html).toContain("sql-store-publication: BLOCKED");
    expect(html).toContain("Approved legal seller identity missing or expired");
    expect(html).toContain("Active store commission plan missing or expired");
    expect(html).toContain("/admin/stores/store-123/seller-identity");
    expect(html).toContain("Review Seller Identity");
    expect(html).toContain("/admin/commission-plans?storeId=store-123");
    expect(html).toContain("Configure Commission");
  });

  it("renders PUBLICLY READY when all gates pass with zero blockers", () => {
    const passedGates = gates.map((g) => ({ ...g, ready: true }));
    const html = renderToStaticMarkup(
      createElement(StoreRepairCockpit, {
        storeId: "store-123",
        storeName: "Test Store",
        isPubliclyVisible: true,
        blockers: [],
        gates: passedGates,
      }),
    );

    expect(html).toContain("PUBLICLY READY");
    expect(html).toContain("Publication Readiness Score: 3 of 3 Gates Satisfied");
    expect(html).not.toContain("sql-store-publication: BLOCKED");
    expect(html).not.toContain("Active Publication Blockers");
  });
});
