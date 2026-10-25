import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { usePathname } from "next/navigation";

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));
vi.mock("@/components/public-v3/redesign/EditorialMotion", () => ({ EditorialMotion: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/public-v3/brand/CanonicalKtLogo", () => ({ CanonicalKtLogo: () => null }));
import { MarketingFooter } from "@/components/public-v3/redesign/MarketingFooter";

describe("persistent mobile purchase dock footer clearance", () => {
  it("enables safe bottom clearance only on product-detail routes", () => {
    vi.mocked(usePathname).mockReturnValue("/shop/products/red-apples");
    expect(renderToStaticMarkup(createElement(MarketingFooter))).toMatch(/data-mobile-purchase-dock="true"/);
    vi.mocked(usePathname).mockReturnValue("/quote");
    expect(renderToStaticMarkup(createElement(MarketingFooter))).not.toMatch(/data-mobile-purchase-dock="true"/);
  });
});
