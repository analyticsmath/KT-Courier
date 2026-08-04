import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");

function hasModel(name: string): boolean {
  return new RegExp(`\\bmodel\\s+(?:Legacy|Store)?${name}\\s+\\{`).test(schema);
}

function hasEnum(name: string): boolean {
  return new RegExp(`\\benum\\s+(?:Legacy|Store)?${name}\\s+\\{`).test(schema);
}

function modelBlock(name: string): string {
  const match = new RegExp(`model\\s+${name}\\s+\\{([\\s\\S]*?)\\n\\}`).exec(schema);
  if (!match) throw new Error(`Model not found: ${name}`);
  return match[1];
}

describe("Phase 4 foundation schema", () => {
  it("defines the required foundation models", () => {
    const requiredModels = [
      "Payment",
      "PaymentAttempt",
      "PaymentStatusHistory",
      "PaymentWebhookEvent",
      "Wallet",
      "WalletTransaction",
      "LedgerAccount",
      "LedgerJournal",
      "LedgerEntry",
      "WithdrawalRequest",
      "CommissionRule",
      "CommissionTransaction",
      "SubscriptionPlan",
      "StoreSubscription",
      "SubscriptionInvoice",
      "Product",
      "ProductCategory",
      "ProductImage",
      "InventoryItem",
      "Cart",
      "CartItem",
      "OrderItem",
      "Promotion",
      "Coupon",
      "AdPlacement",
      "AdCampaign",
      "PromoterProfile",
      "ReferralCode",
      "ReferralEvent",
      "ApiClient",
      "ApiKey",
      "ApiRequestLog",
      "WebhookEndpoint",
      "WebhookDelivery",
      "Vacancy",
      "RecruitmentApplication",
      "Notification",
      "ReportJob",
    ];

    for (const model of requiredModels) {
      expect(hasModel(model), `${model} model is missing`).toBe(true);
    }
  });

  it("defines the required foundation enums", () => {
    const requiredEnums = [
      "RecordStatus",
      "VerificationStatus",
      "ProcessingStatus",
      "PaymentProvider",
      "PaymentPurpose",
      "PaymentStatus",
      "PaymentAttemptStatus",
      "PaymentProviderFailureCategory",
      "PaymentHistoryActorType",
      "WalletOwnerType",
      "WalletTransactionDirection",
      "WalletTransactionType",
      "WalletTransactionStatus",
      "LedgerCurrency",
      "LedgerAccountPurpose",
      "LedgerAccountCategory",
      "LedgerAccountStatus",
      "LedgerJournalType",
      "LedgerEntryDirection",
      "WithdrawalStatus",
      "CommissionOwnerType",
      "CommissionRuleType",
      "CommissionValueType",
      "CommissionTransactionStatus",
      "SubscriptionPlanCode",
      "SubscriptionStatus",
      "SubscriptionInvoiceStatus",
      "ProductStatus",
      "InventoryChangeType",
      "CartStatus",
      "PromotionStatus",
      "DiscountType",
      "AdPlacementType",
      "AdCampaignStatus",
      "ReferralOwnerType",
      "ReferralTargetType",
      "ReferralStatus",
      "ApiClientStatus",
      "WebhookDeliveryStatus",
      "VacancyStatus",
      "RecruitmentApplicationStatus",
      "NotificationChannel",
      "NotificationStatus",
      "ReportJobStatus",
      "ReportExportFormat",
    ];

    for (const enumName of requiredEnums) {
      expect(hasEnum(enumName), `${enumName} enum is missing`).toBe(true);
    }
  });

  it("extends UserRole with the promoter foundation role", () => {
    expect(schema).toMatch(/\benum\s+UserRole\s+\{[\s\S]*\bPROMOTER\b[\s\S]*\}/);
  });

  it("maps retained withdrawal compatibility columns as ignored Prisma fields", () => {
    const withdrawal = modelBlock("WithdrawalRequest");
    const compatibilityFields = [
      ["legacyReviewedByUserId", "String?", "reviewedByUserId"],
      ["legacyBankName", "String?", "bankName"],
      ["legacyAccountHolder", "String?", "accountHolder"],
      ["legacyAccountLast4", "String?", "accountLast4"],
      ["legacyRejectionReason", "String?", "rejectionReason"],
      ["legacyMetadata", "Json?", "metadata"],
      ["legacyReviewedAt", "DateTime?", "reviewedAt"],
      ["legacyPaidAt", "DateTime?", "paidAt"],
    ];

    for (const [field, type, column] of compatibilityFields) {
      expect(withdrawal).toMatch(new RegExp(`^\\s*${field}\\s+${type.replace("?", "\\?")}\\s+@map\\("${column}"\\)\\s+@ignore\\s*$`, "m"));
    }
    expect(withdrawal.match(/Legacy Phase 4 compatibility column\./g)).toHaveLength(8);
  });
});
