import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const files = [
  "app/(admin)/admin/payments/page.tsx",
  "app/(admin)/admin/payments/[id]/page.tsx",
  "app/(admin)/admin/payment-providers/page.tsx",
  "components/admin/PaymentTables.tsx",
].map((file) => readFileSync(file, "utf8")).join("\n");
describe("admin payment UI contract", () => {
  it.each(["Payments", "Payment details", "Payment Providers", "Payment attempts", "Payment lifecycle history"])("contains stable semantic locator %s", (text) => expect(files).toContain(text));
  it.each(["Capture payment", "Retry payment", "Refund payment", "Mark success", "Edit credentials"])("has no mutation control %s", (label) => expect(files).not.toContain(label));
  it("does not render hashes, raw snapshots, or credentials", () => expect(files).not.toMatch(/creationRequestHash|requestHash|requestSnapshot|resultSnapshot|merchantKey|apiToken/));
});

