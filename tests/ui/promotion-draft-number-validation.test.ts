// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { PromotionDraftForm } from "@/components/forms/PromotionDraftForm";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
it("accepts whole-number usage limits and exact decimal discount amounts", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(PromotionDraftForm, { products: [], categories: [] })));
    for (const name of ["globalLimit", "perCustomerLimit"]) {
      const input = host.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
      expect(input.validity.valid).toBe(true);
      input.value = "1.5"; expect(input.validity.stepMismatch).toBe(true);
      input.value = "0"; expect(input.validity.rangeUnderflow).toBe(true);
    }
    const amount = host.querySelector<HTMLInputElement>('input[name="value"]')!;
    amount.value = "5.25"; expect(amount.validity.valid).toBe(true);
    amount.value = "0"; expect(amount.validity.rangeUnderflow).toBe(true);
  } finally { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});
