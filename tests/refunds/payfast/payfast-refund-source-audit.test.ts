import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const directory = join(process.cwd(), "lib", "refunds", "providers", "payfast");
const source = readdirSync(directory).filter((file) => file.endsWith(".ts")).map((file) => readFileSync(join(directory, file), "utf8")).join("\n");
describe("Payfast refund source audit", () => {
  it("contains no customer banking or card fields", () => expect(source).not.toMatch(/account_number|account_holder|branch_code|card_number|\bcvv\b|\bcvc\b|\biban\b|\bswift\b/i));
  it("does not accept an arbitrary API origin from environment variables", () => expect(source).not.toMatch(/process\.env\.(?:PAYFAST_)?(?:REFUND_)?(?:URL|HOST|ORIGIN|ENDPOINT)/));
  it("contains no direct fetch or network client", () => expect(source).not.toMatch(/\bfetch\s*\(|axios|https\.request|http\.request/));
  it("keeps API signing separate from checkout and ITN signers", () => expect(source).not.toMatch(/generatePayfastSignature|verifyPayfastItnSignature/));
});
