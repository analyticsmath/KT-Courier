import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "lib/services/refund-query.service.ts"), "utf8");
describe("refund query service", () => {
  it("scopes customer reads by owner and returns string amounts", () => { expect(source).toMatch(/customerUserId:\s*userId/); expect(source).toMatch(/amount\.toFixed\(2\)/); });
  it("returns safe provider evidence without request hashes, credentials, or raw responses", () => { expect(source).not.toMatch(/requestHash|creationRequestHash|credentialVersion|rawResponse|passphrase|signature/); expect(source).toMatch(/safeResultSnapshot/); });
  it("does not expose internal account IDs to customer DTOs", () => { const customerSection = source.slice(0, source.indexOf("const financeInclude")); expect(customerSection).not.toMatch(/ledgerAccountId|reserveLedgerJournalId|completionLedgerJournalId/); });
});
