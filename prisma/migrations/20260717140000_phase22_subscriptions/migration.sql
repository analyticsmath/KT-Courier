-- Phase 22: versioned customer and store memberships.
-- Non-destructive compatibility migration. Legacy Phase 4 placeholders are retained under
-- explicit legacy names; no plan, contract, invoice, authority or entitlement
-- data is fabricated by this migration.

ALTER TABLE "SubscriptionPlan" RENAME TO "LegacySubscriptionPlan";
ALTER TABLE "StoreSubscription" RENAME TO "LegacyStoreSubscription";
ALTER TABLE "SubscriptionInvoice" RENAME TO "LegacySubscriptionInvoice";
ALTER INDEX IF EXISTS "SubscriptionPlan_pkey" RENAME TO "LegacySubscriptionPlan_pkey";
ALTER INDEX IF EXISTS "StoreSubscription_pkey" RENAME TO "LegacyStoreSubscription_pkey";
ALTER INDEX IF EXISTS "SubscriptionInvoice_pkey" RENAME TO "LegacySubscriptionInvoice_pkey";
ALTER TYPE "SubscriptionInvoiceStatus" RENAME TO "LegacySubscriptionInvoiceStatus";

CREATE TYPE "SubscriptionProgramSubjectType" AS ENUM ('CUSTOMER', 'STORE');
CREATE TYPE "SubscriptionProgramStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
CREATE TYPE "SubscriptionPlanVersionStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'REJECTED', 'RETIRED');
CREATE TYPE "SubscriptionContractTermType" AS ENUM ('ROLLING_MONTH_TO_MONTH', 'FIXED_TERM');
CREATE TYPE "SubscriptionBillingInterval" AS ENUM ('MONTH');
CREATE TYPE "SubscriptionContractStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PENDING_PROVIDER_AUTHORIZATION', 'PENDING_INITIAL_PAYMENT', 'ACTIVE', 'PAST_DUE', 'GRACE', 'PAUSED', 'CANCELLATION_SCHEDULED', 'CANCELLED', 'EXPIRED', 'SUSPENDED', 'RECONCILIATION_REQUIRED');
CREATE TYPE "SubscriptionPaymentAuthorityMode" AS ENUM ('PROVIDER_MANAGED_SUBSCRIPTION', 'PLATFORM_SCHEDULED_TOKEN');
CREATE TYPE "SubscriptionPaymentAuthorityStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'CANCELLED', 'RECONCILIATION_REQUIRED');
CREATE TYPE "SubscriptionBillingCycleStatus" AS ENUM ('SCHEDULED', 'INVOICE_CREATED', 'PAYMENT_PENDING', 'PAID', 'FAILED', 'GRACE', 'VOID', 'REFUNDED', 'RECONCILIATION_REQUIRED');
CREATE TYPE "SubscriptionInvoiceStatus" AS ENUM ('ISSUED', 'PAID', 'VOID', 'REFUNDED');
CREATE TYPE "SubscriptionRenewalJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAYMENT_PENDING', 'COMPLETED', 'RETRYABLE', 'RECONCILIATION_REQUIRED', 'CANCELLED');
CREATE TYPE "SubscriptionBenefitType" AS ENUM ('DELIVERY_FEE_PERCENT_REDUCTION', 'DELIVERY_FEE_FIXED_REDUCTION', 'DELIVERY_FEE_PERIOD_ALLOWANCE', 'INCLUDED_ELIGIBLE_DELIVERY_COUNT', 'STORE_CATALOG_QUOTA', 'STORE_STAFF_QUOTA', 'STORE_ANALYTICS_ACCESS', 'STORE_SUPPORT_TIER', 'CUSTOMER_SUPPORT_TIER', 'APPROVED_COMMISSION_PLAN_ELIGIBILITY', 'FEATURE_ACCESS');
CREATE TYPE "SubscriptionBenefitValueType" AS ENUM ('PERCENTAGE', 'MONEY', 'QUANTITY', 'BOOLEAN', 'REFERENCE');
CREATE TYPE "SubscriptionBenefitConsumingPhase" AS ENUM ('DELIVERY_QUOTE', 'CHECKOUT_REVIEW', 'MARKETPLACE_ORDER_FINALIZATION', 'STORE_OPERATIONS', 'SUPPORT');
CREATE TYPE "SubscriptionBenefitStackingPolicy" AS ENUM ('NO_PROMOTION_STACKING');
CREATE TYPE "SubscriptionBenefitReversalPolicy" AS ENUM ('RELEASE_UNCONSUMED', 'REVOKE_FUTURE_ONLY', 'RECONCILE_IF_CONSUMED');
CREATE TYPE "SubscriptionEntitlementGrantStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'EXHAUSTED', 'EXPIRED', 'REVOKED', 'RECONCILIATION_REQUIRED');
CREATE TYPE "SubscriptionEntitlementUsageAction" AS ENUM ('RESERVE', 'CONSUME', 'RELEASE', 'REVERSE', 'EXPIRE', 'REVOKE');
CREATE TYPE "SubscriptionEntitlementUsageSourceType" AS ENUM ('PRICING_QUOTE', 'MARKETPLACE_CHECKOUT', 'MARKETPLACE_ORDER', 'STORE_OPERATION', 'REFUND', 'SYSTEM');
CREATE TYPE "SubscriptionReviewStatus" AS ENUM ('CURRENT', 'SUPERSEDED', 'ACKNOWLEDGED', 'EXPIRED');
CREATE TYPE "SubscriptionContractChangeType" AS ENUM ('PLAN_CHANGE', 'PRICE_CHANGE', 'BILLING_INTERVAL_CHANGE', 'BENEFIT_CHANGE', 'PAYER_CHANGE', 'PAYMENT_AUTHORITY_CHANGE', 'PAUSE', 'RESUME');
CREATE TYPE "SubscriptionContractChangeStatus" AS ENUM ('DRAFT', 'PENDING_ACKNOWLEDGEMENT', 'APPROVED', 'SCHEDULED', 'APPLIED', 'CANCELLED', 'RECONCILIATION_REQUIRED');
CREATE TYPE "SubscriptionDunningPolicyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
CREATE TYPE "SubscriptionReconciliationReason" AS ENUM ('PROVIDER_AUTHORITY_MISSING', 'PROVIDER_STATUS_MISMATCH', 'PROVIDER_EVENT_MISSING', 'PROVIDER_EVENT_MISMATCH', 'PROVIDER_TOKEN_MISMATCH', 'INVOICE_PAYMENT_MISMATCH', 'DUPLICATE_BILLING_CYCLE', 'PAYMENT_SUCCEEDED_CONTRACT_INACTIVE', 'CONTRACT_ACTIVE_PAYMENT_MISSING', 'ENTITLEMENT_MISSING', 'ENTITLEMENT_WITHOUT_PAID_CYCLE', 'ENTITLEMENT_USAGE_MISMATCH', 'CANCELLATION_PROVIDER_MISMATCH', 'PAUSE_PROVIDER_MISMATCH', 'RENEWAL_JOB_STALLED', 'DUNNING_STATE_MISMATCH', 'PRICE_CHANGE_MISMATCH', 'REFUND_ENTITLEMENT_MISMATCH', 'APPLICATION_FAILURE');
CREATE TYPE "SubscriptionReconciliationCaseStatus" AS ENUM ('OPEN', 'MONITORING', 'RESOLVED', 'CLOSED');
CREATE TYPE "SubscriptionReconciliationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "SubscriptionEventIntentType" AS ENUM ('SUBSCRIPTION_REVIEWED', 'SUBSCRIPTION_AUTHORIZATION_REQUIRED', 'SUBSCRIPTION_ACTIVATED', 'SUBSCRIPTION_RENEWAL_UPCOMING', 'SUBSCRIPTION_PAYMENT_PENDING', 'SUBSCRIPTION_PAYMENT_FAILED', 'SUBSCRIPTION_GRACE_STARTED', 'SUBSCRIPTION_SUSPENDED', 'SUBSCRIPTION_CANCELLATION_SCHEDULED', 'SUBSCRIPTION_CANCELLED', 'SUBSCRIPTION_FIXED_TERM_EXPIRY_NOTICE', 'SUBSCRIPTION_PRICE_CHANGE_NOTICE', 'SUBSCRIPTION_PLAN_CHANGE_SCHEDULED', 'SUBSCRIPTION_ENTITLEMENT_EXHAUSTED', 'SUBSCRIPTION_RECONCILIATION_REQUIRED');
CREATE TYPE "SubscriptionStoreBillingAuthorityStatus" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE "SubscriptionProgram" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "code" TEXT NOT NULL,
  "subjectType" "SubscriptionProgramSubjectType" NOT NULL, "status" "SubscriptionProgramStatus" NOT NULL DEFAULT 'DRAFT',
  "name" TEXT NOT NULL, "description" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionProgram_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SubscriptionProgram_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "SubscriptionProgram_code_key" UNIQUE ("code")
);

CREATE TABLE "SubscriptionStoreBillingAuthority" (
  "id" TEXT NOT NULL, "storeId" TEXT NOT NULL, "userId" TEXT NOT NULL, "status" "SubscriptionStoreBillingAuthorityStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionStoreBillingAuthority_pkey" PRIMARY KEY ("id"), CONSTRAINT "SubscriptionStoreBillingAuthority_store_user_key" UNIQUE ("storeId", "userId")
);

CREATE TABLE "SubscriptionPlanVersion" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "programId" TEXT NOT NULL, "versionNumber" INTEGER NOT NULL,
  "status" "SubscriptionPlanVersionStatus" NOT NULL DEFAULT 'DRAFT', "displayName" TEXT NOT NULL, "shortDescription" TEXT NOT NULL, "fullDescription" TEXT NOT NULL,
  "contractTermType" "SubscriptionContractTermType" NOT NULL, "billingInterval" "SubscriptionBillingInterval" NOT NULL DEFAULT 'MONTH', "billingIntervalCount" INTEGER NOT NULL DEFAULT 1,
  "minimumTermPeriods" INTEGER, "fixedTermMonths" INTEGER, "currency" TEXT NOT NULL DEFAULT 'ZAR', "priceAmount" DECIMAL(18,2) NOT NULL,
  "taxTreatment" TEXT NOT NULL, "includedTaxAmount" DECIMAL(18,2), "cancellationPolicyVersion" TEXT NOT NULL, "renewalPolicyVersion" TEXT NOT NULL,
  "dunningPolicyVersion" TEXT NOT NULL, "entitlementPolicyVersion" TEXT NOT NULL, "legalDocumentVersion" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3), "effectiveUntil" TIMESTAMP(3), "approvedByUserId" TEXT, "approvedAt" TIMESTAMP(3), "activatedAt" TIMESTAMP(3),
  "retiredAt" TIMESTAMP(3), "rejectedAt" TIMESTAMP(3), "rejectionReason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionPlanVersion_pkey" PRIMARY KEY ("id"), CONSTRAINT "SubscriptionPlanVersion_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "SubscriptionPlanVersion_program_version_key" UNIQUE ("programId", "versionNumber"),
  CONSTRAINT "SubscriptionPlanVersion_terms_check" CHECK ("currency" = 'ZAR' AND "priceAmount" > 0 AND "billingIntervalCount" = 1 AND ("includedTaxAmount" IS NULL OR ("includedTaxAmount" >= 0 AND "includedTaxAmount" <= "priceAmount")) AND ("effectiveUntil" IS NULL OR "effectiveFrom" IS NULL OR "effectiveUntil" > "effectiveFrom") AND ("contractTermType" = 'ROLLING_MONTH_TO_MONTH' OR ("fixedTermMonths" IS NOT NULL AND "fixedTermMonths" > 0)))
);

CREATE TABLE "SubscriptionBenefitDefinition" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "planVersionId" TEXT NOT NULL, "benefitType" "SubscriptionBenefitType" NOT NULL,
  "subjectType" "SubscriptionProgramSubjectType" NOT NULL, "valueType" "SubscriptionBenefitValueType" NOT NULL, "amount" DECIMAL(18,2), "quantity" INTEGER,
  "period" TEXT NOT NULL, "usageCap" INTEGER, "eligibilityConditions" JSONB, "permittedConsumingPhase" "SubscriptionBenefitConsumingPhase" NOT NULL,
  "stackingPolicy" "SubscriptionBenefitStackingPolicy" NOT NULL DEFAULT 'NO_PROMOTION_STACKING', "reversalPolicy" "SubscriptionBenefitReversalPolicy" NOT NULL,
  "sourceVersion" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionBenefitDefinition_pkey" PRIMARY KEY ("id"), CONSTRAINT "SubscriptionBenefitDefinition_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "SubscriptionBenefitDefinition_value_check" CHECK (("amount" IS NULL OR "amount" >= 0) AND ("quantity" IS NULL OR "quantity" >= 0) AND ("usageCap" IS NULL OR "usageCap" > 0))
);

CREATE TABLE "SubscriptionDunningPolicy" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "version" TEXT NOT NULL, "status" "SubscriptionDunningPolicyStatus" NOT NULL DEFAULT 'DRAFT',
  "maximumAttempts" INTEGER NOT NULL, "attemptSpacingHours" INTEGER NOT NULL, "graceDurationHours" INTEGER NOT NULL, "providerRetryEligible" BOOLEAN NOT NULL DEFAULT false,
  "customerUpdateDeadlineHours" INTEGER, "suspensionOutcome" TEXT NOT NULL, "cancellationOutcome" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionDunningPolicy_pkey" PRIMARY KEY ("id"), CONSTRAINT "SubscriptionDunningPolicy_publicReference_key" UNIQUE ("publicReference"), CONSTRAINT "SubscriptionDunningPolicy_version_key" UNIQUE ("version"),
  CONSTRAINT "SubscriptionDunningPolicy_bounds_check" CHECK ("maximumAttempts" > 0 AND "attemptSpacingHours" > 0 AND "graceDurationHours" >= 0 AND ("customerUpdateDeadlineHours" IS NULL OR "customerUpdateDeadlineHours" >= 0))
);

CREATE TABLE "SubscriptionContract" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "programId" TEXT NOT NULL, "planVersionId" TEXT NOT NULL, "subjectType" "SubscriptionProgramSubjectType" NOT NULL,
  "customerUserId" TEXT, "storeId" TEXT, "payerUserId" TEXT NOT NULL, "status" "SubscriptionContractStatus" NOT NULL DEFAULT 'DRAFT', "contractTermType" "SubscriptionContractTermType" NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ZAR', "contractedPrice" DECIMAL(18,2) NOT NULL, "taxTreatment" TEXT NOT NULL, "includedTaxAmount" DECIMAL(18,2),
  "billingInterval" "SubscriptionBillingInterval" NOT NULL DEFAULT 'MONTH', "billingIntervalCount" INTEGER NOT NULL DEFAULT 1,
  "startedAt" TIMESTAMP(3), "currentPeriodStart" TIMESTAMP(3), "currentPeriodEnd" TIMESTAMP(3), "paidThroughAt" TIMESTAMP(3), "fixedTermStart" TIMESTAMP(3), "fixedTermEnd" TIMESTAMP(3),
  "cancellationScheduledAt" TIMESTAMP(3), "cancellationEffectiveAt" TIMESTAMP(3), "cancelledAt" TIMESTAMP(3), "expiredAt" TIMESTAMP(3),
  "commercialFingerprint" TEXT NOT NULL, "termSnapshot" JSONB NOT NULL, "version" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionContract_pkey" PRIMARY KEY ("id"), CONSTRAINT "SubscriptionContract_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "SubscriptionContract_shape_check" CHECK ("currency" = 'ZAR' AND "contractedPrice" > 0 AND "billingIntervalCount" = 1 AND "version" >= 0 AND ("includedTaxAmount" IS NULL OR "includedTaxAmount" >= 0) AND (("subjectType" = 'CUSTOMER' AND "customerUserId" IS NOT NULL AND "storeId" IS NULL AND "payerUserId" = "customerUserId") OR ("subjectType" = 'STORE' AND "storeId" IS NOT NULL AND "customerUserId" IS NULL)) AND (("contractTermType" = 'ROLLING_MONTH_TO_MONTH' AND "fixedTermStart" IS NULL AND "fixedTermEnd" IS NULL) OR ("contractTermType" = 'FIXED_TERM' AND "fixedTermStart" IS NOT NULL AND "fixedTermEnd" IS NOT NULL AND "fixedTermEnd" > "fixedTermStart")) AND ("currentPeriodEnd" IS NULL OR "currentPeriodStart" IS NULL OR "currentPeriodEnd" > "currentPeriodStart") AND ("cancellationEffectiveAt" IS NULL OR "currentPeriodEnd" IS NULL OR "cancellationEffectiveAt" >= "currentPeriodStart"))
);

CREATE TABLE "SubscriptionReview" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "programId" TEXT NOT NULL, "planVersionId" TEXT NOT NULL, "subjectType" "SubscriptionProgramSubjectType" NOT NULL,
  "customerUserId" TEXT, "storeId" TEXT, "payerUserId" TEXT NOT NULL, "reviewVersion" INTEGER NOT NULL, "commercialFingerprint" TEXT NOT NULL,
  "status" "SubscriptionReviewStatus" NOT NULL DEFAULT 'CURRENT', "reviewSnapshot" JSONB NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "subscriptionContractId" TEXT,
  CONSTRAINT "SubscriptionReview_pkey" PRIMARY KEY ("id"), CONSTRAINT "SubscriptionReview_publicReference_key" UNIQUE ("publicReference"), CONSTRAINT "SubscriptionReview_payer_reference_key" UNIQUE ("payerUserId", "publicReference"),
  CONSTRAINT "SubscriptionReview_shape_check" CHECK (("subjectType" = 'CUSTOMER' AND "customerUserId" IS NOT NULL AND "storeId" IS NULL AND "payerUserId" = "customerUserId") OR ("subjectType" = 'STORE' AND "storeId" IS NOT NULL AND "customerUserId" IS NULL))
);

CREATE TABLE "SubscriptionAcknowledgement" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "reviewId" TEXT NOT NULL, "contractId" TEXT, "actorUserId" TEXT NOT NULL, "reviewVersion" INTEGER NOT NULL,
  "commercialFingerprint" TEXT NOT NULL, "serviceStartConsent" BOOLEAN NOT NULL DEFAULT false, "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionAcknowledgement_pkey" PRIMARY KEY ("id"), CONSTRAINT "SubscriptionAcknowledgement_publicReference_key" UNIQUE ("publicReference"), CONSTRAINT "SubscriptionAcknowledgement_review_version_key" UNIQUE ("reviewId", "reviewVersion")
);

CREATE TABLE "SubscriptionPaymentAuthority" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "contractId" TEXT NOT NULL, "provider" "PaymentProvider" NOT NULL, "mode" "SubscriptionPaymentAuthorityMode" NOT NULL,
  "providerCustomerReference" TEXT, "providerSubscriptionReference" TEXT, "providerTokenReferenceEncrypted" TEXT, "status" "SubscriptionPaymentAuthorityStatus" NOT NULL DEFAULT 'PENDING',
  "authorisedAt" TIMESTAMP(3), "pausedAt" TIMESTAMP(3), "cancelledAt" TIMESTAMP(3), "lastSynchronizedAt" TIMESTAMP(3), "version" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionPaymentAuthority_pkey" PRIMARY KEY ("id"), CONSTRAINT "SubscriptionPaymentAuthority_publicReference_key" UNIQUE ("publicReference"), CONSTRAINT "SubscriptionPaymentAuthority_contractId_key" UNIQUE ("contractId"), CONSTRAINT "SubscriptionPaymentAuthority_providerSubscriptionReference_key" UNIQUE ("providerSubscriptionReference"), CONSTRAINT "SubscriptionPaymentAuthority_provider_refs_key" UNIQUE ("provider", "providerCustomerReference", "providerSubscriptionReference"),
  CONSTRAINT "SubscriptionPaymentAuthority_token_check" CHECK ("providerTokenReferenceEncrypted" IS NULL OR length("providerTokenReferenceEncrypted") > 12)
);

CREATE TABLE "SubscriptionBillingCycle" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "contractId" TEXT NOT NULL, "cycleNumber" INTEGER NOT NULL, "periodStart" TIMESTAMP(3) NOT NULL, "periodEnd" TIMESTAMP(3) NOT NULL, "billingDate" TIMESTAMP(3) NOT NULL,
  "status" "SubscriptionBillingCycleStatus" NOT NULL DEFAULT 'SCHEDULED', "currency" TEXT NOT NULL DEFAULT 'ZAR', "amountDue" DECIMAL(18,2) NOT NULL, "amountPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "paidAt" TIMESTAMP(3), "failedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3),
  CONSTRAINT "SubscriptionBillingCycle_pkey" PRIMARY KEY ("id"), CONSTRAINT "SubscriptionBillingCycle_publicReference_key" UNIQUE ("publicReference"), CONSTRAINT "SubscriptionBillingCycle_contract_cycle_key" UNIQUE ("contractId", "cycleNumber"), CONSTRAINT "SubscriptionBillingCycle_contract_period_key" UNIQUE ("contractId", "periodStart", "periodEnd"),
  CONSTRAINT "SubscriptionBillingCycle_amount_check" CHECK ("currency" = 'ZAR' AND "cycleNumber" > 0 AND "periodEnd" > "periodStart" AND "amountDue" > 0 AND "amountPaid" >= 0 AND "amountPaid" <= "amountDue")
);

CREATE TABLE "SubscriptionInvoice" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "contractId" TEXT NOT NULL, "billingCycleId" TEXT NOT NULL, "payerUserId" TEXT NOT NULL, "invoiceNumber" TEXT NOT NULL,
  "status" "SubscriptionInvoiceStatus" NOT NULL DEFAULT 'ISSUED', "currency" TEXT NOT NULL DEFAULT 'ZAR', "subtotal" DECIMAL(18,2) NOT NULL, "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0, "total" DECIMAL(18,2) NOT NULL,
  "planSnapshot" JSONB NOT NULL, "benefitSnapshot" JSONB NOT NULL, "supplierSnapshot" JSONB NOT NULL, "legalDocumentVersion" TEXT NOT NULL, "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "dueAt" TIMESTAMP(3) NOT NULL, "paidAt" TIMESTAMP(3), "voidedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionInvoice_pkey" PRIMARY KEY ("id"), CONSTRAINT "SubscriptionInvoice_publicReference_key" UNIQUE ("publicReference"), CONSTRAINT "SubscriptionInvoice_billingCycleId_key" UNIQUE ("billingCycleId"), CONSTRAINT "SubscriptionInvoice_invoiceNumber_key" UNIQUE ("invoiceNumber"),
  CONSTRAINT "SubscriptionInvoice_total_check" CHECK ("currency" = 'ZAR' AND "subtotal" >= 0 AND "taxAmount" >= 0 AND "total" = "subtotal" + "taxAmount" AND "dueAt" >= "issuedAt")
);

CREATE TABLE "SubscriptionRenewalJob" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "contractId" TEXT NOT NULL, "billingCycleId" TEXT NOT NULL, "status" "SubscriptionRenewalJobStatus" NOT NULL DEFAULT 'PENDING',
  "operationId" TEXT NOT NULL, "requestHash" TEXT NOT NULL, "attemptCount" INTEGER NOT NULL DEFAULT 0, "nextAttemptAt" TIMESTAMP(3) NOT NULL, "lastSafeError" TEXT, "completedAt" TIMESTAMP(3), "reconciliationCaseId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionRenewalJob_pkey" PRIMARY KEY ("id"), CONSTRAINT "SubscriptionRenewalJob_publicReference_key" UNIQUE ("publicReference"), CONSTRAINT "SubscriptionRenewalJob_billingCycleId_key" UNIQUE ("billingCycleId"), CONSTRAINT "SubscriptionRenewalJob_operationId_key" UNIQUE ("operationId"), CONSTRAINT "SubscriptionRenewalJob_reconciliationCaseId_key" UNIQUE ("reconciliationCaseId"),
  CONSTRAINT "SubscriptionRenewalJob_attempt_check" CHECK ("attemptCount" >= 0 AND (("status" = 'COMPLETED') = ("completedAt" IS NOT NULL)))
);

CREATE TABLE "SubscriptionEntitlementGrant" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "contractId" TEXT NOT NULL, "billingCycleId" TEXT NOT NULL, "benefitDefinitionId" TEXT NOT NULL, "subjectType" "SubscriptionProgramSubjectType" NOT NULL,
  "customerUserId" TEXT, "storeId" TEXT, "status" "SubscriptionEntitlementGrantStatus" NOT NULL DEFAULT 'SCHEDULED', "valueType" "SubscriptionBenefitValueType" NOT NULL,
  "originalAmount" DECIMAL(18,2), "remainingAmount" DECIMAL(18,2), "originalQuantity" INTEGER, "remainingQuantity" INTEGER, "effectiveFrom" TIMESTAMP(3) NOT NULL, "effectiveUntil" TIMESTAMP(3) NOT NULL, "sourceVersion" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "exhaustedAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3),
  CONSTRAINT "SubscriptionEntitlementGrant_pkey" PRIMARY KEY ("id"), CONSTRAINT "SubscriptionEntitlementGrant_publicReference_key" UNIQUE ("publicReference"), CONSTRAINT "SubscriptionEntitlementGrant_cycle_benefit_key" UNIQUE ("billingCycleId", "benefitDefinitionId"),
  CONSTRAINT "SubscriptionEntitlementGrant_shape_check" CHECK ((("subjectType" = 'CUSTOMER' AND "customerUserId" IS NOT NULL AND "storeId" IS NULL) OR ("subjectType" = 'STORE' AND "storeId" IS NOT NULL AND "customerUserId" IS NULL)) AND "effectiveUntil" > "effectiveFrom" AND ("originalAmount" IS NULL OR ("originalAmount" >= 0 AND "remainingAmount" >= 0 AND "remainingAmount" <= "originalAmount")) AND ("originalQuantity" IS NULL OR ("originalQuantity" >= 0 AND "remainingQuantity" >= 0 AND "remainingQuantity" <= "originalQuantity")))
);

CREATE TABLE "SubscriptionEntitlementUsage" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "grantId" TEXT NOT NULL, "operationId" TEXT NOT NULL, "requestHash" TEXT NOT NULL, "action" "SubscriptionEntitlementUsageAction" NOT NULL,
  "amount" DECIMAL(18,2), "quantity" INTEGER, "sourceType" "SubscriptionEntitlementUsageSourceType" NOT NULL, "sourceReference" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionEntitlementUsage_pkey" PRIMARY KEY ("id"), CONSTRAINT "SubscriptionEntitlementUsage_publicReference_key" UNIQUE ("publicReference"), CONSTRAINT "SubscriptionEntitlementUsage_grant_operation_action_key" UNIQUE ("grantId", "operationId", "action"),
  CONSTRAINT "SubscriptionEntitlementUsage_value_check" CHECK (("amount" IS NULL OR "amount" >= 0) AND ("quantity" IS NULL OR "quantity" >= 0) AND ("amount" IS NOT NULL OR "quantity" IS NOT NULL OR "action" IN ('EXPIRE', 'REVOKE')))
);

CREATE TABLE "SubscriptionContractChange" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "contractId" TEXT NOT NULL, "changeType" "SubscriptionContractChangeType" NOT NULL, "status" "SubscriptionContractChangeStatus" NOT NULL DEFAULT 'DRAFT', "sourceContractVersion" INTEGER NOT NULL, "targetPlanVersionId" TEXT, "effectiveAt" TIMESTAMP(3) NOT NULL, "commercialFingerprint" TEXT NOT NULL, "customerAcknowledgedAt" TIMESTAMP(3), "appliedAt" TIMESTAMP(3), "cancelledAt" TIMESTAMP(3), "operationId" TEXT NOT NULL, "requestHash" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionContractChange_pkey" PRIMARY KEY ("id"), CONSTRAINT "SubscriptionContractChange_publicReference_key" UNIQUE ("publicReference"), CONSTRAINT "SubscriptionContractChange_contract_operation_key" UNIQUE ("contractId", "operationId")
);

CREATE TABLE "SubscriptionPlanVersionStatusHistory" (
  "id" TEXT NOT NULL, "planVersionId" TEXT NOT NULL, "fromStatus" "SubscriptionPlanVersionStatus", "toStatus" "SubscriptionPlanVersionStatus" NOT NULL, "reasonCode" TEXT, "actorUserId" TEXT, "operationId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionPlanVersionStatusHistory_pkey" PRIMARY KEY ("id"), CONSTRAINT "SubscriptionPlanVersionStatusHistory_plan_operation_key" UNIQUE ("planVersionId", "operationId")
);

CREATE TABLE "SubscriptionContractStatusHistory" (
  "id" TEXT NOT NULL, "contractId" TEXT NOT NULL, "fromStatus" "SubscriptionContractStatus", "toStatus" "SubscriptionContractStatus" NOT NULL, "reasonCode" TEXT, "actorType" TEXT NOT NULL, "actorUserId" TEXT, "operationId" TEXT NOT NULL, "safeMetadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionContractStatusHistory_pkey" PRIMARY KEY ("id"), CONSTRAINT "SubscriptionContractStatusHistory_contract_operation_key" UNIQUE ("contractId", "operationId")
);

CREATE TABLE "SubscriptionCancellationNotice" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "contractId" TEXT NOT NULL, "requestType" TEXT NOT NULL, "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "proposedEffectiveAt" TIMESTAMP(3), "legalPolicyVersion" TEXT NOT NULL, "safeEvidence" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionCancellationNotice_pkey" PRIMARY KEY ("id"), CONSTRAINT "SubscriptionCancellationNotice_publicReference_key" UNIQUE ("publicReference")
);

CREATE TABLE "SubscriptionReconciliationCase" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "caseKey" TEXT NOT NULL, "contractId" TEXT, "billingCycleId" TEXT, "invoiceId" TEXT, "paymentId" TEXT, "entitlementGrantId" TEXT, "providerAuthorityId" TEXT, "reason" "SubscriptionReconciliationReason" NOT NULL, "status" "SubscriptionReconciliationCaseStatus" NOT NULL DEFAULT 'OPEN', "priority" "SubscriptionReconciliationPriority" NOT NULL DEFAULT 'MEDIUM', "safeSummary" TEXT NOT NULL, "safeEvidence" JSONB, "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "resolvedAt" TIMESTAMP(3), "resolutionCode" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionReconciliationCase_pkey" PRIMARY KEY ("id"), CONSTRAINT "SubscriptionReconciliationCase_publicReference_key" UNIQUE ("publicReference"), CONSTRAINT "SubscriptionReconciliationCase_caseKey_key" UNIQUE ("caseKey")
);

CREATE TABLE "SubscriptionEventIntent" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "contractId" TEXT NOT NULL, "type" "SubscriptionEventIntentType" NOT NULL, "operationId" TEXT NOT NULL, "safePayload" JSONB, "publishedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionEventIntent_pkey" PRIMARY KEY ("id"), CONSTRAINT "SubscriptionEventIntent_publicReference_key" UNIQUE ("publicReference"), CONSTRAINT "SubscriptionEventIntent_contract_type_operation_key" UNIQUE ("contractId", "type", "operationId")
);

-- Payment stays the single aggregate. Extend its existing Phase 20 guard only.
ALTER TYPE "PaymentSubjectType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_INVOICE';
ALTER TABLE "Payment" ADD COLUMN "subscriptionInvoiceId" TEXT;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionInvoiceId_key" UNIQUE ("subscriptionInvoiceId");
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_subject_shape_check";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subject_shape_check" CHECK (
  ("subjectType" = 'COURIER_ORDER' AND "orderId" IS NOT NULL AND "userId" IS NOT NULL AND "marketplaceCheckoutId" IS NULL AND "marketplaceOrderId" IS NULL AND "subscriptionInvoiceId" IS NULL) OR
  ("subjectType" = 'MARKETPLACE_CHECKOUT' AND "orderId" IS NULL AND "marketplaceCheckoutId" IS NOT NULL AND "subscriptionInvoiceId" IS NULL) OR
  ("subjectType" = 'SUBSCRIPTION_INVOICE' AND "orderId" IS NULL AND "marketplaceCheckoutId" IS NULL AND "marketplaceOrderId" IS NULL AND "subscriptionInvoiceId" IS NOT NULL AND "userId" IS NOT NULL)
);

CREATE OR REPLACE FUNCTION "MarketplaceCheckout_payment_subject_guard"() RETURNS TRIGGER AS $$
DECLARE checkout_customer_id TEXT; checkout_guest_hash TEXT; order_checkout_id TEXT; invoice_payer_id TEXT;
BEGIN
  IF NEW."subjectType" = 'COURIER_ORDER' THEN
    IF NEW."orderId" IS NULL OR NEW."userId" IS NULL OR NEW."marketplaceCheckoutId" IS NOT NULL OR NEW."marketplaceOrderId" IS NOT NULL OR NEW."subscriptionInvoiceId" IS NOT NULL THEN RAISE EXCEPTION 'Courier payments require exactly one courier order and payer'; END IF;
    RETURN NEW;
  END IF;
  IF NEW."subjectType" = 'SUBSCRIPTION_INVOICE' THEN
    IF NEW."orderId" IS NOT NULL OR NEW."marketplaceCheckoutId" IS NOT NULL OR NEW."marketplaceOrderId" IS NOT NULL OR NEW."subscriptionInvoiceId" IS NULL OR NEW."userId" IS NULL THEN RAISE EXCEPTION 'Subscription payments require exactly one invoice and payer'; END IF;
    SELECT "payerUserId" INTO invoice_payer_id FROM "SubscriptionInvoice" WHERE "id" = NEW."subscriptionInvoiceId";
    IF invoice_payer_id IS DISTINCT FROM NEW."userId" THEN RAISE EXCEPTION 'Subscription payment payer does not match invoice payer'; END IF;
    RETURN NEW;
  END IF;
  IF NEW."orderId" IS NOT NULL OR NEW."marketplaceCheckoutId" IS NULL OR NEW."subscriptionInvoiceId" IS NOT NULL THEN RAISE EXCEPTION 'Marketplace payments require exactly one marketplace checkout'; END IF;
  SELECT "customerUserId", "guestAccessTokenHash" INTO checkout_customer_id, checkout_guest_hash FROM "MarketplaceCheckout" WHERE "id" = NEW."marketplaceCheckoutId";
  IF checkout_customer_id IS NULL AND checkout_guest_hash IS NULL THEN RAISE EXCEPTION 'Guest marketplace payment lacks checkout ownership evidence'; END IF;
  IF checkout_customer_id IS NOT NULL AND NEW."userId" IS DISTINCT FROM checkout_customer_id THEN RAISE EXCEPTION 'Marketplace payment payer does not match checkout customer'; END IF;
  IF checkout_customer_id IS NULL AND NEW."userId" IS NOT NULL THEN RAISE EXCEPTION 'Guest marketplace payment cannot claim payer'; END IF;
  IF NEW."marketplaceOrderId" IS NOT NULL THEN SELECT "checkoutId" INTO order_checkout_id FROM "MarketplaceOrder" WHERE "id" = NEW."marketplaceOrderId"; IF order_checkout_id IS DISTINCT FROM NEW."marketplaceCheckoutId" THEN RAISE EXCEPTION 'Marketplace payment order belongs to another checkout'; END IF; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- Freeze accepted terms and active plan versions; runtime services append history
-- rather than deleting or rewriting contractual evidence.
CREATE OR REPLACE FUNCTION "SubscriptionPlanVersion_immutable"() RETURNS TRIGGER AS $$
BEGIN
  IF OLD."status" = 'ACTIVE' AND NEW."status" NOT IN ('ACTIVE', 'RETIRED') THEN RAISE EXCEPTION 'Active subscription plan versions may only retire'; END IF;
  IF OLD."status" IN ('ACTIVE', 'RETIRED') AND (to_jsonb(NEW) - 'updatedAt' - 'retiredAt' - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'updatedAt' - 'retiredAt' - 'status') THEN RAISE EXCEPTION 'Active or retired subscription plan versions are immutable'; END IF;
  IF OLD."status" = 'REJECTED' AND NEW."status" = 'ACTIVE' THEN RAISE EXCEPTION 'Rejected subscription plan cannot activate'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION "SubscriptionContract_snapshot_immutable"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."termSnapshot" IS DISTINCT FROM OLD."termSnapshot" OR NEW."commercialFingerprint" IS DISTINCT FROM OLD."commercialFingerprint" OR NEW."contractedPrice" IS DISTINCT FROM OLD."contractedPrice" OR NEW."currency" IS DISTINCT FROM OLD."currency" OR NEW."planVersionId" IS DISTINCT FROM OLD."planVersionId" THEN RAISE EXCEPTION 'Subscription contract terms are immutable'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION "Subscription_evidence_no_delete"() RETURNS TRIGGER AS $$ BEGIN RAISE EXCEPTION 'Subscription contractual evidence is append-only'; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER "SubscriptionPlanVersion_immutable" BEFORE UPDATE ON "SubscriptionPlanVersion" FOR EACH ROW EXECUTE FUNCTION "SubscriptionPlanVersion_immutable"();
CREATE TRIGGER "SubscriptionContract_snapshot_immutable" BEFORE UPDATE ON "SubscriptionContract" FOR EACH ROW EXECUTE FUNCTION "SubscriptionContract_snapshot_immutable"();
CREATE TRIGGER "SubscriptionContract_no_delete" BEFORE DELETE ON "SubscriptionContract" FOR EACH ROW EXECUTE FUNCTION "Subscription_evidence_no_delete"();
CREATE TRIGGER "SubscriptionBillingCycle_no_delete" BEFORE DELETE ON "SubscriptionBillingCycle" FOR EACH ROW EXECUTE FUNCTION "Subscription_evidence_no_delete"();
CREATE TRIGGER "SubscriptionInvoice_no_delete" BEFORE DELETE ON "SubscriptionInvoice" FOR EACH ROW EXECUTE FUNCTION "Subscription_evidence_no_delete"();
CREATE TRIGGER "SubscriptionEntitlementUsage_no_update" BEFORE UPDATE OR DELETE ON "SubscriptionEntitlementUsage" FOR EACH ROW EXECUTE FUNCTION "Subscription_evidence_no_delete"();

CREATE UNIQUE INDEX "SubscriptionPlanVersion_one_active_per_program" ON "SubscriptionPlanVersion" ("programId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "SubscriptionContract_one_live_customer_program" ON "SubscriptionContract" ("programId", "customerUserId") WHERE "customerUserId" IS NOT NULL AND "status" NOT IN ('CANCELLED', 'EXPIRED');
CREATE UNIQUE INDEX "SubscriptionContract_one_live_store_program" ON "SubscriptionContract" ("programId", "storeId") WHERE "storeId" IS NOT NULL AND "status" NOT IN ('CANCELLED', 'EXPIRED');
CREATE INDEX "SubscriptionProgram_subject_status_idx" ON "SubscriptionProgram"("subjectType", "status");
CREATE INDEX "SubscriptionStoreBillingAuthority_user_status_idx" ON "SubscriptionStoreBillingAuthority"("userId", "status");
CREATE INDEX "SubscriptionPlanVersion_program_status_effective_idx" ON "SubscriptionPlanVersion"("programId", "status", "effectiveFrom");
CREATE INDEX "SubscriptionContract_customer_status_idx" ON "SubscriptionContract"("customerUserId", "status");
CREATE INDEX "SubscriptionContract_store_status_idx" ON "SubscriptionContract"("storeId", "status");
CREATE INDEX "SubscriptionBillingCycle_status_billingDate_idx" ON "SubscriptionBillingCycle"("status", "billingDate");
CREATE INDEX "SubscriptionRenewalJob_status_nextAttemptAt_idx" ON "SubscriptionRenewalJob"("status", "nextAttemptAt");
CREATE INDEX "SubscriptionEntitlementGrant_customer_status_effectiveUntil_idx" ON "SubscriptionEntitlementGrant"("customerUserId", "status", "effectiveUntil");
CREATE INDEX "SubscriptionEntitlementGrant_store_status_effectiveUntil_idx" ON "SubscriptionEntitlementGrant"("storeId", "status", "effectiveUntil");
CREATE INDEX "SubscriptionReconciliationCase_status_priority_lastObservedAt_idx" ON "SubscriptionReconciliationCase"("status", "priority", "lastObservedAt");
CREATE INDEX "Payment_subjectType_subscriptionInvoiceId_idx" ON "Payment"("subjectType", "subscriptionInvoiceId");

ALTER TABLE "SubscriptionPlanVersion" ADD CONSTRAINT "SubscriptionPlanVersion_program_fkey" FOREIGN KEY ("programId") REFERENCES "SubscriptionProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionStoreBillingAuthority" ADD CONSTRAINT "SubscriptionStoreBillingAuthority_store_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionStoreBillingAuthority" ADD CONSTRAINT "SubscriptionStoreBillingAuthority_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPlanVersion" ADD CONSTRAINT "SubscriptionPlanVersion_approvedBy_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionBenefitDefinition" ADD CONSTRAINT "SubscriptionBenefitDefinition_plan_fkey" FOREIGN KEY ("planVersionId") REFERENCES "SubscriptionPlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionContract" ADD CONSTRAINT "SubscriptionContract_program_fkey" FOREIGN KEY ("programId") REFERENCES "SubscriptionProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionContract" ADD CONSTRAINT "SubscriptionContract_plan_fkey" FOREIGN KEY ("planVersionId") REFERENCES "SubscriptionPlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionContract" ADD CONSTRAINT "SubscriptionContract_customer_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionContract" ADD CONSTRAINT "SubscriptionContract_store_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionContract" ADD CONSTRAINT "SubscriptionContract_payer_fkey" FOREIGN KEY ("payerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionReview" ADD CONSTRAINT "SubscriptionReview_customer_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionReview" ADD CONSTRAINT "SubscriptionReview_store_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionReview" ADD CONSTRAINT "SubscriptionReview_contract_fkey" FOREIGN KEY ("subscriptionContractId") REFERENCES "SubscriptionContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionAcknowledgement" ADD CONSTRAINT "SubscriptionAcknowledgement_review_fkey" FOREIGN KEY ("reviewId") REFERENCES "SubscriptionReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionAcknowledgement" ADD CONSTRAINT "SubscriptionAcknowledgement_contract_fkey" FOREIGN KEY ("contractId") REFERENCES "SubscriptionContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionAcknowledgement" ADD CONSTRAINT "SubscriptionAcknowledgement_actor_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPaymentAuthority" ADD CONSTRAINT "SubscriptionPaymentAuthority_contract_fkey" FOREIGN KEY ("contractId") REFERENCES "SubscriptionContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionBillingCycle" ADD CONSTRAINT "SubscriptionBillingCycle_contract_fkey" FOREIGN KEY ("contractId") REFERENCES "SubscriptionContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_contract_fkey" FOREIGN KEY ("contractId") REFERENCES "SubscriptionContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_cycle_fkey" FOREIGN KEY ("billingCycleId") REFERENCES "SubscriptionBillingCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_payer_fkey" FOREIGN KEY ("payerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionInvoice_fkey" FOREIGN KEY ("subscriptionInvoiceId") REFERENCES "SubscriptionInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionRenewalJob" ADD CONSTRAINT "SubscriptionRenewalJob_contract_fkey" FOREIGN KEY ("contractId") REFERENCES "SubscriptionContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionRenewalJob" ADD CONSTRAINT "SubscriptionRenewalJob_cycle_fkey" FOREIGN KEY ("billingCycleId") REFERENCES "SubscriptionBillingCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionEntitlementGrant" ADD CONSTRAINT "SubscriptionEntitlementGrant_contract_fkey" FOREIGN KEY ("contractId") REFERENCES "SubscriptionContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionEntitlementGrant" ADD CONSTRAINT "SubscriptionEntitlementGrant_cycle_fkey" FOREIGN KEY ("billingCycleId") REFERENCES "SubscriptionBillingCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionEntitlementGrant" ADD CONSTRAINT "SubscriptionEntitlementGrant_benefit_fkey" FOREIGN KEY ("benefitDefinitionId") REFERENCES "SubscriptionBenefitDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionEntitlementGrant" ADD CONSTRAINT "SubscriptionEntitlementGrant_customer_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionEntitlementGrant" ADD CONSTRAINT "SubscriptionEntitlementGrant_store_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionEntitlementUsage" ADD CONSTRAINT "SubscriptionEntitlementUsage_grant_fkey" FOREIGN KEY ("grantId") REFERENCES "SubscriptionEntitlementGrant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionContractChange" ADD CONSTRAINT "SubscriptionContractChange_contract_fkey" FOREIGN KEY ("contractId") REFERENCES "SubscriptionContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionContractChange" ADD CONSTRAINT "SubscriptionContractChange_plan_fkey" FOREIGN KEY ("targetPlanVersionId") REFERENCES "SubscriptionPlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPlanVersionStatusHistory" ADD CONSTRAINT "SubscriptionPlanVersionStatusHistory_plan_fkey" FOREIGN KEY ("planVersionId") REFERENCES "SubscriptionPlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionContractStatusHistory" ADD CONSTRAINT "SubscriptionContractStatusHistory_contract_fkey" FOREIGN KEY ("contractId") REFERENCES "SubscriptionContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionCancellationNotice" ADD CONSTRAINT "SubscriptionCancellationNotice_contract_fkey" FOREIGN KEY ("contractId") REFERENCES "SubscriptionContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionReconciliationCase" ADD CONSTRAINT "SubscriptionReconciliationCase_contract_fkey" FOREIGN KEY ("contractId") REFERENCES "SubscriptionContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionReconciliationCase" ADD CONSTRAINT "SubscriptionReconciliationCase_cycle_fkey" FOREIGN KEY ("billingCycleId") REFERENCES "SubscriptionBillingCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionReconciliationCase" ADD CONSTRAINT "SubscriptionReconciliationCase_invoice_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SubscriptionInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionReconciliationCase" ADD CONSTRAINT "SubscriptionReconciliationCase_payment_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionReconciliationCase" ADD CONSTRAINT "SubscriptionReconciliationCase_grant_fkey" FOREIGN KEY ("entitlementGrantId") REFERENCES "SubscriptionEntitlementGrant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionReconciliationCase" ADD CONSTRAINT "SubscriptionReconciliationCase_authority_fkey" FOREIGN KEY ("providerAuthorityId") REFERENCES "SubscriptionPaymentAuthority"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionRenewalJob" ADD CONSTRAINT "SubscriptionRenewalJob_reconciliation_fkey" FOREIGN KEY ("reconciliationCaseId") REFERENCES "SubscriptionReconciliationCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionEventIntent" ADD CONSTRAINT "SubscriptionEventIntent_contract_fkey" FOREIGN KEY ("contractId") REFERENCES "SubscriptionContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Phase 22 correction: subscription settlement and daily revenue recognition.
-- This extends only the unapplied Phase 22 migration; it does not alter a
-- prior phase migration or move any legacy data.
ALTER TYPE "LedgerAccountPurpose" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_DEFERRED_REVENUE';
ALTER TYPE "LedgerAccountPurpose" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_TAX_PAYABLE';
ALTER TYPE "LedgerJournalType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_INVOICE_SETTLEMENT';
ALTER TYPE "LedgerJournalType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_REVENUE_RECOGNITION';
ALTER TYPE "LedgerJournalType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_REFUND_REVERSAL';
CREATE TYPE "SubscriptionInvoiceSettlementStatus" AS ENUM ('SETTLED', 'RECONCILIATION_REQUIRED', 'REVERSED');
CREATE TYPE "SubscriptionRevenueRecognitionScheduleStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'REVERSED', 'RECONCILIATION_REQUIRED');

ALTER TABLE "SubscriptionPaymentAuthority" ADD COLUMN "providerTokenFingerprint" TEXT;
ALTER TABLE "SubscriptionPaymentAuthority" ADD COLUMN "providerTokenRotatedAt" TIMESTAMP(3);
ALTER TABLE "SubscriptionPaymentAuthority" ADD CONSTRAINT "SubscriptionPaymentAuthority_providerTokenFingerprint_key" UNIQUE ("providerTokenFingerprint");

CREATE TABLE "SubscriptionInvoiceSettlement" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "invoiceId" TEXT NOT NULL, "billingCycleId" TEXT NOT NULL, "paymentId" TEXT NOT NULL,
  "status" "SubscriptionInvoiceSettlementStatus" NOT NULL DEFAULT 'SETTLED', "currency" TEXT NOT NULL DEFAULT 'ZAR',
  "settledAmount" DECIMAL(18,2) NOT NULL, "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0, "netAmount" DECIMAL(18,2) NOT NULL,
  "ledgerJournalId" TEXT NOT NULL, "operationId" TEXT NOT NULL, "safeEvidence" JSONB NOT NULL, "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionInvoiceSettlement_pkey" PRIMARY KEY ("id"), CONSTRAINT "SubscriptionInvoiceSettlement_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "SubscriptionInvoiceSettlement_invoiceId_key" UNIQUE ("invoiceId"), CONSTRAINT "SubscriptionInvoiceSettlement_billingCycleId_key" UNIQUE ("billingCycleId"), CONSTRAINT "SubscriptionInvoiceSettlement_paymentId_key" UNIQUE ("paymentId"),
  CONSTRAINT "SubscriptionInvoiceSettlement_ledgerJournalId_key" UNIQUE ("ledgerJournalId"), CONSTRAINT "SubscriptionInvoiceSettlement_operationId_key" UNIQUE ("operationId"),
  CONSTRAINT "SubscriptionInvoiceSettlement_amount_check" CHECK ("currency" = 'ZAR' AND "settledAmount" > 0 AND "taxAmount" >= 0 AND "netAmount" > 0 AND "settledAmount" = "netAmount" + "taxAmount")
);
CREATE TABLE "SubscriptionRevenueRecognitionSchedule" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "invoiceId" TEXT NOT NULL, "billingCycleId" TEXT NOT NULL, "currency" TEXT NOT NULL DEFAULT 'ZAR',
  "netAmount" DECIMAL(18,2) NOT NULL, "recognizedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0, "serviceStart" TIMESTAMP(3) NOT NULL, "serviceEnd" TIMESTAMP(3) NOT NULL,
  "status" "SubscriptionRevenueRecognitionScheduleStatus" NOT NULL DEFAULT 'ACTIVE', "policyVersion" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionRevenueRecognitionSchedule_pkey" PRIMARY KEY ("id"), CONSTRAINT "SubscriptionRevenueRecognitionSchedule_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "SubscriptionRevenueRecognitionSchedule_invoiceId_key" UNIQUE ("invoiceId"), CONSTRAINT "SubscriptionRevenueRecognitionSchedule_billingCycleId_key" UNIQUE ("billingCycleId"),
  CONSTRAINT "SubscriptionRevenueRecognitionSchedule_amount_check" CHECK ("currency" = 'ZAR' AND "netAmount" > 0 AND "recognizedAmount" >= 0 AND "recognizedAmount" <= "netAmount" AND "serviceEnd" > "serviceStart")
);
CREATE TABLE "SubscriptionRevenueRecognitionEntry" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "scheduleId" TEXT NOT NULL, "recognitionDate" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL, "cumulativeAmount" DECIMAL(18,2) NOT NULL, "ledgerJournalId" TEXT NOT NULL, "operationId" TEXT NOT NULL, "safeEvidence" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionRevenueRecognitionEntry_pkey" PRIMARY KEY ("id"), CONSTRAINT "SubscriptionRevenueRecognitionEntry_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "SubscriptionRevenueRecognitionEntry_ledgerJournalId_key" UNIQUE ("ledgerJournalId"), CONSTRAINT "SubscriptionRevenueRecognitionEntry_operationId_key" UNIQUE ("operationId"), CONSTRAINT "SubscriptionRevenueRecognitionEntry_scheduleId_recognitionDate_key" UNIQUE ("scheduleId", "recognitionDate"),
  CONSTRAINT "SubscriptionRevenueRecognitionEntry_amount_check" CHECK ("amount" > 0 AND "cumulativeAmount" > 0)
);
CREATE INDEX "SubscriptionInvoiceSettlement_status_settledAt_idx" ON "SubscriptionInvoiceSettlement"("status", "settledAt");
CREATE INDEX "SubscriptionRevenueRecognitionSchedule_status_serviceEnd_idx" ON "SubscriptionRevenueRecognitionSchedule"("status", "serviceEnd");
CREATE INDEX "SubscriptionRevenueRecognitionEntry_schedule_recognitionDate_idx" ON "SubscriptionRevenueRecognitionEntry"("scheduleId", "recognitionDate");
ALTER TABLE "SubscriptionInvoiceSettlement" ADD CONSTRAINT "SubscriptionInvoiceSettlement_invoice_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SubscriptionInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionInvoiceSettlement" ADD CONSTRAINT "SubscriptionInvoiceSettlement_cycle_fkey" FOREIGN KEY ("billingCycleId") REFERENCES "SubscriptionBillingCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionInvoiceSettlement" ADD CONSTRAINT "SubscriptionInvoiceSettlement_payment_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionInvoiceSettlement" ADD CONSTRAINT "SubscriptionInvoiceSettlement_journal_fkey" FOREIGN KEY ("ledgerJournalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionRevenueRecognitionSchedule" ADD CONSTRAINT "SubscriptionRevenueRecognitionSchedule_invoice_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SubscriptionInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionRevenueRecognitionSchedule" ADD CONSTRAINT "SubscriptionRevenueRecognitionSchedule_cycle_fkey" FOREIGN KEY ("billingCycleId") REFERENCES "SubscriptionBillingCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionRevenueRecognitionEntry" ADD CONSTRAINT "SubscriptionRevenueRecognitionEntry_schedule_fkey" FOREIGN KEY ("scheduleId") REFERENCES "SubscriptionRevenueRecognitionSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionRevenueRecognitionEntry" ADD CONSTRAINT "SubscriptionRevenueRecognitionEntry_journal_fkey" FOREIGN KEY ("ledgerJournalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Final Phase 22 lifecycle composition. This remains additive within the
-- unapplied Phase 22 migration and preserves all legacy compatibility tables.
CREATE TABLE "SubscriptionOperationReceipt" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "contractId" TEXT NOT NULL, "operationId" TEXT NOT NULL,
  "operationType" TEXT NOT NULL, "requestHash" TEXT NOT NULL, "outcome" TEXT NOT NULL, "safeEvidence" JSONB,
  "completedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionOperationReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SubscriptionOperationReceipt_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "SubscriptionOperationReceipt_operationId_key" UNIQUE ("operationId")
);
CREATE INDEX "SubscriptionOperationReceipt_contract_operation_created_idx" ON "SubscriptionOperationReceipt"("contractId", "operationType", "createdAt");

CREATE TABLE "SubscriptionProviderSynchronizationEvidence" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "contractId" TEXT NOT NULL, "providerAuthorityId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL, "observedStatus" TEXT NOT NULL, "internalStatus" TEXT NOT NULL, "safeEvidence" JSONB NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionProviderSynchronizationEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SubscriptionProviderSynchronizationEvidence_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "SubscriptionProviderSynchronizationEvidence_operationId_key" UNIQUE ("operationId")
);
CREATE INDEX "SubscriptionProviderSynchronizationEvidence_authority_observed_idx" ON "SubscriptionProviderSynchronizationEvidence"("providerAuthorityId", "observedAt");

CREATE TABLE "SubscriptionRefundAdjustment" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "contractId" TEXT NOT NULL, "invoiceId" TEXT NOT NULL, "billingCycleId" TEXT NOT NULL,
  "refundId" TEXT NOT NULL, "operationId" TEXT NOT NULL, "deferredAmount" DECIMAL(18,2) NOT NULL, "recognizedAmount" DECIMAL(18,2) NOT NULL,
  "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0, "ledgerJournalId" TEXT, "safeEvidence" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionRefundAdjustment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SubscriptionRefundAdjustment_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "SubscriptionRefundAdjustment_operationId_key" UNIQUE ("operationId"),
  CONSTRAINT "SubscriptionRefundAdjustment_journal_key" UNIQUE ("ledgerJournalId"),
  CONSTRAINT "SubscriptionRefundAdjustment_invoice_refund_key" UNIQUE ("invoiceId", "refundId"),
  CONSTRAINT "SubscriptionRefundAdjustment_amount_check" CHECK ("deferredAmount" >= 0 AND "recognizedAmount" >= 0 AND "taxAmount" >= 0)
);
CREATE INDEX "SubscriptionRefundAdjustment_contract_created_idx" ON "SubscriptionRefundAdjustment"("contractId", "createdAt");

CREATE TABLE "SubscriptionEntitlementRefundAdjustment" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "refundAdjustmentId" TEXT NOT NULL, "grantId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL, "action" TEXT NOT NULL, "safeEvidence" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionEntitlementRefundAdjustment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SubscriptionEntitlementRefundAdjustment_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "SubscriptionEntitlementRefundAdjustment_refund_grant_operation_key" UNIQUE ("refundAdjustmentId", "grantId", "operationId")
);
CREATE INDEX "SubscriptionEntitlementRefundAdjustment_grant_created_idx" ON "SubscriptionEntitlementRefundAdjustment"("grantId", "createdAt");

CREATE TABLE "SubscriptionRenewalApplication" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "invoiceId" TEXT NOT NULL, "paymentId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL, "classification" TEXT NOT NULL, "safeEvidence" JSONB NOT NULL, "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionRenewalApplication_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SubscriptionRenewalApplication_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "SubscriptionRenewalApplication_invoiceId_key" UNIQUE ("invoiceId"),
  CONSTRAINT "SubscriptionRenewalApplication_paymentId_key" UNIQUE ("paymentId"),
  CONSTRAINT "SubscriptionRenewalApplication_operationId_key" UNIQUE ("operationId")
);

ALTER TABLE "SubscriptionOperationReceipt" ADD CONSTRAINT "SubscriptionOperationReceipt_contract_fkey" FOREIGN KEY ("contractId") REFERENCES "SubscriptionContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionProviderSynchronizationEvidence" ADD CONSTRAINT "SubscriptionProviderSynchronizationEvidence_contract_fkey" FOREIGN KEY ("contractId") REFERENCES "SubscriptionContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionProviderSynchronizationEvidence" ADD CONSTRAINT "SubscriptionProviderSynchronizationEvidence_authority_fkey" FOREIGN KEY ("providerAuthorityId") REFERENCES "SubscriptionPaymentAuthority"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionRefundAdjustment" ADD CONSTRAINT "SubscriptionRefundAdjustment_contract_fkey" FOREIGN KEY ("contractId") REFERENCES "SubscriptionContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionRefundAdjustment" ADD CONSTRAINT "SubscriptionRefundAdjustment_invoice_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SubscriptionInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionRefundAdjustment" ADD CONSTRAINT "SubscriptionRefundAdjustment_cycle_fkey" FOREIGN KEY ("billingCycleId") REFERENCES "SubscriptionBillingCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionRefundAdjustment" ADD CONSTRAINT "SubscriptionRefundAdjustment_refund_fkey" FOREIGN KEY ("refundId") REFERENCES "PaymentRefund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionRefundAdjustment" ADD CONSTRAINT "SubscriptionRefundAdjustment_journal_fkey" FOREIGN KEY ("ledgerJournalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionEntitlementRefundAdjustment" ADD CONSTRAINT "SubscriptionEntitlementRefundAdjustment_refund_adjustment_fkey" FOREIGN KEY ("refundAdjustmentId") REFERENCES "SubscriptionRefundAdjustment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionEntitlementRefundAdjustment" ADD CONSTRAINT "SubscriptionEntitlementRefundAdjustment_grant_fkey" FOREIGN KEY ("grantId") REFERENCES "SubscriptionEntitlementGrant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionRenewalApplication" ADD CONSTRAINT "SubscriptionRenewalApplication_invoice_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SubscriptionInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionRenewalApplication" ADD CONSTRAINT "SubscriptionRenewalApplication_payment_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
