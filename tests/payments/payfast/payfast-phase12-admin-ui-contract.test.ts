import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const ui = ["app/(admin)/admin/payment-webhooks/page.tsx", "app/(admin)/admin/payment-webhooks/[id]/page.tsx", "app/(admin)/admin/payment-reconciliation/page.tsx", "app/(admin)/admin/payment-reconciliation/[id]/page.tsx", "components/admin/PaymentConfirmationFilters.tsx"].map((path) => readFileSync(path, "utf8")).join("\n");
describe("Phase 12 admin UI contract", () => {
  it("has exact headings, labelled filters, and read-only inspection", () => { expect(ui).toContain('title="Payment Webhooks"'); expect(ui).toContain('title="Payment Reconciliation"'); expect(ui).toMatch(/htmlFor=/); expect(ui).not.toMatch(/mark success|approve payment|post journal|delete event/i); });
  it("does not render raw or secret evidence", () => expect(ui).not.toMatch(/rawBody|eventFingerprint|passphrase|merchantKey|signatureBase/));
});
