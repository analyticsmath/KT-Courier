-- Phase 20: marketplace cart and checkout.
-- Additive only. Existing Cart, CartItem, courier Order, Payment, price and
-- inventory evidence are retained; no historical row is rewritten or seeded.

CREATE TYPE "MarketplaceCartOwnerType" AS ENUM ('GUEST', 'CUSTOMER');
CREATE TYPE "StoreSellerLegalIdentityStatus" AS ENUM ('APPROVED', 'RETIRED');
CREATE TYPE "MarketplaceCartStatus" AS ENUM ('ACTIVE', 'CHECKOUT_LOCKED', 'CONVERTED', 'MERGED', 'ABANDONED', 'EXPIRED');
CREATE TYPE "MarketplaceCartOperationType" AS ENUM ('ADD_LINE', 'UPDATE_QUANTITY', 'REPLACE_MODIFIERS', 'REMOVE_LINE', 'CLEAR', 'CLAIM', 'MERGE');
CREATE TYPE "MarketplaceEligibilityStatus" AS ENUM ('ELIGIBLE', 'PRICE_CHANGED', 'OFFER_UNAVAILABLE', 'PRODUCT_UNAVAILABLE', 'VARIANT_UNAVAILABLE', 'STORE_UNAVAILABLE', 'OUT_OF_STOCK', 'INSUFFICIENT_STOCK', 'SERVICE_AREA_UNKNOWN', 'NOT_SERVICEABLE', 'MODIFIER_INVALID', 'VARIABLE_WEIGHT_UNSUPPORTED', 'MADE_TO_ORDER_UNSUPPORTED');
CREATE TYPE "MarketplaceCheckoutStatus" AS ENUM ('CREATED', 'VALIDATING', 'CHANGES_REQUIRED', 'READY_FOR_REVIEW', 'RESERVING', 'RESERVED', 'PAYMENT_PREPARING', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'COMPLETING', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'RECONCILIATION_REQUIRED');
CREATE TYPE "MarketplaceCheckoutOperationType" AS ENUM ('UPDATE_CONTACT', 'UPDATE_ADDRESS', 'REPRICE', 'ACKNOWLEDGE_CHANGES', 'ACCEPT_REVIEW', 'PREPARE_PAYMENT', 'CANCEL', 'DELIVERY_QUOTES', 'DELIVERY_OPTIONS', 'REVIEW', 'ACKNOWLEDGE', 'FINALIZE', 'RETRY_FINALIZATION', 'SETTLE', 'RETRY_SETTLEMENT', 'RECONCILE', 'RESERVE', 'RELEASE_RESERVATION', 'CONSUME_RESERVATION');
CREATE TYPE "MarketplaceCheckoutChangeType" AS ENUM ('PRICE_INCREASE', 'PRICE_DECREASE', 'QUANTITY_REDUCED', 'OUT_OF_STOCK', 'OFFER_WITHDRAWN', 'STORE_UNAVAILABLE', 'MODIFIER_CHANGED', 'DELIVERY_FEE_CHANGED', 'DELIVERY_OPTION_CHANGED', 'NOT_SERVICEABLE');
CREATE TYPE "MarketplaceCheckoutStoreGroupStatus" AS ENUM ('READY', 'NOT_SERVICEABLE', 'QUOTE_EXPIRED', 'UNAVAILABLE');
CREATE TYPE "MarketplaceReservationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED', 'EXPIRED', 'PAYMENT_UNCERTAIN', 'PAYMENT_PENDING_HOLD', 'RECONCILIATION_REQUIRED');
CREATE TYPE "MarketplaceReservationReleaseReason" AS ENUM ('CHECKOUT_CANCELLED', 'CHECKOUT_EXPIRED', 'PAYMENT_DEFINITELY_FAILED', 'REPRICE_REQUIRED', 'ADMIN_RECONCILIATION');
CREATE TYPE "MarketplaceOrderStatus" AS ENUM ('CONFIRMED', 'RECONCILIATION_REQUIRED', 'CANCELLED');
CREATE TYPE "MarketplaceStoreOrderStatus" AS ENUM ('PENDING_SETTLEMENT', 'SETTLED', 'PENDING_STORE_REVIEW', 'RECONCILIATION_REQUIRED', 'CANCELLED');
CREATE TYPE "MarketplaceSettlementStatus" AS ENUM ('PENDING', 'ORCHESTRATING', 'ORCHESTRATED', 'COMPLETED', 'RECONCILIATION_REQUIRED');
CREATE TYPE "MarketplaceStoreSettlementJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'RETRYABLE', 'RECONCILIATION_REQUIRED');
CREATE TYPE "MarketplaceSettlementAllocationType" AS ENUM ('COMMISSION', 'STORE_EARNING', 'DELIVERY_FEE_RESIDUAL');
CREATE TYPE "MarketplaceReconciliationReason" AS ENUM ('CART_VERSION_MISMATCH', 'CHECKOUT_TOTAL_MISMATCH', 'PRICE_VERSION_MISMATCH', 'DELIVERY_QUOTE_MISMATCH', 'SERVICEABILITY_MISMATCH', 'RESERVATION_MISSING', 'PAYMENT_AMOUNT_MISMATCH', 'PAYMENT_STATUS_UNCERTAIN', 'PAYMENT_CONFIRMED_ORDER_MISSING', 'DUPLICATE_ORDER_ATTEMPT', 'ORDER_CREATION_FAILURE', 'RESERVATION_CONFLICT', 'RESERVATION_EXPIRED', 'INVENTORY_COMMITMENT_FAILURE', 'SETTLEMENT_ORCHESTRATION_FAILURE', 'SOURCE_EVIDENCE_MISMATCH', 'PARTIAL_ORDER_CREATION', 'COMMISSION_SNAPSHOT_MISMATCH', 'STORE_SETTLEMENT_FAILED', 'STORE_SETTLEMENT_PARTIAL', 'APPLICATION_FAILURE');
CREATE TYPE "MarketplaceReconciliationStatus" AS ENUM ('OPEN', 'MONITORING', 'RESOLVED');
CREATE TYPE "MarketplaceReconciliationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "MarketplaceOrderLineAllocationType" AS ENUM ('SELLER_BASIS', 'COMMISSION', 'STORE_EARNING');
CREATE TYPE "MarketplaceRiskDecision" AS ENUM ('PASS', 'REVIEW', 'BLOCK');
CREATE TYPE "PaymentSubjectType" AS ENUM ('COURIER_ORDER', 'MARKETPLACE_CHECKOUT', 'SUBSCRIPTION_INVOICE');
ALTER TYPE "CommissionSubjectType" ADD VALUE IF NOT EXISTS 'MARKETPLACE_STORE_ORDER';

ALTER TYPE "CatalogInventoryMovementType" ADD VALUE IF NOT EXISTS 'RESERVATION';
ALTER TYPE "CatalogInventoryMovementType" ADD VALUE IF NOT EXISTS 'RESERVATION_RELEASE';
ALTER TYPE "CatalogInventoryMovementType" ADD VALUE IF NOT EXISTS 'SALE_COMMITMENT';

CREATE TABLE "StoreSellerLegalIdentity" (
  "id" TEXT NOT NULL, "storeId" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "identityVersion" TEXT NOT NULL,
  "legalName" TEXT NOT NULL, "tradingName" TEXT, "registrationReference" TEXT,
  "vatRegistrationStatus" TEXT NOT NULL, "vatNumber" TEXT, "countryCode" TEXT NOT NULL DEFAULT 'ZA',
  "termsReference" TEXT, "invoiceClassification" TEXT, "status" "StoreSellerLegalIdentityStatus" NOT NULL DEFAULT 'APPROVED',
  "effectiveFrom" TIMESTAMP(3) NOT NULL, "effectiveUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreSellerLegalIdentity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoreSellerLegalIdentity_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "StoreSellerLegalIdentity_store_version_key" UNIQUE ("storeId", "identityVersion"),
  CONSTRAINT "StoreSellerLegalIdentity_shape_check" CHECK (length(trim("legalName")) > 1 AND "countryCode" = 'ZA' AND ("vatRegistrationStatus" <> 'REGISTERED' OR "vatNumber" IS NOT NULL))
);

CREATE TABLE "MarketplaceCart" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "ownerType" "MarketplaceCartOwnerType" NOT NULL,
  "customerUserId" TEXT,
  "guestTokenHash" TEXT,
  "guestTokenVersion" INTEGER NOT NULL DEFAULT 1,
  "serviceAreaReference" TEXT,
  "status" "MarketplaceCartStatus" NOT NULL DEFAULT 'ACTIVE',
  "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR',
  "version" INTEGER NOT NULL DEFAULT 1,
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "convertedCheckoutId" TEXT,
  "mergedIntoCartId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceCart_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceCart_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "MarketplaceCart_owner_shape_check" CHECK (
    "currency" = 'ZAR' AND "version" > 0 AND "guestTokenVersion" > 0 AND
    (("ownerType" = 'GUEST' AND "customerUserId" IS NULL AND "guestTokenHash" IS NOT NULL) OR
     ("ownerType" = 'CUSTOMER' AND "customerUserId" IS NOT NULL AND "guestTokenHash" IS NULL))
  )
);

CREATE TABLE "MarketplaceCartStoreGroup" (
  "id" TEXT NOT NULL, "cartId" TEXT NOT NULL, "storeId" TEXT NOT NULL,
  "fulfilmentMode" "CatalogFulfilmentMode" NOT NULL, "customerNote" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceCartStoreGroup_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceCartStoreGroup_cart_store_key" UNIQUE ("cartId", "storeId"),
  CONSTRAINT "MarketplaceCartStoreGroup_version_check" CHECK ("version" > 0)
);

CREATE TABLE "MarketplaceCartLine" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "cartId" TEXT NOT NULL, "storeGroupId" TEXT NOT NULL,
  "productPublicReference" TEXT NOT NULL, "variantPublicReference" TEXT NOT NULL, "offerPublicReference" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL, "observedPublicationVersion" TEXT NOT NULL, "observedPriceVersion" TEXT NOT NULL,
  "observedUnitPrice" DECIMAL(18,2) NOT NULL, "eligibilityStatus" "MarketplaceEligibilityStatus" NOT NULL DEFAULT 'ELIGIBLE',
  "eligibilityIssues" JSONB, "lineFingerprint" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceCartLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceCartLine_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "MarketplaceCartLine_cart_fingerprint_key" UNIQUE ("cartId", "lineFingerprint"),
  CONSTRAINT "MarketplaceCartLine_quantity_price_check" CHECK ("quantity" > 0 AND "observedUnitPrice" >= 0 AND "version" > 0)
);

CREATE TABLE "MarketplaceCartLineModifier" (
  "id" TEXT NOT NULL, "cartLineId" TEXT NOT NULL, "modifierGroupPublicReference" TEXT NOT NULL,
  "modifierOptionPublicReference" TEXT NOT NULL, "quantity" INTEGER NOT NULL DEFAULT 1,
  "observedPriceDelta" DECIMAL(18,2) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceCartLineModifier_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceCartLineModifier_line_group_option_key" UNIQUE ("cartLineId", "modifierGroupPublicReference", "modifierOptionPublicReference"),
  CONSTRAINT "MarketplaceCartLineModifier_quantity_check" CHECK ("quantity" > 0)
);

CREATE TABLE "MarketplaceCartOperation" (
  "id" TEXT NOT NULL, "cartId" TEXT NOT NULL, "operationId" TEXT NOT NULL, "requestHash" TEXT NOT NULL,
  "type" "MarketplaceCartOperationType" NOT NULL, "response" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceCartOperation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceCartOperation_cart_operation_key" UNIQUE ("cartId", "operationId")
);

CREATE TABLE "MarketplaceCheckoutContactSnapshot" (
  "id" TEXT NOT NULL, "recipientName" TEXT NOT NULL, "email" TEXT NOT NULL, "phone" TEXT NOT NULL,
  "verifiedCustomerReference" TEXT, "preferredContactMethod" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceCheckoutContactSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketplaceCheckoutAddressSnapshot" (
  "id" TEXT NOT NULL, "recipientName" TEXT NOT NULL, "line1" TEXT NOT NULL, "line2" TEXT,
  "suburb" TEXT, "city" TEXT NOT NULL, "province" TEXT NOT NULL, "postalCode" TEXT,
  "country" TEXT NOT NULL DEFAULT 'South Africa', "deliveryInstructions" TEXT,
  "serviceAreaReference" TEXT, "serviceabilityEvidence" JSONB, "protectedCoordinates" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceCheckoutAddressSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceCheckoutAddressSnapshot_country_check" CHECK ("country" = 'South Africa')
);

CREATE TABLE "MarketplaceCheckout" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "cartId" TEXT NOT NULL, "customerUserId" TEXT,
  "guestAccessTokenHash" TEXT, "guestAccessTokenVersion" INTEGER NOT NULL DEFAULT 1,
  "status" "MarketplaceCheckoutStatus" NOT NULL DEFAULT 'CREATED', "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR',
  "contactSnapshotId" TEXT, "addressSnapshotId" TEXT, "merchandiseSubtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "modifierSubtotal" DECIMAL(18,2) NOT NULL DEFAULT 0, "deliveryFeeTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "grandTotal" DECIMAL(18,2) NOT NULL DEFAULT 0, "reviewVersion" INTEGER NOT NULL DEFAULT 1,
  "commercialFingerprint" TEXT, "acceptedFingerprint" TEXT, "changesAcknowledgedAt" TIMESTAMP(3), "termsAcknowledgedAt" TIMESTAMP(3),
  "reviewAcceptedAt" TIMESTAMP(3), "reservationExpiresAt" TIMESTAMP(3),
  "riskDecision" "MarketplaceRiskDecision" NOT NULL DEFAULT 'PASS', "riskReasonCodes" JSONB,
  "confirmedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "cancelledAt" TIMESTAMP(3), "expiredAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceCheckout_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceCheckout_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "MarketplaceCheckout_contactSnapshotId_key" UNIQUE ("contactSnapshotId"),
  CONSTRAINT "MarketplaceCheckout_addressSnapshotId_key" UNIQUE ("addressSnapshotId"),
  CONSTRAINT "MarketplaceCheckout_totals_check" CHECK (
    "currency" = 'ZAR' AND "reviewVersion" > 0 AND "version" > 0 AND "guestAccessTokenVersion" > 0 AND
    "merchandiseSubtotal" >= 0 AND "modifierSubtotal" >= 0 AND "deliveryFeeTotal" >= 0 AND "grandTotal" >= 0 AND
    "grandTotal" = "merchandiseSubtotal" + "modifierSubtotal" + "deliveryFeeTotal"
  )
);

CREATE TABLE "MarketplaceCheckoutStoreGroup" (
  "id" TEXT NOT NULL, "checkoutId" TEXT NOT NULL, "storeId" TEXT NOT NULL,
  "fulfilmentMode" "CatalogFulfilmentMode" NOT NULL, "merchandiseSubtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "modifierSubtotal" DECIMAL(18,2) NOT NULL DEFAULT 0, "deliveryFee" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "groupTotal" DECIMAL(18,2) NOT NULL DEFAULT 0, "deliveryQuoteReference" TEXT, "deliveryQuoteVersion" TEXT,
  "deliveryQuoteExpiresAt" TIMESTAMP(3), "serviceabilityReference" TEXT, "pickupLocationReference" TEXT,
  "status" "MarketplaceCheckoutStoreGroupStatus" NOT NULL DEFAULT 'READY', "sellerIdentityEvidence" JSONB, "taxEvidence" JSONB,
  "termsReference" TEXT, "refundPolicyReference" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceCheckoutStoreGroup_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceCheckoutStoreGroup_checkout_store_key" UNIQUE ("checkoutId", "storeId"),
  CONSTRAINT "MarketplaceCheckoutStoreGroup_total_check" CHECK (
    "merchandiseSubtotal" >= 0 AND "modifierSubtotal" >= 0 AND "deliveryFee" >= 0 AND
    "groupTotal" = "merchandiseSubtotal" + "modifierSubtotal" + "deliveryFee"
  )
);

CREATE TABLE "MarketplaceCheckoutLineSnapshot" (
  "id" TEXT NOT NULL, "checkoutId" TEXT NOT NULL, "storeGroupId" TEXT NOT NULL, "reviewVersion" INTEGER NOT NULL DEFAULT 1, "productReference" TEXT NOT NULL,
  "variantReference" TEXT NOT NULL, "offerReference" TEXT NOT NULL, "storeReference" TEXT NOT NULL, "productTitle" TEXT NOT NULL,
  "variantTitle" TEXT NOT NULL, "storeSku" TEXT, "quantity" INTEGER NOT NULL, "sellingUnit" "CatalogSellingUnit" NOT NULL,
  "publicationVersion" TEXT NOT NULL, "priceVersion" TEXT NOT NULL, "baseUnitPrice" DECIMAL(18,2) NOT NULL,
  "modifierUnitTotal" DECIMAL(18,2) NOT NULL, "effectiveUnitPrice" DECIMAL(18,2) NOT NULL, "lineTotal" DECIMAL(18,2) NOT NULL,
  "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR', "inventoryItemId" TEXT, "inventoryLocationId" TEXT,
  "taxTreatment" TEXT NOT NULL, "includedTaxAmount" DECIMAL(18,2), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceCheckoutLineSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceCheckoutLineSnapshot_total_check" CHECK (
    "reviewVersion" > 0 AND "quantity" > 0 AND "currency" = 'ZAR' AND "effectiveUnitPrice" = "baseUnitPrice" + "modifierUnitTotal" AND
    "lineTotal" = "effectiveUnitPrice" * "quantity" AND ("includedTaxAmount" IS NULL OR "includedTaxAmount" >= 0)
  )
);

CREATE TABLE "MarketplaceCheckoutModifierSnapshot" (
  "id" TEXT NOT NULL, "checkoutLineSnapshotId" TEXT NOT NULL, "groupReference" TEXT NOT NULL, "groupName" TEXT NOT NULL,
  "optionReference" TEXT NOT NULL, "optionName" TEXT NOT NULL, "quantity" INTEGER NOT NULL, "priceDelta" DECIMAL(18,2) NOT NULL,
  "totalContribution" DECIMAL(18,2) NOT NULL, "sourceVersion" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceCheckoutModifierSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceCheckoutModifierSnapshot_total_check" CHECK ("quantity" > 0 AND "totalContribution" = "priceDelta" * "quantity")
);

CREATE TABLE "MarketplaceCheckoutStoreSettlementEvidence" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "checkoutId" TEXT NOT NULL, "checkoutStoreGroupId" TEXT NOT NULL,
  "reviewVersion" INTEGER NOT NULL, "commercialFingerprint" TEXT NOT NULL, "evidenceVersion" TEXT NOT NULL,
  "sellerIdentityReference" TEXT NOT NULL, "sellerIdentityVersion" TEXT NOT NULL, "sellerIdentityEvidence" JSONB NOT NULL,
  "commissionPlanReference" TEXT NOT NULL, "commissionPlanVersion" INTEGER NOT NULL, "commissionCalculationVersion" TEXT NOT NULL, "commissionEvidence" JSONB NOT NULL,
  "sellerSettlementBasisAmount" DECIMAL(18,2) NOT NULL, "attributedCommissionAmount" DECIMAL(18,2) NOT NULL, "netStoreEarningAmount" DECIMAL(18,2) NOT NULL, "deliveryFeeExcludedAmount" DECIMAL(18,2) NOT NULL,
  "taxEvidence" JSONB NOT NULL, "policyReferences" JSONB NOT NULL, "sourceEvidenceFingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceCheckoutStoreSettlementEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceCheckoutStoreSettlementEvidence_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "MarketplaceCheckoutStoreSettlementEvidence_group_review_key" UNIQUE ("checkoutStoreGroupId", "reviewVersion"),
  CONSTRAINT "MarketplaceCheckoutStoreSettlementEvidence_amount_check" CHECK ("reviewVersion" > 0 AND "sellerSettlementBasisAmount" > 0 AND "attributedCommissionAmount" >= 0 AND "netStoreEarningAmount" >= 0 AND "deliveryFeeExcludedAmount" >= 0 AND "sellerSettlementBasisAmount" - "attributedCommissionAmount" = "netStoreEarningAmount")
);

CREATE TABLE "MarketplaceCheckoutSettlementLineAllocation" (
  "id" TEXT NOT NULL, "settlementEvidenceId" TEXT NOT NULL, "checkoutLineSnapshotId" TEXT NOT NULL, "stableOrderingKey" TEXT NOT NULL,
  "merchandiseBasisAmount" DECIMAL(18,2) NOT NULL, "modifierBasisAmount" DECIMAL(18,2) NOT NULL, "sellerSettlementBasisAmount" DECIMAL(18,2) NOT NULL,
  "attributedCommissionAmount" DECIMAL(18,2) NOT NULL, "netStoreEarningAmount" DECIMAL(18,2) NOT NULL, "taxEvidence" JSONB NOT NULL,
  "allocationVersion" TEXT NOT NULL, "roundingSequence" INTEGER NOT NULL, "finalCentRecipient" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceCheckoutSettlementLineAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceCheckoutSettlementLineAllocation_line_key" UNIQUE ("checkoutLineSnapshotId"),
  CONSTRAINT "MarketplaceCheckoutSettlementLineAllocation_evidence_key" UNIQUE ("settlementEvidenceId", "stableOrderingKey"),
  CONSTRAINT "MarketplaceCheckoutSettlementLineAllocation_amount_check" CHECK ("merchandiseBasisAmount" >= 0 AND "modifierBasisAmount" >= 0 AND "sellerSettlementBasisAmount" = "merchandiseBasisAmount" + "modifierBasisAmount" AND "attributedCommissionAmount" >= 0 AND "netStoreEarningAmount" >= 0 AND "sellerSettlementBasisAmount" - "attributedCommissionAmount" = "netStoreEarningAmount" AND "roundingSequence" >= 0)
);

CREATE TABLE "MarketplaceCheckoutChange" (
  "id" TEXT NOT NULL, "checkoutId" TEXT NOT NULL, "reviewVersion" INTEGER NOT NULL DEFAULT 1, "type" "MarketplaceCheckoutChangeType" NOT NULL,
  "lineReference" TEXT, "details" JSONB, "acknowledgedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceCheckoutChange_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceCheckoutChange_reviewVersion_check" CHECK ("reviewVersion" > 0)
);

CREATE TABLE "MarketplaceCheckoutOperation" (
  "id" TEXT NOT NULL, "checkoutId" TEXT NOT NULL, "operationId" TEXT NOT NULL, "requestHash" TEXT NOT NULL,
  "type" "MarketplaceCheckoutOperationType" NOT NULL, "response" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceCheckoutOperation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceCheckoutOperation_checkout_operation_key" UNIQUE ("checkoutId", "operationId")
);

CREATE TABLE "MarketplaceCheckoutAcknowledgement" (
  "id" TEXT NOT NULL, "checkoutId" TEXT NOT NULL, "reviewVersion" INTEGER NOT NULL,
  "commercialFingerprint" TEXT NOT NULL, "grandTotal" DECIMAL(18,2) NOT NULL,
  "termsVersion" TEXT NOT NULL, "privacyVersion" TEXT NOT NULL,
  "refundPolicyReferences" JSONB NOT NULL, "settlementEvidenceVersions" JSONB NOT NULL, "changeSet" JSONB NOT NULL,
  "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceCheckoutAcknowledgement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceCheckoutAcknowledgement_checkout_review_key" UNIQUE ("checkoutId", "reviewVersion"),
  CONSTRAINT "MarketplaceCheckoutAcknowledgement_amount_check" CHECK ("grandTotal" >= 0)
);

CREATE TABLE "MarketplaceInventoryReservation" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "checkoutId" TEXT NOT NULL,
  "status" "MarketplaceReservationStatus" NOT NULL DEFAULT 'ACTIVE', "commercialFingerprint" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "consumedAt" TIMESTAMP(3), "releasedAt" TIMESTAMP(3),
  "releaseReason" "MarketplaceReservationReleaseReason", "paymentUncertainAt" TIMESTAMP(3), "paymentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceInventoryReservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceInventoryReservation_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "MarketplaceInventoryReservation_state_check" CHECK (
    ("status" = 'CONSUMED' AND "consumedAt" IS NOT NULL) OR
    ("status" IN ('RELEASED', 'EXPIRED') AND "releasedAt" IS NOT NULL) OR
    ("status" NOT IN ('CONSUMED', 'RELEASED', 'EXPIRED'))
  )
);

CREATE TABLE "MarketplaceInventoryReservationItem" (
  "id" TEXT NOT NULL, "reservationId" TEXT NOT NULL, "inventoryLevelId" TEXT NOT NULL,
  "inventoryItemReference" TEXT NOT NULL, "locationReference" TEXT NOT NULL, "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceInventoryReservationItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceInventoryReservationItem_reservation_level_key" UNIQUE ("reservationId", "inventoryLevelId"),
  CONSTRAINT "MarketplaceInventoryReservationItem_quantity_check" CHECK ("quantity" > 0)
);

CREATE TABLE "MarketplaceOrder" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "checkoutId" TEXT NOT NULL, "paymentId" TEXT NOT NULL,
  "customerUserId" TEXT, "guestConfirmationHash" TEXT, "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR',
  "merchandiseSubtotal" DECIMAL(18,2) NOT NULL, "modifierSubtotal" DECIMAL(18,2) NOT NULL,
  "deliveryFeeTotal" DECIMAL(18,2) NOT NULL, "grandTotal" DECIMAL(18,2) NOT NULL,
  "status" "MarketplaceOrderStatus" NOT NULL DEFAULT 'CONFIRMED', "commercialFingerprint" TEXT NOT NULL,
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceOrder_pkey" PRIMARY KEY ("id"), CONSTRAINT "MarketplaceOrder_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "MarketplaceOrder_checkoutId_key" UNIQUE ("checkoutId"), CONSTRAINT "MarketplaceOrder_paymentId_key" UNIQUE ("paymentId"),
  CONSTRAINT "MarketplaceOrder_total_check" CHECK (
    "currency" = 'ZAR' AND "merchandiseSubtotal" >= 0 AND "modifierSubtotal" >= 0 AND "deliveryFeeTotal" >= 0 AND
    "grandTotal" = "merchandiseSubtotal" + "modifierSubtotal" + "deliveryFeeTotal"
  )
);

CREATE TABLE "MarketplaceStoreOrder" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "marketplaceOrderId" TEXT NOT NULL,
  "checkoutStoreGroupId" TEXT NOT NULL, "storeId" TEXT NOT NULL,
  "status" "MarketplaceStoreOrderStatus" NOT NULL DEFAULT 'PENDING_SETTLEMENT', "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR',
  "merchandiseSubtotal" DECIMAL(18,2) NOT NULL, "modifierSubtotal" DECIMAL(18,2) NOT NULL,
  "deliveryFee" DECIMAL(18,2) NOT NULL, "groupTotal" DECIMAL(18,2) NOT NULL, "sellerIdentityEvidence" JSONB,
  "taxEvidence" JSONB, "termsReference" TEXT, "refundPolicyReference" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceStoreOrder_pkey" PRIMARY KEY ("id"), CONSTRAINT "MarketplaceStoreOrder_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "MarketplaceStoreOrder_checkoutStoreGroupId_key" UNIQUE ("checkoutStoreGroupId"),
  CONSTRAINT "MarketplaceStoreOrder_order_store_key" UNIQUE ("marketplaceOrderId", "storeId"),
  CONSTRAINT "MarketplaceStoreOrder_total_check" CHECK (
    "currency" = 'ZAR' AND "merchandiseSubtotal" >= 0 AND "modifierSubtotal" >= 0 AND "deliveryFee" >= 0 AND
    "groupTotal" = "merchandiseSubtotal" + "modifierSubtotal" + "deliveryFee"
  )
);

CREATE TABLE "MarketplaceOrderLine" (
  "id" TEXT NOT NULL, "marketplaceStoreOrderId" TEXT NOT NULL, "checkoutLineSnapshotId" TEXT NOT NULL,
  "productReference" TEXT NOT NULL, "variantReference" TEXT NOT NULL, "offerReference" TEXT NOT NULL, "title" TEXT NOT NULL,
  "variantTitle" TEXT NOT NULL, "quantity" INTEGER NOT NULL, "baseUnitPrice" DECIMAL(18,2) NOT NULL,
  "modifierUnitTotal" DECIMAL(18,2) NOT NULL, "effectiveUnitPrice" DECIMAL(18,2) NOT NULL, "lineTotal" DECIMAL(18,2) NOT NULL,
  "taxTreatment" TEXT NOT NULL, "includedTaxAmount" DECIMAL(18,2), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceOrderLine_pkey" PRIMARY KEY ("id"), CONSTRAINT "MarketplaceOrderLine_checkoutLineSnapshotId_key" UNIQUE ("checkoutLineSnapshotId"),
  CONSTRAINT "MarketplaceOrderLine_total_check" CHECK (
    "quantity" > 0 AND "effectiveUnitPrice" = "baseUnitPrice" + "modifierUnitTotal" AND "lineTotal" = "effectiveUnitPrice" * "quantity"
  )
);

CREATE TABLE "MarketplaceOrderLineModifier" (
  "id" TEXT NOT NULL, "marketplaceOrderLineId" TEXT NOT NULL, "groupReference" TEXT NOT NULL, "groupName" TEXT NOT NULL,
  "optionReference" TEXT NOT NULL, "optionName" TEXT NOT NULL, "quantity" INTEGER NOT NULL, "priceDelta" DECIMAL(18,2) NOT NULL,
  "totalContribution" DECIMAL(18,2) NOT NULL, "sourceVersion" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceOrderLineModifier_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceOrderLineModifier_total_check" CHECK ("quantity" > 0 AND "totalContribution" = "priceDelta" * "quantity")
);

CREATE TABLE "MarketplaceOrderLineFinancialAllocation" (
  "id" TEXT NOT NULL, "marketplaceOrderLineId" TEXT NOT NULL,
  "type" "MarketplaceOrderLineAllocationType" NOT NULL, "amount" DECIMAL(18,2) NOT NULL,
  "allocationVersion" TEXT NOT NULL, "roundingSequence" INTEGER NOT NULL,
  "finalCentRecipient" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceOrderLineFinancialAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceOrderLineFinancialAllocation_line_type_key" UNIQUE ("marketplaceOrderLineId", "type"),
  CONSTRAINT "MarketplaceOrderLineFinancialAllocation_amount_check" CHECK ("amount" >= 0 AND "roundingSequence" >= 0)
);

CREATE TABLE "MarketplaceSettlementSnapshot" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "marketplaceStoreOrderId" TEXT NOT NULL, "settlementVersion" TEXT NOT NULL DEFAULT 'phase20-v1',
  "sourceCheckoutId" TEXT NOT NULL, "sourceCheckoutReviewVersion" INTEGER NOT NULL, "sourceCheckoutStoreGroupId" TEXT NOT NULL,
  "sourceSettlementEvidenceId" TEXT NOT NULL, "sourceCommercialFingerprint" TEXT NOT NULL, "sourcePaymentId" TEXT NOT NULL,
  "commissionPlanReference" TEXT, "commissionPlanVersion" TEXT, "sellerBasis" DECIMAL(18,2) NOT NULL,
  "commissionAmount" DECIMAL(18,2) NOT NULL, "storeEarningAmount" DECIMAL(18,2) NOT NULL,
  "deliveryFeeResidual" DECIMAL(18,2) NOT NULL, "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR', "authoritativeAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "MarketplaceSettlementStatus" NOT NULL DEFAULT 'PENDING', "sourceEvidenceFingerprint" TEXT NOT NULL,
  "commissionAccrualReference" TEXT, "storeEarningReference" TEXT, "settledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceSettlementSnapshot_pkey" PRIMARY KEY ("id"), CONSTRAINT "MarketplaceSettlementSnapshot_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "MarketplaceSettlementSnapshot_storeOrder_version_key" UNIQUE ("marketplaceStoreOrderId", "settlementVersion"),
  CONSTRAINT "MarketplaceSettlementSnapshot_sourceEvidence_key" UNIQUE ("sourceSettlementEvidenceId"),
  CONSTRAINT "MarketplaceSettlementSnapshot_commissionAccrualReference_key" UNIQUE ("commissionAccrualReference"),
  CONSTRAINT "MarketplaceSettlementSnapshot_storeEarningReference_key" UNIQUE ("storeEarningReference"),
  CONSTRAINT "MarketplaceSettlementSnapshot_total_check" CHECK (
    "currency" = 'ZAR' AND "sellerBasis" >= 0 AND "commissionAmount" >= 0 AND "storeEarningAmount" >= 0 AND
    "deliveryFeeResidual" >= 0 AND "sellerBasis" = "commissionAmount" + "storeEarningAmount"
  ),
  CONSTRAINT "MarketplaceSettlementSnapshot_completion_check" CHECK (
    "status" <> 'COMPLETED' OR ("commissionAccrualReference" IS NOT NULL AND "storeEarningReference" IS NOT NULL AND "settledAt" IS NOT NULL)
  )
);

CREATE TABLE "MarketplaceStoreSettlementJob" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "marketplaceStoreOrderId" TEXT NOT NULL,
  "settlementSnapshotId" TEXT NOT NULL, "settlementVersion" TEXT NOT NULL, "operationId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL, "status" "MarketplaceStoreSettlementJobStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0, "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSafeError" TEXT, "completedAt" TIMESTAMP(3), "reconciliationCaseId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceStoreSettlementJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceStoreSettlementJob_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "MarketplaceStoreSettlementJob_storeOrder_version_key" UNIQUE ("marketplaceStoreOrderId", "settlementVersion"),
  CONSTRAINT "MarketplaceStoreSettlementJob_snapshot_operation_key" UNIQUE ("settlementSnapshotId", "operationId"),
  CONSTRAINT "MarketplaceStoreSettlementJob_attempt_check" CHECK ("attemptCount" >= 0),
  CONSTRAINT "MarketplaceStoreSettlementJob_completion_check" CHECK (("status" = 'COMPLETED') = ("completedAt" IS NOT NULL))
);

CREATE TABLE "MarketplaceSettlementHistory" (
  "id" TEXT NOT NULL, "settlementSnapshotId" TEXT NOT NULL, "operationId" TEXT NOT NULL,
  "fromStatus" "MarketplaceSettlementStatus", "toStatus" "MarketplaceSettlementStatus" NOT NULL,
  "safeEvidence" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceSettlementHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceSettlementHistory_snapshot_operation_key" UNIQUE ("settlementSnapshotId", "operationId")
);

CREATE TABLE "MarketplaceSettlementAllocation" (
  "id" TEXT NOT NULL, "settlementSnapshotId" TEXT NOT NULL, "type" "MarketplaceSettlementAllocationType" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL, "externalReference" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceSettlementAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceSettlementAllocation_snapshot_type_key" UNIQUE ("settlementSnapshotId", "type"),
  CONSTRAINT "MarketplaceSettlementAllocation_amount_check" CHECK ("amount" >= 0)
);

CREATE TABLE "MarketplaceCheckoutReconciliationCase" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "checkoutId" TEXT NOT NULL, "marketplaceOrderId" TEXT,
  "paymentId" TEXT, "marketplaceStoreOrderId" TEXT, "reservationId" TEXT,
  "reason" "MarketplaceReconciliationReason" NOT NULL, "status" "MarketplaceReconciliationStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "MarketplaceReconciliationPriority" NOT NULL DEFAULT 'MEDIUM', "observationCount" INTEGER NOT NULL DEFAULT 1,
  "safeSummary" TEXT NOT NULL, "safeEvidence" JSONB, "operationId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "resolvedAt" TIMESTAMP(3), "resolutionCode" TEXT,
  CONSTRAINT "MarketplaceCheckoutReconciliationCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceCheckoutReconciliationCase_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "MarketplaceCheckoutReconciliationCase_checkout_reason_operation_key" UNIQUE ("checkoutId", "reason", "operationId"),
  CONSTRAINT "MarketplaceCheckoutReconciliationCase_observation_check" CHECK ("observationCount" > 0)
);

-- Preserve existing payment records, but allow the existing aggregate to bind a
-- guest or marketplace checkout/order without a fabricated courier Order.
ALTER TABLE "Payment" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "orderId" DROP NOT NULL;
ALTER TABLE "Payment" ADD COLUMN "subjectType" "PaymentSubjectType" NOT NULL DEFAULT 'COURIER_ORDER';
ALTER TABLE "Payment" ADD COLUMN "marketplaceCheckoutId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "marketplaceOrderId" TEXT;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_marketplaceCheckoutId_key" UNIQUE ("marketplaceCheckoutId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_marketplaceOrderId_key" UNIQUE ("marketplaceOrderId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subject_shape_check" CHECK (
  ("subjectType" = 'COURIER_ORDER' AND "orderId" IS NOT NULL AND "userId" IS NOT NULL AND "marketplaceCheckoutId" IS NULL AND "marketplaceOrderId" IS NULL) OR
  ("subjectType" = 'MARKETPLACE_CHECKOUT' AND "orderId" IS NULL AND "marketplaceCheckoutId" IS NOT NULL)
);

CREATE UNIQUE INDEX "MarketplaceCart_one_active_customer" ON "MarketplaceCart" ("customerUserId")
WHERE "ownerType" = 'CUSTOMER' AND "status" = 'ACTIVE';
CREATE UNIQUE INDEX "MarketplaceCart_one_active_guest" ON "MarketplaceCart" ("guestTokenHash")
WHERE "ownerType" = 'GUEST' AND "status" = 'ACTIVE';
CREATE UNIQUE INDEX "MarketplaceCheckout_one_live_per_cart" ON "MarketplaceCheckout" ("cartId")
WHERE "status" IN ('CREATED', 'VALIDATING', 'CHANGES_REQUIRED', 'READY_FOR_REVIEW', 'RESERVING', 'RESERVED', 'PAYMENT_PREPARING', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'COMPLETING', 'RECONCILIATION_REQUIRED');
CREATE UNIQUE INDEX "MarketplaceInventoryReservation_one_active_checkout" ON "MarketplaceInventoryReservation" ("checkoutId")
WHERE "status" IN ('ACTIVE', 'PAYMENT_UNCERTAIN', 'PAYMENT_PENDING_HOLD', 'RECONCILIATION_REQUIRED');

CREATE INDEX "MarketplaceCart_customerUserId_status_idx" ON "MarketplaceCart"("customerUserId", "status");
CREATE INDEX "MarketplaceCart_guestTokenHash_idx" ON "MarketplaceCart"("guestTokenHash");
CREATE INDEX "MarketplaceCart_status_expiresAt_idx" ON "MarketplaceCart"("status", "expiresAt");
CREATE INDEX "MarketplaceCart_lastActivityAt_idx" ON "MarketplaceCart"("lastActivityAt");
CREATE INDEX "MarketplaceCartStoreGroup_storeId_idx" ON "MarketplaceCartStoreGroup"("storeId");
CREATE INDEX "MarketplaceCartLine_storeGroupId_idx" ON "MarketplaceCartLine"("storeGroupId");
CREATE INDEX "MarketplaceCartLine_offerPublicReference_idx" ON "MarketplaceCartLine"("offerPublicReference");
CREATE INDEX "MarketplaceCartLineModifier_modifierOptionPublicReference_idx" ON "MarketplaceCartLineModifier"("modifierOptionPublicReference");
CREATE INDEX "MarketplaceCartOperation_createdAt_idx" ON "MarketplaceCartOperation"("createdAt");
CREATE INDEX "MarketplaceCheckout_cartId_status_idx" ON "MarketplaceCheckout"("cartId", "status");
CREATE INDEX "MarketplaceCheckout_customerUserId_createdAt_idx" ON "MarketplaceCheckout"("customerUserId", "createdAt");
CREATE INDEX "MarketplaceCheckout_guestAccessTokenHash_idx" ON "MarketplaceCheckout"("guestAccessTokenHash");
CREATE INDEX "MarketplaceCheckout_status_reservationExpiresAt_idx" ON "MarketplaceCheckout"("status", "reservationExpiresAt");
CREATE INDEX "MarketplaceCheckoutStoreGroup_storeId_status_idx" ON "MarketplaceCheckoutStoreGroup"("storeId", "status");
CREATE INDEX "MarketplaceCheckoutLineSnapshot_checkoutId_reviewVersion_idx" ON "MarketplaceCheckoutLineSnapshot"("checkoutId", "reviewVersion");
CREATE INDEX "MarketplaceCheckoutLineSnapshot_storeGroupId_idx" ON "MarketplaceCheckoutLineSnapshot"("storeGroupId");
CREATE INDEX "StoreSellerLegalIdentity_storeId_status_effectiveFrom_idx" ON "StoreSellerLegalIdentity"("storeId", "status", "effectiveFrom");
CREATE INDEX "MarketplaceCheckoutStoreSettlementEvidence_checkoutId_reviewVersion_idx" ON "MarketplaceCheckoutStoreSettlementEvidence"("checkoutId", "reviewVersion");
CREATE INDEX "MarketplaceCheckoutSettlementLineAllocation_evidence_rounding_idx" ON "MarketplaceCheckoutSettlementLineAllocation"("settlementEvidenceId", "roundingSequence");
CREATE INDEX "MarketplaceCheckoutModifierSnapshot_checkoutLineSnapshotId_idx" ON "MarketplaceCheckoutModifierSnapshot"("checkoutLineSnapshotId");
CREATE INDEX "MarketplaceCheckoutChange_checkoutId_reviewVersion_acknowledgedAt_idx" ON "MarketplaceCheckoutChange"("checkoutId", "reviewVersion", "acknowledgedAt");
CREATE INDEX "MarketplaceCheckoutOperation_createdAt_idx" ON "MarketplaceCheckoutOperation"("createdAt");
CREATE INDEX "MarketplaceCheckoutAcknowledgement_checkoutId_acknowledgedAt_idx" ON "MarketplaceCheckoutAcknowledgement"("checkoutId", "acknowledgedAt");
CREATE INDEX "MarketplaceInventoryReservation_checkoutId_status_idx" ON "MarketplaceInventoryReservation"("checkoutId", "status");
CREATE INDEX "MarketplaceInventoryReservation_status_expiresAt_idx" ON "MarketplaceInventoryReservation"("status", "expiresAt");
CREATE INDEX "MarketplaceInventoryReservationItem_inventoryLevelId_idx" ON "MarketplaceInventoryReservationItem"("inventoryLevelId");
CREATE INDEX "MarketplaceOrder_customerUserId_createdAt_idx" ON "MarketplaceOrder"("customerUserId", "createdAt");
CREATE INDEX "MarketplaceOrder_status_createdAt_idx" ON "MarketplaceOrder"("status", "createdAt");
CREATE INDEX "MarketplaceStoreOrder_storeId_status_idx" ON "MarketplaceStoreOrder"("storeId", "status");
CREATE INDEX "MarketplaceOrderLine_marketplaceStoreOrderId_idx" ON "MarketplaceOrderLine"("marketplaceStoreOrderId");
CREATE INDEX "MarketplaceOrderLineModifier_marketplaceOrderLineId_idx" ON "MarketplaceOrderLineModifier"("marketplaceOrderLineId");
CREATE INDEX "MarketplaceOrderLineFinancialAllocation_line_rounding_idx" ON "MarketplaceOrderLineFinancialAllocation"("marketplaceOrderLineId", "roundingSequence");
CREATE INDEX "MarketplaceSettlementSnapshot_status_createdAt_idx" ON "MarketplaceSettlementSnapshot"("status", "createdAt");
CREATE INDEX "MarketplaceStoreSettlementJob_status_nextAttemptAt_createdAt_idx" ON "MarketplaceStoreSettlementJob"("status", "nextAttemptAt", "createdAt");
CREATE INDEX "MarketplaceSettlementHistory_snapshot_createdAt_idx" ON "MarketplaceSettlementHistory"("settlementSnapshotId", "createdAt");
CREATE INDEX "MarketplaceCheckoutReconciliationCase_status_createdAt_idx" ON "MarketplaceCheckoutReconciliationCase"("status", "createdAt");
CREATE INDEX "MarketplaceCheckoutReconciliationCase_paymentId_idx" ON "MarketplaceCheckoutReconciliationCase"("paymentId");
CREATE INDEX "MarketplaceCheckoutReconciliationCase_storeOrderId_idx" ON "MarketplaceCheckoutReconciliationCase"("marketplaceStoreOrderId");
CREATE INDEX "MarketplaceCheckoutReconciliationCase_reservationId_idx" ON "MarketplaceCheckoutReconciliationCase"("reservationId");
CREATE INDEX "Payment_subjectType_marketplaceCheckoutId_idx" ON "Payment"("subjectType", "marketplaceCheckoutId");

ALTER TABLE "MarketplaceCart" ADD CONSTRAINT "MarketplaceCart_customer_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCart" ADD CONSTRAINT "MarketplaceCart_mergedInto_fkey" FOREIGN KEY ("mergedIntoCartId") REFERENCES "MarketplaceCart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCartStoreGroup" ADD CONSTRAINT "MarketplaceCartStoreGroup_cart_fkey" FOREIGN KEY ("cartId") REFERENCES "MarketplaceCart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCartStoreGroup" ADD CONSTRAINT "MarketplaceCartStoreGroup_store_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCartLine" ADD CONSTRAINT "MarketplaceCartLine_cart_fkey" FOREIGN KEY ("cartId") REFERENCES "MarketplaceCart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCartLine" ADD CONSTRAINT "MarketplaceCartLine_group_fkey" FOREIGN KEY ("storeGroupId") REFERENCES "MarketplaceCartStoreGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCartLineModifier" ADD CONSTRAINT "MarketplaceCartLineModifier_line_fkey" FOREIGN KEY ("cartLineId") REFERENCES "MarketplaceCartLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCartOperation" ADD CONSTRAINT "MarketplaceCartOperation_cart_fkey" FOREIGN KEY ("cartId") REFERENCES "MarketplaceCart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCheckout" ADD CONSTRAINT "MarketplaceCheckout_cart_fkey" FOREIGN KEY ("cartId") REFERENCES "MarketplaceCart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCheckout" ADD CONSTRAINT "MarketplaceCheckout_customer_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCheckout" ADD CONSTRAINT "MarketplaceCheckout_contact_fkey" FOREIGN KEY ("contactSnapshotId") REFERENCES "MarketplaceCheckoutContactSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCheckout" ADD CONSTRAINT "MarketplaceCheckout_address_fkey" FOREIGN KEY ("addressSnapshotId") REFERENCES "MarketplaceCheckoutAddressSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCheckoutStoreGroup" ADD CONSTRAINT "MarketplaceCheckoutStoreGroup_checkout_fkey" FOREIGN KEY ("checkoutId") REFERENCES "MarketplaceCheckout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCheckoutStoreGroup" ADD CONSTRAINT "MarketplaceCheckoutStoreGroup_store_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreSellerLegalIdentity" ADD CONSTRAINT "StoreSellerLegalIdentity_store_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCheckoutLineSnapshot" ADD CONSTRAINT "MarketplaceCheckoutLineSnapshot_checkout_fkey" FOREIGN KEY ("checkoutId") REFERENCES "MarketplaceCheckout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCheckoutLineSnapshot" ADD CONSTRAINT "MarketplaceCheckoutLineSnapshot_group_fkey" FOREIGN KEY ("storeGroupId") REFERENCES "MarketplaceCheckoutStoreGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCheckoutModifierSnapshot" ADD CONSTRAINT "MarketplaceCheckoutModifierSnapshot_line_fkey" FOREIGN KEY ("checkoutLineSnapshotId") REFERENCES "MarketplaceCheckoutLineSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCheckoutStoreSettlementEvidence" ADD CONSTRAINT "MarketplaceCheckoutStoreSettlementEvidence_checkout_fkey" FOREIGN KEY ("checkoutId") REFERENCES "MarketplaceCheckout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCheckoutStoreSettlementEvidence" ADD CONSTRAINT "MarketplaceCheckoutStoreSettlementEvidence_group_fkey" FOREIGN KEY ("checkoutStoreGroupId") REFERENCES "MarketplaceCheckoutStoreGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCheckoutSettlementLineAllocation" ADD CONSTRAINT "MarketplaceCheckoutSettlementLineAllocation_evidence_fkey" FOREIGN KEY ("settlementEvidenceId") REFERENCES "MarketplaceCheckoutStoreSettlementEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCheckoutSettlementLineAllocation" ADD CONSTRAINT "MarketplaceCheckoutSettlementLineAllocation_line_fkey" FOREIGN KEY ("checkoutLineSnapshotId") REFERENCES "MarketplaceCheckoutLineSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCheckoutChange" ADD CONSTRAINT "MarketplaceCheckoutChange_checkout_fkey" FOREIGN KEY ("checkoutId") REFERENCES "MarketplaceCheckout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCheckoutOperation" ADD CONSTRAINT "MarketplaceCheckoutOperation_checkout_fkey" FOREIGN KEY ("checkoutId") REFERENCES "MarketplaceCheckout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCheckoutAcknowledgement" ADD CONSTRAINT "MarketplaceCheckoutAcknowledgement_checkout_fkey" FOREIGN KEY ("checkoutId") REFERENCES "MarketplaceCheckout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceInventoryReservation" ADD CONSTRAINT "MarketplaceInventoryReservation_checkout_fkey" FOREIGN KEY ("checkoutId") REFERENCES "MarketplaceCheckout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceInventoryReservation" ADD CONSTRAINT "MarketplaceInventoryReservation_payment_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceInventoryReservationItem" ADD CONSTRAINT "MarketplaceInventoryReservationItem_reservation_fkey" FOREIGN KEY ("reservationId") REFERENCES "MarketplaceInventoryReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceInventoryReservationItem" ADD CONSTRAINT "MarketplaceInventoryReservationItem_level_fkey" FOREIGN KEY ("inventoryLevelId") REFERENCES "CatalogInventoryLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_marketplaceCheckout_fkey" FOREIGN KEY ("marketplaceCheckoutId") REFERENCES "MarketplaceCheckout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_marketplaceOrder_fkey" FOREIGN KEY ("marketplaceOrderId") REFERENCES "MarketplaceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_checkout_fkey" FOREIGN KEY ("checkoutId") REFERENCES "MarketplaceCheckout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_payment_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_customer_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrder" ADD CONSTRAINT "MarketplaceStoreOrder_order_fkey" FOREIGN KEY ("marketplaceOrderId") REFERENCES "MarketplaceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrder" ADD CONSTRAINT "MarketplaceStoreOrder_group_fkey" FOREIGN KEY ("checkoutStoreGroupId") REFERENCES "MarketplaceCheckoutStoreGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrder" ADD CONSTRAINT "MarketplaceStoreOrder_store_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceOrderLine" ADD CONSTRAINT "MarketplaceOrderLine_storeOrder_fkey" FOREIGN KEY ("marketplaceStoreOrderId") REFERENCES "MarketplaceStoreOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceOrderLineModifier" ADD CONSTRAINT "MarketplaceOrderLineModifier_line_fkey" FOREIGN KEY ("marketplaceOrderLineId") REFERENCES "MarketplaceOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceOrderLineFinancialAllocation" ADD CONSTRAINT "MarketplaceOrderLineFinancialAllocation_line_fkey" FOREIGN KEY ("marketplaceOrderLineId") REFERENCES "MarketplaceOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceSettlementSnapshot" ADD CONSTRAINT "MarketplaceSettlementSnapshot_storeOrder_fkey" FOREIGN KEY ("marketplaceStoreOrderId") REFERENCES "MarketplaceStoreOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceSettlementSnapshot" ADD CONSTRAINT "MarketplaceSettlementSnapshot_sourceCheckout_fkey" FOREIGN KEY ("sourceCheckoutId") REFERENCES "MarketplaceCheckout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceSettlementSnapshot" ADD CONSTRAINT "MarketplaceSettlementSnapshot_sourceGroup_fkey" FOREIGN KEY ("sourceCheckoutStoreGroupId") REFERENCES "MarketplaceCheckoutStoreGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceSettlementSnapshot" ADD CONSTRAINT "MarketplaceSettlementSnapshot_sourceEvidence_fkey" FOREIGN KEY ("sourceSettlementEvidenceId") REFERENCES "MarketplaceCheckoutStoreSettlementEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceSettlementSnapshot" ADD CONSTRAINT "MarketplaceSettlementSnapshot_sourcePayment_fkey" FOREIGN KEY ("sourcePaymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceSettlementAllocation" ADD CONSTRAINT "MarketplaceSettlementAllocation_snapshot_fkey" FOREIGN KEY ("settlementSnapshotId") REFERENCES "MarketplaceSettlementSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreSettlementJob" ADD CONSTRAINT "MarketplaceStoreSettlementJob_storeOrder_fkey" FOREIGN KEY ("marketplaceStoreOrderId") REFERENCES "MarketplaceStoreOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreSettlementJob" ADD CONSTRAINT "MarketplaceStoreSettlementJob_snapshot_fkey" FOREIGN KEY ("settlementSnapshotId") REFERENCES "MarketplaceSettlementSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreSettlementJob" ADD CONSTRAINT "MarketplaceStoreSettlementJob_reconciliation_fkey" FOREIGN KEY ("reconciliationCaseId") REFERENCES "MarketplaceCheckoutReconciliationCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceSettlementHistory" ADD CONSTRAINT "MarketplaceSettlementHistory_snapshot_fkey" FOREIGN KEY ("settlementSnapshotId") REFERENCES "MarketplaceSettlementSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCheckoutReconciliationCase" ADD CONSTRAINT "MarketplaceCheckoutReconciliationCase_checkout_fkey" FOREIGN KEY ("checkoutId") REFERENCES "MarketplaceCheckout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCheckoutReconciliationCase" ADD CONSTRAINT "MarketplaceCheckoutReconciliationCase_order_fkey" FOREIGN KEY ("marketplaceOrderId") REFERENCES "MarketplaceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCheckoutReconciliationCase" ADD CONSTRAINT "MarketplaceCheckoutReconciliationCase_payment_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCheckoutReconciliationCase" ADD CONSTRAINT "MarketplaceCheckoutReconciliationCase_storeOrder_fkey" FOREIGN KEY ("marketplaceStoreOrderId") REFERENCES "MarketplaceStoreOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCheckoutReconciliationCase" ADD CONSTRAINT "MarketplaceCheckoutReconciliationCase_reservation_fkey" FOREIGN KEY ("reservationId") REFERENCES "MarketplaceInventoryReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "MarketplaceCheckout_snapshot_immutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Phase 20 snapshot evidence is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "MarketplaceSettlementSnapshot_evidence_guard"() RETURNS trigger AS $$
BEGIN
  IF NEW."marketplaceStoreOrderId" IS DISTINCT FROM OLD."marketplaceStoreOrderId"
     OR NEW."settlementVersion" IS DISTINCT FROM OLD."settlementVersion"
     OR NEW."sourceCheckoutId" IS DISTINCT FROM OLD."sourceCheckoutId"
     OR NEW."sourceCheckoutReviewVersion" IS DISTINCT FROM OLD."sourceCheckoutReviewVersion"
     OR NEW."sourceCheckoutStoreGroupId" IS DISTINCT FROM OLD."sourceCheckoutStoreGroupId"
     OR NEW."sourceSettlementEvidenceId" IS DISTINCT FROM OLD."sourceSettlementEvidenceId"
     OR NEW."sourceCommercialFingerprint" IS DISTINCT FROM OLD."sourceCommercialFingerprint"
     OR NEW."sourcePaymentId" IS DISTINCT FROM OLD."sourcePaymentId"
     OR NEW."commissionPlanReference" IS DISTINCT FROM OLD."commissionPlanReference"
     OR NEW."commissionPlanVersion" IS DISTINCT FROM OLD."commissionPlanVersion"
     OR NEW."sellerBasis" IS DISTINCT FROM OLD."sellerBasis"
     OR NEW."commissionAmount" IS DISTINCT FROM OLD."commissionAmount"
     OR NEW."storeEarningAmount" IS DISTINCT FROM OLD."storeEarningAmount"
     OR NEW."deliveryFeeResidual" IS DISTINCT FROM OLD."deliveryFeeResidual"
     OR NEW."currency" IS DISTINCT FROM OLD."currency"
     OR NEW."authoritativeAt" IS DISTINCT FROM OLD."authoritativeAt"
     OR NEW."sourceEvidenceFingerprint" IS DISTINCT FROM OLD."sourceEvidenceFingerprint" THEN
    RAISE EXCEPTION 'Marketplace settlement evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "MarketplaceCheckout_terminal_cart_guard"() RETURNS trigger AS $$
BEGIN
  IF OLD."status" IN ('CONVERTED', 'MERGED', 'ABANDONED', 'EXPIRED') THEN
    RAISE EXCEPTION 'Terminal marketplace carts are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "MarketplaceCheckout_evidence_delete_guard"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Marketplace financial and order evidence cannot be deleted';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "MarketplaceCheckout_payment_subject_guard"() RETURNS trigger AS $$
DECLARE
  checkout_customer_id TEXT;
  checkout_guest_hash TEXT;
  order_checkout_id TEXT;
BEGIN
  IF NEW."subjectType" = 'COURIER_ORDER' THEN
    IF NEW."orderId" IS NULL OR NEW."userId" IS NULL OR NEW."marketplaceCheckoutId" IS NOT NULL OR NEW."marketplaceOrderId" IS NOT NULL THEN
      RAISE EXCEPTION 'Courier payments require exactly one courier order and payer';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW."orderId" IS NOT NULL OR NEW."marketplaceCheckoutId" IS NULL THEN
    RAISE EXCEPTION 'Marketplace payments require exactly one marketplace checkout';
  END IF;
  SELECT "customerUserId", "guestAccessTokenHash" INTO checkout_customer_id, checkout_guest_hash FROM "MarketplaceCheckout" WHERE "id" = NEW."marketplaceCheckoutId";
  IF checkout_customer_id IS NULL AND checkout_guest_hash IS NULL THEN
    RAISE EXCEPTION 'Guest marketplace payment lacks checkout ownership evidence';
  END IF;
  IF checkout_customer_id IS NOT NULL AND NEW."userId" IS DISTINCT FROM checkout_customer_id THEN
    RAISE EXCEPTION 'Authenticated marketplace payer does not match checkout';
  END IF;
  IF checkout_customer_id IS NULL AND NEW."userId" IS NOT NULL THEN
    RAISE EXCEPTION 'Guest marketplace payment cannot carry a user id';
  END IF;
  IF NEW."marketplaceOrderId" IS NOT NULL THEN
    SELECT "checkoutId" INTO order_checkout_id FROM "MarketplaceOrder" WHERE "id" = NEW."marketplaceOrderId";
    IF order_checkout_id IS DISTINCT FROM NEW."marketplaceCheckoutId" THEN
      RAISE EXCEPTION 'Marketplace payment order belongs to another checkout';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "MarketplaceCart_terminal_guard" BEFORE UPDATE ON "MarketplaceCart"
FOR EACH ROW EXECUTE FUNCTION "MarketplaceCheckout_terminal_cart_guard"();
CREATE TRIGGER "Payment_subject_guard" BEFORE INSERT OR UPDATE ON "Payment"
FOR EACH ROW EXECUTE FUNCTION "MarketplaceCheckout_payment_subject_guard"();
CREATE TRIGGER "MarketplaceCheckoutLineSnapshot_immutable" BEFORE UPDATE OR DELETE ON "MarketplaceCheckoutLineSnapshot"
FOR EACH ROW EXECUTE FUNCTION "MarketplaceCheckout_snapshot_immutable"();
CREATE TRIGGER "MarketplaceCheckoutModifierSnapshot_immutable" BEFORE UPDATE OR DELETE ON "MarketplaceCheckoutModifierSnapshot"
FOR EACH ROW EXECUTE FUNCTION "MarketplaceCheckout_snapshot_immutable"();
CREATE TRIGGER "MarketplaceCheckoutStoreSettlementEvidence_immutable" BEFORE UPDATE OR DELETE ON "MarketplaceCheckoutStoreSettlementEvidence"
FOR EACH ROW EXECUTE FUNCTION "MarketplaceCheckout_snapshot_immutable"();
CREATE TRIGGER "MarketplaceCheckoutSettlementLineAllocation_immutable" BEFORE UPDATE OR DELETE ON "MarketplaceCheckoutSettlementLineAllocation"
FOR EACH ROW EXECUTE FUNCTION "MarketplaceCheckout_snapshot_immutable"();
CREATE TRIGGER "MarketplaceCheckoutAcknowledgement_immutable" BEFORE UPDATE OR DELETE ON "MarketplaceCheckoutAcknowledgement"
FOR EACH ROW EXECUTE FUNCTION "MarketplaceCheckout_snapshot_immutable"();
CREATE TRIGGER "MarketplaceOrderLine_immutable" BEFORE UPDATE OR DELETE ON "MarketplaceOrderLine"
FOR EACH ROW EXECUTE FUNCTION "MarketplaceCheckout_snapshot_immutable"();
CREATE TRIGGER "MarketplaceOrderLineModifier_immutable" BEFORE UPDATE OR DELETE ON "MarketplaceOrderLineModifier"
FOR EACH ROW EXECUTE FUNCTION "MarketplaceCheckout_snapshot_immutable"();
CREATE TRIGGER "MarketplaceOrderLineFinancialAllocation_immutable" BEFORE UPDATE OR DELETE ON "MarketplaceOrderLineFinancialAllocation"
FOR EACH ROW EXECUTE FUNCTION "MarketplaceCheckout_snapshot_immutable"();
CREATE TRIGGER "MarketplaceOrder_delete_guard" BEFORE DELETE ON "MarketplaceOrder"
FOR EACH ROW EXECUTE FUNCTION "MarketplaceCheckout_evidence_delete_guard"();
CREATE TRIGGER "MarketplaceStoreOrder_delete_guard" BEFORE DELETE ON "MarketplaceStoreOrder"
FOR EACH ROW EXECUTE FUNCTION "MarketplaceCheckout_evidence_delete_guard"();
CREATE TRIGGER "MarketplaceSettlementSnapshot_delete_guard" BEFORE DELETE ON "MarketplaceSettlementSnapshot"
FOR EACH ROW EXECUTE FUNCTION "MarketplaceCheckout_evidence_delete_guard"();
CREATE TRIGGER "MarketplaceSettlementSnapshot_evidence_guard" BEFORE UPDATE ON "MarketplaceSettlementSnapshot"
FOR EACH ROW EXECUTE FUNCTION "MarketplaceSettlementSnapshot_evidence_guard"();
CREATE TRIGGER "MarketplaceSettlementHistory_immutable" BEFORE UPDATE OR DELETE ON "MarketplaceSettlementHistory"
FOR EACH ROW EXECUTE FUNCTION "MarketplaceCheckout_snapshot_immutable"();
CREATE TRIGGER "MarketplaceSettlementAllocation_delete_guard" BEFORE DELETE ON "MarketplaceSettlementAllocation"
FOR EACH ROW EXECUTE FUNCTION "MarketplaceCheckout_evidence_delete_guard"();
