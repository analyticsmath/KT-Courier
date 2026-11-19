import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { AdminManualDelivery } from "@/components/admin/AdminManualDelivery";

describe("manual delivery action", () => {
  it("requests recipient and reason and explains cash must be recorded", () => {
    const html = renderToStaticMarkup(createElement(AdminManualDelivery, { orderId: "order-1" }));
    expect(html).toContain("Recipient name");
    expect(html).toContain("Reason for manual confirmation");
    expect(html).toContain("Cash collection must be recorded");
    expect(html).toContain('name="recipientName"');
    expect(html).toContain('name="reason"');
  });
});
