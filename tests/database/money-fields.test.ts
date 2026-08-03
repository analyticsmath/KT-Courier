import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");

function modelBlock(modelName: string): string {
  let match = new RegExp(`model\\s+${modelName}\\s+\\{([\\s\\S]*?)\\n\\}`).exec(schema);
  if (!match) {
    match = new RegExp(`model\\s+(?:Legacy|Store)${modelName}\\s+\\{([\\s\\S]*?)\\n\\}`).exec(schema);
  }
  if (!match) throw new Error(`Model not found: ${modelName}`);
  return match[1];
}

function fieldLine(modelName: string, fieldName: string): string {
  const pattern = new RegExp(`^${fieldName}\\s+`);
  const line = modelBlock(modelName)
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find((value) => pattern.test(value));

  if (!line) throw new Error(`Field not found: ${modelName}.${fieldName}`);
  return line;
}

function expectDecimalField(modelName: string, fieldName: string, precision: string): void {
  const line = fieldLine(modelName, fieldName);
  expect(line, `${modelName}.${fieldName} should use Decimal`).toContain("Decimal");
  expect(line, `${modelName}.${fieldName} should use @db.Decimal(${precision})`).toContain(
    `@db.Decimal(${precision})`
  );
  expect(line, `${modelName}.${fieldName} must not use Float`).not.toContain("Float");
}

function expectZarCurrency(modelName: string): void {
  const line = fieldLine(modelName, "currency");
  if (modelName === "WithdrawalRequest" || modelName === "PaymentRefund") {
    expect(line, `${modelName}.currency should use the ledger ZAR enum`).toContain("LedgerCurrency");
    expect(line, `${modelName}.currency should default to ZAR`).toContain("@default(ZAR)");
  } else {
    expect(line, `${modelName}.currency should be a String`).toContain("String");
    expect(line, `${modelName}.currency should default to ZAR`).toContain('@default("ZAR")');
  }
}

describe("Phase 4 money fields", () => {
  it("does not use Float for money-related schema fields", () => {
    expect(schema).not.toMatch(
      /^\s*(amount|price|basePrice|unitPrice|totalPrice|compareAtPrice|discountValue|minOrderAmount|availableBalance|pendingBalance|lockedBalance|balanceBefore|balanceAfter|baseAmount|commissionAmount|value)\s+Float/m
    );
  });

  it("uses Decimal with explicit precision for important money fields", () => {
    const decimalFields: Array<[string, string, string]> = [
      ["Payment", "amount", "18, 2"],
      ["PaymentAttempt", "amount", "18, 2"],
      ["PaymentRefund", "amount", "18, 2"],
      ["Wallet", "availableBalance", "12, 2"],
      ["Wallet", "pendingBalance", "12, 2"],
      ["Wallet", "lockedBalance", "12, 2"],
      ["WalletTransaction", "amount", "12, 2"],
      ["WalletTransaction", "balanceBefore", "12, 2"],
      ["WalletTransaction", "balanceAfter", "12, 2"],
      ["WithdrawalRequest", "amount", "18, 2"],
      ["CommissionRule", "fixedAmount", "18, 2"],
      ["CommissionTransaction", "baseAmount", "12, 2"],
      ["CommissionTransaction", "commissionAmount", "12, 2"],
      ["SubscriptionPlan", "price", "12, 2"],
      ["SubscriptionInvoice", "total", "18, 2"],
      ["Product", "price", "12, 2"],
      ["Product", "compareAtPrice", "12, 2"],
      ["CartItem", "unitPrice", "12, 2"],
      ["OrderItem", "unitPrice", "12, 2"],
      ["OrderItem", "totalPrice", "12, 2"],
      ["Coupon", "discountValue", "12, 2"],
      ["Coupon", "minOrderAmount", "12, 2"],
      ["PromotionRedemption", "discountAmount", "18, 2"],
      ["AdPlacement", "basePrice", "12, 2"],
      ["AdCampaign", "price", "12, 2"],
      ["LedgerAccount", "currentBalance", "18, 2"],
      ["LedgerAccount", "debitTotal", "18, 2"],
      ["LedgerAccount", "creditTotal", "18, 2"],
      ["LedgerJournal", "totalDebits", "18, 2"],
      ["LedgerJournal", "totalCredits", "18, 2"],
      ["LedgerEntry", "amount", "18, 2"],
    ];

    for (const [modelName, fieldName, precision] of decimalFields) {
      expectDecimalField(modelName, fieldName, precision);
    }
  });

  it("defaults key foundation currency fields to ZAR", () => {
    const zarCurrencyModels = [
      "PaymentRefund",
      "Wallet",
      "WalletTransaction",
      "WithdrawalRequest",
      "CommissionTransaction",
      "SubscriptionPlan",
      "SubscriptionInvoice",
      "Product",
      "Cart",
      "CartItem",
      "OrderItem",
      "Coupon",
      "AdPlacement",
      "AdCampaign",
    ];

    for (const modelName of zarCurrencyModels) {
      expectZarCurrency(modelName);
    }
  });

  it("constrains Phase 9 ledger currency to the ZAR enum", () => {
    for (const modelName of ["Payment", "PaymentAttempt", "LedgerAccount", "LedgerJournal"]) {
      expect(fieldLine(modelName, "currency")).toContain("LedgerCurrency");
    }
    expect(schema).toMatch(/enum\s+LedgerCurrency\s+\{\s*ZAR\s*\}/);
  });
});
