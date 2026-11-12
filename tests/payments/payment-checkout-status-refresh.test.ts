// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PaymentCheckoutClient } from "@/components/payments/PaymentCheckoutClient";

const payment = {
  publicReference: "pay_test_0001",
  orderReference: "KT-2026-001",
  amount: "100.00", currency: "ZAR" as const,
  provider: "PAYSTACK" as const, status: "PROCESSING" as const,
  updatedAt: "2026-11-12T10:00:00.000Z",
};
let root: Root | null = null;
let element: HTMLDivElement | null = null;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  element?.remove();
  root = null;
  element = null;
  vi.unstubAllGlobals();
});

describe("safe customer-initiated payment refresh", () => {
  async function mount() {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    element = document.createElement("div");
    document.body.appendChild(element);
    root = createRoot(element);
    await act(async () => root?.render(createElement(PaymentCheckoutClient, {
      orderId: "order-001", orderReference: payment.orderReference,
      initialPayment: payment,
      provider: { active: true, environment: "sandbox", blockReason: null },
    })));
  }

  it("reads owner-scoped server payment status without preparing another provider charge", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ payment: { ...payment, status: "SUCCEEDED" } }),
    });
    vi.stubGlobal("fetch", fetcher);
    await mount();
    const button = Array.from(element!.querySelectorAll("button"))
      .find(item => item.textContent?.includes("Check payment status"));
    expect(button).toBeDefined();
    await act(async () => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/payments/pay_test_0001", { method: "GET", cache: "no-store" },
    );
    expect(element!.textContent).toContain("Your payment was verified.");
  });

  it("rejects a misbound payment response and never labels it successful", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ payment: { ...payment, publicReference: "another-payment", status: "SUCCEEDED" } }),
    });
    vi.stubGlobal("fetch", fetcher);
    await mount();
    const button = Array.from(element!.querySelectorAll("button"))
      .find(item => item.textContent?.includes("Check payment status"));
    await act(async () => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(element!.textContent).toContain("could not be verified for this delivery");
    expect(element!.textContent).not.toContain("Your payment was verified.");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
