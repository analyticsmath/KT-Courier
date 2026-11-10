// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { StoreCheckoutCertificationPanel } from "@/components/admin/StoreCheckoutCertificationPanel";

it("offers renewed review when an approved certificate has expired", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(React.createElement(StoreCheckoutCertificationPanel, { storeId: "store", initialNeedsRenewal: true, initial: {
      status: "APPROVED", revision: 1, preparedAt: "2020-01-01T00:00:00Z", approvedAt: "2020-01-02T00:00:00Z", expiresAt: "2020-02-01T00:00:00Z",
      preparedByUserId: "one", approvedByUserId: "two", routeEvidenceReference: "route-reference", routeEvidenceDigest: "a".repeat(64), checkoutEvidenceReference: "checkout-reference", checkoutEvidenceDigest: "b".repeat(64),
    } })));
    expect(host.textContent).toContain("RENEWAL REQUIRED");
    expect(host.querySelector("#cert-route-ref")).not.toBeNull();
  } finally { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});
