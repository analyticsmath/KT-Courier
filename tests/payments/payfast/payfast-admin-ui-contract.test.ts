import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync("components/admin/PaymentTables.tsx", "utf8");
describe("Payfast admin readiness UI", () => {
  it.each(["Form POST checkout", "Authoritative webhook confirmation", "Block reason", "Environment / action"])("shows safe audit label %s", (label) => expect(source).toContain(label));
  it("has no credential mutation or display", () => expect(source).not.toMatch(/Merchant Key|passphrase|signature|Edit credentials|Activate production/));
});
