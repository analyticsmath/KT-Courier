import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { StoreSellerIdentityForm } from "@/components/store/StoreSellerIdentityForm";

describe("unregistered seller identity onboarding", () => {
  it("shows accurate individual seller guidance and browser-valid identity version rules", () => {
    const html = renderToStaticMarkup(createElement(StoreSellerIdentityForm, { currentReference: null }));
    expect(html).toMatch(/unregistered (?:business|seller)/i);
    expect(html).toMatch(/legal name of the owner/i);
    expect(html).toMatch(/Registration reference.*optional/i);
    expect(html).toMatch(/PAMMY_BAKES_V1/);
    expect(html).toMatch(/pattern="\[A-Za-z0-9\]\[A-Za-z0-9_\.\-\]\*"[^>]*name="identityVersion"/);
    expect(html).toMatch(/Upload supporting document/);
    expect(html).toMatch(/sourceEvidenceReference/);
  });
});
