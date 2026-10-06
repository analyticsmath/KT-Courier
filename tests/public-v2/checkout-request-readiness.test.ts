import { beforeEach, describe, expect, it, vi } from "vitest";
import { connection } from "next/server";
import { evaluateMarketplaceCheckoutPublicGate } from "@/lib/marketplace-checkout/production-lock";
import CartPage from "@/app/(public)/cart/page";
import CheckoutPage from "@/app/(public)/checkout/page";
import { MarketplaceUnavailable } from "@/components/public-v2/marketplace";

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/marketplace-checkout/production-lock", () => ({ evaluateMarketplaceCheckoutPublicGate: vi.fn() }));
vi.mock("@/components/public-v2/marketplace", () => ({ MarketplaceUnavailable: () => null }));
vi.mock("@/components/public-v2/commerce/CartExperience", () => ({ CartExperience: () => null }));
vi.mock("@/components/public-v2/commerce/CheckoutExperience", () => ({ CheckoutExperience: () => null }));

describe.each([["cart", CartPage], ["checkout", CheckoutPage]] as const)("%s request-time activation", (_name, page) => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(connection).mockResolvedValue(undefined); });

  it("reflects activation and maintenance changes on subsequent requests", async () => {
    vi.mocked(evaluateMarketplaceCheckoutPublicGate).mockReturnValue({ enabled: false, blockReason: "CHECKOUT_PUBLIC_DISABLED" });
    expect((await page()).type).toBe(MarketplaceUnavailable);
    vi.mocked(evaluateMarketplaceCheckoutPublicGate).mockReturnValue({ enabled: true, blockReason: null });
    expect((await page()).type).not.toBe(MarketplaceUnavailable);
    vi.mocked(evaluateMarketplaceCheckoutPublicGate).mockReturnValue({ enabled: false, blockReason: "CHECKOUT_PUBLIC_DISABLED" });
    expect((await page()).type).toBe(MarketplaceUnavailable);
  });

  it("does not evaluate provider configuration during prerendering", async () => {
    let arrive: (() => void) | undefined;
    vi.mocked(connection).mockImplementation(() => new Promise<void>((resolve) => { arrive = resolve; }));
    vi.mocked(evaluateMarketplaceCheckoutPublicGate).mockReturnValue({ enabled: true, blockReason: null });
    const response = page();
    expect(evaluateMarketplaceCheckoutPublicGate).not.toHaveBeenCalled();
    arrive!();
    await response;
    expect(evaluateMarketplaceCheckoutPublicGate).toHaveBeenCalledOnce();
  });
});
