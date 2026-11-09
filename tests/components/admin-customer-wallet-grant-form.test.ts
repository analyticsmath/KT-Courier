import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { AdminCustomerWalletGrantForm } from "@/components/admin/AdminCustomerWalletGrantForm";

describe("superuser customer wallet grant UI", () => {
  it("explains the money boundary and provides correctly associated amount and audit inputs", () => {
    const html = renderToStaticMarkup(createElement(AdminCustomerWalletGrantForm, {
      customerUserId: "test-customer",
    }));
    expect(html).toContain('for="wallet-grant-amount"');
    expect(html).toContain('id="wallet-grant-amount"');
    expect(html).toContain('min="0.01"');
    expect(html).toContain('max="5000"');
    expect(html).toContain('for="wallet-grant-reason"');
    expect(html).toMatch(/min[Ll]ength="12"/);
    expect(html).toContain("nonwithdrawable wallet balance");
    expect(html).toContain("Wallet spending remains disabled");
    expect(html).toContain("Confirm and credit wallet");
  });
});
