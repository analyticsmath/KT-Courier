import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { StoreSellerIdentityForm } from "@/components/store/StoreSellerIdentityForm";

describe("seller legal identity form accessible labels", () => {
  it("associates input labels with actual inputs, separate from help text", () => {
    const html = renderToStaticMarkup(createElement(StoreSellerIdentityForm, { currentReference: null }));
    for (const [id, label, field] of [
      ["seller-legal-name", "Legal seller name", "legalName"],
      ["seller-registration-reference", "Registration reference (optional)", "registrationReference"],
      ["seller-evidence-reference", "Supplied evidence reference", "sourceEvidenceReference"],
    ]) {
      expect(html).toContain(`for="${id}">${label}</label>`);
      expect(html).toContain(`id="${id}"`);
      expect(html).toContain(`name="${field}"`);
      // Help paragraphs are siblings, never label descendants.
      expect(html).not.toMatch(new RegExp(`<label[^>]*for="${id}"[^>]*>[^<]*<p`));
    }
  });
});
