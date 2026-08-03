import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function getFilesRecursively(dir: string): string[] {
  const full = join(root, dir);
  if (!existsSync(full)) return [];
  const results: string[] = [];
  function walk(current: string) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const p = join(current, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile()) results.push(p.slice(root.length + 1).replaceAll("\\", "/"));
    }
  }
  walk(full);
  return results;
}

const files = ["lib/promoters", "app/api/promoter", "app/api/referrals", "app/r", "components/promoters"].flatMap(getFilesRecursively);
const text = files.map((file) => readFileSync(join(root, file), "utf8")).join("\n");

describe("Phase 25 executable source audit", () => {
  it("passes the authoritative source audit script", () => expect(() => execFileSync(process.execPath, ["scripts/audit-phase25-promoter-source.mjs"], { cwd: root, stdio: "pipe" })).not.toThrow());
  it("has no TODO, placeholder, static API entity, or message-only processor", () => {
    expect(text).not.toMatch(/\bTODO\b|\bFIXME\b|placeholder|Not implemented/i);
    expect(text).not.toMatch(/return\s+\[\s*\]|retryHistory\s*:\s*\[\s*\]/);
    expect(text).not.toMatch(/const\s+(?:promoters|earnings|referrals|programs)\s*=\s*\[/i);
  });
  it("has no PII projection, raw-code log, mock financial authority, or direct balance mutation", () => {
    expect(text).not.toMatch(/customer(?:Name|Email|Phone)|streetAddress|rawReferralCode|console\.(log|error).*code/i);
    expect(text).not.toMatch(/mock(?:Repository|Ledger|Wallet)|inMemory(?:Outbox|Ledger|Wallet)/i);
    expect(text).not.toMatch(/(?:wallet|ledger|balance)\.(?:update|create|post|set)/i);
  });
  it("has no generic reconciliation resolve or outbound marketing sender", () => {
    expect(text).not.toMatch(/forceResolve|markResolved|manualConvergence|manualAdjustment/i);
    expect(text).not.toMatch(/(?:sendEmail|sendSms|sendWhatsApp|sendPush|uploadContactList)/i);
  });
  it("keeps production locked without environment or test bypass", () => {
    const readiness = readFileSync(join(root, "lib/promoters/production-readiness.ts"), "utf8");
    expect(readiness).toMatch(/PROMOTERS_PRODUCTION_VALIDATION_APPROVED = false/);
    expect(readiness).not.toMatch(/process\.env|NODE_ENV|testBypass/i);
  });
  it("does not introduce BusinessAccount or Phase 26 recruitment behavior", () => {
    expect(readFileSync(join(root, "prisma/schema.prisma"), "utf8")).not.toMatch(/model\s+BusinessAccount\b/);
    expect(text).not.toMatch(/downline|upline|recruitment.{0,60}commission/i);
  });
});
