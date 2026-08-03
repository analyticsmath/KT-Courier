import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "app", "(account)", "account");
describe("refund customer UI contract", () => {
  const wallet = readFileSync(join(root, "wallet", "page.tsx"), "utf8");
  const refunds = readFileSync(join(root, "refunds", "page.tsx"), "utf8");
  const detail = readFileSync(join(root, "refunds", "[publicReference]", "page.tsx"), "utf8");
  it("uses the exact Wallet and Refunds headings", () => { expect(wallet).toContain('title="Wallet"'); expect(refunds).toContain('title="Refunds"'); });
  it("explains the production lock without exposing internals", () => { expect(`${refunds}\n${detail}`).toMatch(/consolidated validation|production/i); expect(`${wallet}\n${refunds}\n${detail}`).not.toMatch(/ledgerAccountId|commissionAllocation|credentialVersion|requestHash/); });
  it("does not implement spending", () => expect(wallet).not.toMatch(/href=.*wallet\/(?:spend|transfer|withdraw)|<form[^>]+wallet/i));
});
