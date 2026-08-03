import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "app", "(admin)", "admin");
describe("refund admin UI contract", () => {
  const list = readFileSync(join(root, "refunds", "page.tsx"), "utf8");
  const detail = readFileSync(join(root, "refunds", "[id]", "page.tsx"), "utf8");
  const reconciliation = readFileSync(join(root, "refund-reconciliation", "page.tsx"), "utf8");
  it("uses the exact finance headings", () => { expect(list).toContain('title="Refunds"'); expect(reconciliation).toContain('title="Refund Reconciliation"'); });
  it("has no manual success, amount editor, banking, ledger selector, or credential control", () => expect(`${list}\n${detail}`).not.toMatch(/mark.?success|bank account|branch code|ledger account selector|merchant key|passphrase/i));
  it("exposes reviewed actions only", () => expect(detail).toMatch(/FinanceRefundActions/));
});
