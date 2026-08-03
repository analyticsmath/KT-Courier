import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_ADMIN_PERMISSION_KEYS, SYSTEM_PERMISSION_DEFINITIONS } from "@/lib/auth/permission-keys";
import {
  FOUNDATION_AD_PLACEMENTS,
  FOUNDATION_PLATFORM_WALLET,
  FOUNDATION_PLATFORM_LEDGER_ACCOUNTS,
} from "@/lib/constants/foundation-models";

const root = process.cwd();
const seed = readFileSync(path.join(root, "prisma", "seed.ts"), "utf8");

function isUnique(values: string[]): boolean {
  return new Set(values).size === values.length;
}

describe("seed idempotency contract", () => {
  it("keeps all static upsert keys unique", () => {
    expect(isUnique(SYSTEM_PERMISSION_DEFINITIONS.map((permission) => permission.key))).toBe(true);
    expect(isUnique(DEFAULT_ADMIN_PERMISSION_KEYS)).toBe(true);
    expect(isUnique(FOUNDATION_AD_PLACEMENTS.map((placement) => placement.type))).toBe(true);
    expect(FOUNDATION_PLATFORM_WALLET).toEqual({
      ownerType: "PLATFORM",
      ownerId: "platform",
      currency: "ZAR",
    });
    expect(isUnique(FOUNDATION_PLATFORM_LEDGER_ACCOUNTS.map((account) => account.code))).toBe(true);
    expect(isUnique(FOUNDATION_PLATFORM_LEDGER_ACCOUNTS.map((account) => `${account.purpose}:${account.currency}`))).toBe(true);
  });

  it("uses upserts for contract records and never logs password values", () => {
    expect(seed).toMatch(/prisma\.permission\.upsert/);
    expect(seed).toMatch(/prisma\.rolePermission\.upsert/);
    expect(seed).not.toMatch(/prisma\.subscriptionPlan\.(?:create|createMany|update|updateMany|upsert)/);
    expect(seed).not.toMatch(/prisma\.subscriptionProgram\.(?:create|createMany|update|updateMany|upsert)/);
    expect(seed).toMatch(/prisma\.adPlacement\.upsert/);
    expect(seed).toMatch(/prisma\.wallet\.upsert/);
    expect(seed).toMatch(/prisma\.ledgerAccount\.upsert/);
    expect(seed).not.toMatch(/currentBalance:\s*["']?[1-9]/);
    const loggingExpressions = seed
      .split(/\r?\n/)
      .filter((line) => /console\.(?:log|error)/.test(line))
      .join("\n");
    expect(loggingExpressions).not.toMatch(/DEMO_PASSWORD|passwordHash/);
  });

  it("does not seed a withdrawal or legacy withdrawal banking data", () => {
    expect(seed).not.toMatch(/(?:prisma\.)?withdrawalRequest\.(?:create|createMany|update|updateMany|upsert)/);
    expect(seed).not.toMatch(/bankName\s*:/);
    expect(seed).not.toMatch(/accountHolder\s*:/);
  });
});
