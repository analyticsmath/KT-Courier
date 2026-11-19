import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { CodDeliveryExceptionAction } from "@/components/admin/CodDeliveryExceptionAction";
it("asks for private evidence and explains that cash remains outstanding", () => {
  const html = renderToStaticMarkup(createElement(CodDeliveryExceptionAction, { orderId: "order", mode: "report", evidence: [{ reference: "POD-proof", label: "Driver proof" }] }));
  expect(html).toContain("Private delivery evidence");
  expect(html).toContain("does not record cash");
  expect(html).toContain("POD-proof");
});
it("offers an independent review decision", () => {
  const html = renderToStaticMarkup(createElement(CodDeliveryExceptionAction, { orderId: "order", mode: "review", evidence: [] }));
  expect(html).toContain("Verify reported delivery");
  expect(html).toContain("Reject report");
});
