-- Forward-only Schema Alignment Migration: 20260805070000_comprehensive_schema_reconciliation
-- Comprehensive Gate 3 schema reconciliation for 388 structural differences.

-- 1. Preflight Validations (Fail-closed on duplicate unique keys or orphan FK references)
DO $$
DECLARE
  duplicate_catalog_products INT;
  duplicate_catalog_media INT;
  orphan_promoter_accounts INT;
  orphan_promoter_agreements INT;
  orphan_promoter_programs INT;
BEGIN
  SELECT COUNT(*)::int INTO duplicate_catalog_products
  FROM (
    SELECT "scope", "sourceStoreId", "slug"
    FROM "CatalogProduct"
    GROUP BY "scope", "sourceStoreId", "slug"
    HAVING COUNT(*) > 1
  ) c;
  IF duplicate_catalog_products > 0 THEN
    RAISE EXCEPTION 'Preflight failed: % duplicate CatalogProduct records exist for (scope, sourceStoreId, slug).', duplicate_catalog_products;
  END IF;

  SELECT COUNT(*)::int INTO duplicate_catalog_media
  FROM (
    SELECT "productId", "variantId", "assetId", "role"
    FROM "CatalogProductMedia"
    GROUP BY "productId", "variantId", "assetId", "role"
    HAVING COUNT(*) > 1
  ) c;
  IF duplicate_catalog_media > 0 THEN
    RAISE EXCEPTION 'Preflight failed: % duplicate CatalogProductMedia records exist for (productId, variantId, assetId, role).', duplicate_catalog_media;
  END IF;

  SELECT COUNT(*)::int INTO orphan_promoter_accounts
  FROM "PromoterAccount" pa
  LEFT JOIN "User" u ON u."id" = pa."userId"
  WHERE u."id" IS NULL;
  IF orphan_promoter_accounts > 0 THEN
    RAISE EXCEPTION 'Preflight failed: % orphan PromoterAccount records exist for userId.', orphan_promoter_accounts;
  END IF;

  SELECT COUNT(*)::int INTO orphan_promoter_agreements
  FROM "PromoterAgreementVersion" pav
  LEFT JOIN "User" u ON u."id" = pav."approvedByUserId"
  WHERE pav."approvedByUserId" IS NOT NULL AND u."id" IS NULL;
  IF orphan_promoter_agreements > 0 THEN
    RAISE EXCEPTION 'Preflight failed: % orphan PromoterAgreementVersion records exist for approvedByUserId.', orphan_promoter_agreements;
  END IF;

  SELECT COUNT(*)::int INTO orphan_promoter_programs
  FROM "PromoterProgramVersion" ppv
  LEFT JOIN "User" u ON u."id" = ppv."approvedByUserId"
  WHERE ppv."approvedByUserId" IS NOT NULL AND u."id" IS NULL;
  IF orphan_promoter_programs > 0 THEN
    RAISE EXCEPTION 'Preflight failed: % orphan PromoterProgramVersion records exist for approvedByUserId.', orphan_promoter_programs;
  END IF;
END $$;

-- 2. Add Missing Unique Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "CatalogProduct_scope_sourceStoreId_slug_key"
  ON "CatalogProduct"("scope", "sourceStoreId", "slug");

CREATE UNIQUE INDEX IF NOT EXISTS "CatalogProductMedia_productId_variantId_assetId_role_key"
  ON "CatalogProductMedia"("productId", "variantId", "assetId", "role");

-- 3. Add 118 Missing Non-Unique Indexes
CREATE INDEX IF NOT EXISTS "CatalogInventoryLevel_available_idx" ON "CatalogInventoryLevel"("available");
CREATE INDEX IF NOT EXISTS "CatalogInventoryMovement_actorUserId_createdAt_idx" ON "CatalogInventoryMovement"("actorUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "CatalogModerationCase_productId_status_idx" ON "CatalogModerationCase"("productId", "status");
CREATE INDEX IF NOT EXISTS "CatalogModerationCase_offerId_status_idx" ON "CatalogModerationCase"("offerId", "status");
CREATE INDEX IF NOT EXISTS "CatalogModerationHistory_actorUserId_createdAt_idx" ON "CatalogModerationHistory"("actorUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "CatalogProductMedia_productId_role_displayOrder_idx" ON "CatalogProductMedia"("productId", "role", "displayOrder");
CREATE INDEX IF NOT EXISTS "CatalogProductMedia_variantId_role_displayOrder_idx" ON "CatalogProductMedia"("variantId", "role", "displayOrder");
CREATE INDEX IF NOT EXISTS "CatalogProductMedia_assetId_idx" ON "CatalogProductMedia"("assetId");
CREATE INDEX IF NOT EXISTS "CatalogProductOption_productId_displayOrder_idx" ON "CatalogProductOption"("productId", "displayOrder");
CREATE INDEX IF NOT EXISTS "CatalogProductOptionValue_optionId_displayOrder_idx" ON "CatalogProductOptionValue"("optionId", "displayOrder");
CREATE INDEX IF NOT EXISTS "CatalogProductVariant_mpn_idx" ON "CatalogProductVariant"("mpn");
CREATE INDEX IF NOT EXISTS "CatalogPublicationSnapshot_productId_variantId_idx" ON "CatalogPublicationSnapshot"("productId", "variantId");
CREATE INDEX IF NOT EXISTS "CatalogPublicationSnapshot_status_createdAt_idx" ON "CatalogPublicationSnapshot"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "DeveloperApiAuditEvent_eventType_createdAt_idx" ON "DeveloperApiAuditEvent"("eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "DeveloperApiCredentialRotation_previousCredentialId_idx" ON "DeveloperApiCredentialRotation"("previousCredentialId");
CREATE INDEX IF NOT EXISTS "DeveloperApiIdempotencyRecord_expiresAt_idx" ON "DeveloperApiIdempotencyRecord"("expiresAt");
CREATE INDEX IF NOT EXISTS "DeveloperApplication_storeId_status_idx" ON "DeveloperApplication"("storeId", "status");
CREATE INDEX IF NOT EXISTS "DeveloperApplicationReview_applicationId_createdAt_idx" ON "DeveloperApplicationReview"("applicationId", "createdAt");
CREATE INDEX IF NOT EXISTS "DeveloperScopeGrant_applicationId_status_idx" ON "DeveloperScopeGrant"("applicationId", "status");
CREATE INDEX IF NOT EXISTS "DeveloperTermsAcceptance_ownerUserId_acceptedAt_idx" ON "DeveloperTermsAcceptance"("ownerUserId", "acceptedAt");
CREATE INDEX IF NOT EXISTS "DeveloperWebhookSecret_subscriptionId_status_idx" ON "DeveloperWebhookSecret"("subscriptionId", "status");
CREATE INDEX IF NOT EXISTS "InventoryLocation_storeId_status_idx" ON "InventoryLocation"("storeId", "status");
CREATE INDEX IF NOT EXISTS "InventoryLocation_storeId_isPrimary_idx" ON "InventoryLocation"("storeId", "isPrimary");
CREATE INDEX IF NOT EXISTS "NotificationAuditEvent_eventType_createdAt_idx" ON "NotificationAuditEvent"("eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "NotificationConsentRecord_userId_channel_purpose_status_idx" ON "NotificationConsentRecord"("userId", "channel", "purpose", "status");
CREATE INDEX IF NOT EXISTS "NotificationEventIntent_sourceAuthority_eventType_idx" ON "NotificationEventIntent"("sourceAuthority", "eventType");
CREATE INDEX IF NOT EXISTS "NotificationEventRouteVersion_routeId_status_idx" ON "NotificationEventRouteVersion"("routeId", "status");
CREATE INDEX IF NOT EXISTS "NotificationMessage_recipientUserId_createdAt_idx" ON "NotificationMessage"("recipientUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "NotificationSuppression_channel_purpose_active_idx" ON "NotificationSuppression"("channel", "purpose", "active");
CREATE INDEX IF NOT EXISTS "NotificationTemplate_categoryKey_idx" ON "NotificationTemplate"("categoryKey");
CREATE INDEX IF NOT EXISTS "NotificationTemplateVersion_templateId_status_idx" ON "NotificationTemplateVersion"("templateId", "status");
CREATE INDEX IF NOT EXISTS "RecruitmentAccommodationRequest_applicationId_idx" ON "RecruitmentAccommodationRequest"("applicationId");
CREATE INDEX IF NOT EXISTS "RecruitmentAccommodationRequest_status_idx" ON "RecruitmentAccommodationRequest"("status");
CREATE INDEX IF NOT EXISTS "RecruitmentApplicantDataRequest_applicantProfileId_idx" ON "RecruitmentApplicantDataRequest"("applicantProfileId");
CREATE INDEX IF NOT EXISTS "RecruitmentApplicantDataRequest_requestType_idx" ON "RecruitmentApplicantDataRequest"("requestType");
CREATE INDEX IF NOT EXISTS "RecruitmentApplicantDataRequest_status_idx" ON "RecruitmentApplicantDataRequest"("status");
CREATE INDEX IF NOT EXISTS "RecruitmentApplicantProfile_userId_idx" ON "RecruitmentApplicantProfile"("userId");
CREATE INDEX IF NOT EXISTS "RecruitmentApplicantProfile_profileStatus_idx" ON "RecruitmentApplicantProfile"("profileStatus");
CREATE INDEX IF NOT EXISTS "RecruitmentApplication_applicantProfileId_idx" ON "RecruitmentApplication"("applicantProfileId");
CREATE INDEX IF NOT EXISTS "RecruitmentApplication_openingId_idx" ON "RecruitmentApplication"("openingId");
CREATE INDEX IF NOT EXISTS "RecruitmentApplication_openingVersionId_idx" ON "RecruitmentApplication"("openingVersionId");
CREATE INDEX IF NOT EXISTS "RecruitmentApplication_status_idx" ON "RecruitmentApplication"("status");
CREATE INDEX IF NOT EXISTS "RecruitmentApplicationDocument_applicationId_idx" ON "RecruitmentApplicationDocument"("applicationId");
CREATE INDEX IF NOT EXISTS "RecruitmentApplicationDocument_documentCategory_idx" ON "RecruitmentApplicationDocument"("documentCategory");
CREATE INDEX IF NOT EXISTS "RecruitmentApplicationQuestionVersion_sectionVersionId_idx" ON "RecruitmentApplicationQuestionVersion"("sectionVersionId");
CREATE INDEX IF NOT EXISTS "RecruitmentApplicationSectionVersion_formVersionId_idx" ON "RecruitmentApplicationSectionVersion"("formVersionId");
CREATE INDEX IF NOT EXISTS "RecruitmentCheckCase_applicationId_idx" ON "RecruitmentCheckCase"("applicationId");
CREATE INDEX IF NOT EXISTS "RecruitmentCheckCase_checkType_idx" ON "RecruitmentCheckCase"("checkType");
CREATE INDEX IF NOT EXISTS "RecruitmentCheckCase_status_idx" ON "RecruitmentCheckCase"("status");
CREATE INDEX IF NOT EXISTS "RecruitmentConsentRecord_applicantProfileId_idx" ON "RecruitmentConsentRecord"("applicantProfileId");
CREATE INDEX IF NOT EXISTS "RecruitmentConsentRecord_applicationId_idx" ON "RecruitmentConsentRecord"("applicationId");
CREATE INDEX IF NOT EXISTS "RecruitmentConsentRecord_consentType_status_idx" ON "RecruitmentConsentRecord"("consentType", "status");
CREATE INDEX IF NOT EXISTS "RecruitmentDecision_applicationId_idx" ON "RecruitmentDecision"("applicationId");
CREATE INDEX IF NOT EXISTS "RecruitmentDecision_reviewerUserId_idx" ON "RecruitmentDecision"("reviewerUserId");
CREATE INDEX IF NOT EXISTS "RecruitmentDecision_decisionType_idx" ON "RecruitmentDecision"("decisionType");
CREATE INDEX IF NOT EXISTS "RecruitmentEmploymentEquityDeclaration_applicantProfileId_idx" ON "RecruitmentEmploymentEquityDeclaration"("applicantProfileId");
CREATE INDEX IF NOT EXISTS "RecruitmentEmploymentEquityDeclaration_applicationId_idx" ON "RecruitmentEmploymentEquityDeclaration"("applicationId");
CREATE INDEX IF NOT EXISTS "RecruitmentEventIntent_eventType_idx" ON "RecruitmentEventIntent"("eventType");
CREATE INDEX IF NOT EXISTS "RecruitmentEventIntent_aggregateReference_idx" ON "RecruitmentEventIntent"("aggregateReference");
CREATE INDEX IF NOT EXISTS "RecruitmentFraudCase_applicationId_idx" ON "RecruitmentFraudCase"("applicationId");
CREATE INDEX IF NOT EXISTS "RecruitmentFraudCase_outcome_idx" ON "RecruitmentFraudCase"("outcome");
CREATE INDEX IF NOT EXISTS "RecruitmentInterview_applicationId_idx" ON "RecruitmentInterview"("applicationId");
CREATE INDEX IF NOT EXISTS "RecruitmentInterview_interviewPlanId_idx" ON "RecruitmentInterview"("interviewPlanId");
CREATE INDEX IF NOT EXISTS "RecruitmentInterview_status_idx" ON "RecruitmentInterview"("status");
CREATE INDEX IF NOT EXISTS "RecruitmentInterviewPanelMember_interviewId_idx" ON "RecruitmentInterviewPanelMember"("interviewId");
CREATE INDEX IF NOT EXISTS "RecruitmentInterviewPlan_openingVersionId_idx" ON "RecruitmentInterviewPlan"("openingVersionId");
CREATE INDEX IF NOT EXISTS "RecruitmentInterviewSlot_openingId_idx" ON "RecruitmentInterviewSlot"("openingId");
CREATE INDEX IF NOT EXISTS "RecruitmentInterviewSlot_startTime_idx" ON "RecruitmentInterviewSlot"("startTime");
CREATE INDEX IF NOT EXISTS "RecruitmentOffer_applicationId_idx" ON "RecruitmentOffer"("applicationId");
CREATE INDEX IF NOT EXISTS "RecruitmentOffer_status_idx" ON "RecruitmentOffer"("status");
CREATE INDEX IF NOT EXISTS "RecruitmentOfferVersion_offerId_idx" ON "RecruitmentOfferVersion"("offerId");
CREATE INDEX IF NOT EXISTS "RecruitmentOfferVersion_status_idx" ON "RecruitmentOfferVersion"("status");
CREATE INDEX IF NOT EXISTS "RecruitmentOnboardingHandoff_applicationId_idx" ON "RecruitmentOnboardingHandoff"("applicationId");
CREATE INDEX IF NOT EXISTS "RecruitmentOnboardingHandoff_status_idx" ON "RecruitmentOnboardingHandoff"("status");
CREATE INDEX IF NOT EXISTS "RecruitmentOnboardingHandoff_targetType_idx" ON "RecruitmentOnboardingHandoff"("targetType");
CREATE INDEX IF NOT EXISTS "RecruitmentOpeningVersion_openingId_idx" ON "RecruitmentOpeningVersion"("openingId");
CREATE INDEX IF NOT EXISTS "RecruitmentOpeningVersion_status_idx" ON "RecruitmentOpeningVersion"("status");
CREATE INDEX IF NOT EXISTS "RecruitmentReconciliationCase_reason_idx" ON "RecruitmentReconciliationCase"("reason");
CREATE INDEX IF NOT EXISTS "RecruitmentReconciliationCase_status_idx" ON "RecruitmentReconciliationCase"("status");
CREATE INDEX IF NOT EXISTS "RecruitmentReviewAssignment_applicationId_idx" ON "RecruitmentReviewAssignment"("applicationId");
CREATE INDEX IF NOT EXISTS "RecruitmentReviewAssignment_reviewerUserId_idx" ON "RecruitmentReviewAssignment"("reviewerUserId");
CREATE INDEX IF NOT EXISTS "RecruitmentReviewAssignment_status_idx" ON "RecruitmentReviewAssignment"("status");
CREATE INDEX IF NOT EXISTS "RecruitmentRubricCriteria_rubricVersionId_idx" ON "RecruitmentRubricCriteria"("rubricVersionId");
CREATE INDEX IF NOT EXISTS "RecruitmentScorecard_interviewId_idx" ON "RecruitmentScorecard"("interviewId");
CREATE INDEX IF NOT EXISTS "RecruitmentSubmittedAnswer_applicationId_idx" ON "RecruitmentSubmittedAnswer"("applicationId");
CREATE INDEX IF NOT EXISTS "StoreCatalogOffer_productId_variantId_idx" ON "StoreCatalogOffer"("productId", "variantId");
CREATE INDEX IF NOT EXISTS "StoreCatalogOffer_publicationStatus_status_idx" ON "StoreCatalogOffer"("publicationStatus", "status");
CREATE INDEX IF NOT EXISTS "StoreCatalogOffer_currentPriceVersionId_idx" ON "StoreCatalogOffer"("currentPriceVersionId");
CREATE INDEX IF NOT EXISTS "StoreCatalogOffer_primaryInventoryLocationId_idx" ON "StoreCatalogOffer"("primaryInventoryLocationId");
CREATE INDEX IF NOT EXISTS "StoreModifierGroup_storeId_status_idx" ON "StoreModifierGroup"("storeId", "status");
CREATE INDEX IF NOT EXISTS "StoreModifierOption_groupId_status_displayOrder_idx" ON "StoreModifierOption"("groupId", "status", "displayOrder");
CREATE INDEX IF NOT EXISTS "StoreOfferModifierGroup_groupId_idx" ON "StoreOfferModifierGroup"("groupId");
CREATE INDEX IF NOT EXISTS "StoreOfferModifierGroup_offerId_displayOrder_idx" ON "StoreOfferModifierGroup"("offerId", "displayOrder");
CREATE INDEX IF NOT EXISTS "StoreOfferPriceVersion_effectiveFrom_effectiveUntil_idx" ON "StoreOfferPriceVersion"("effectiveFrom", "effectiveUntil");
CREATE INDEX IF NOT EXISTS "StorefrontCategoryDocument_canonicalPath_idx" ON "StorefrontCategoryDocument"("canonicalPath");
CREATE INDEX IF NOT EXISTS "SubscriptionAcknowledgement_contractId_idx" ON "SubscriptionAcknowledgement"("contractId");
CREATE INDEX IF NOT EXISTS "SubscriptionBenefitDefinition_planVersionId_idx" ON "SubscriptionBenefitDefinition"("planVersionId");
CREATE INDEX IF NOT EXISTS "SubscriptionBenefitDefinition_subjectType_benefitType_idx" ON "SubscriptionBenefitDefinition"("subjectType", "benefitType");
CREATE INDEX IF NOT EXISTS "SubscriptionCancellationNotice_contractId_requestedAt_idx" ON "SubscriptionCancellationNotice"("contractId", "requestedAt");
CREATE INDEX IF NOT EXISTS "SubscriptionContract_programId_status_idx" ON "SubscriptionContract"("programId", "status");
CREATE INDEX IF NOT EXISTS "SubscriptionContract_payerUserId_createdAt_idx" ON "SubscriptionContract"("payerUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "SubscriptionContractChange_contractId_status_effectiveAt_idx" ON "SubscriptionContractChange"("contractId", "status", "effectiveAt");
CREATE INDEX IF NOT EXISTS "SubscriptionContractStatusHistory_contractId_createdAt_idx" ON "SubscriptionContractStatusHistory"("contractId", "createdAt");
CREATE INDEX IF NOT EXISTS "SubscriptionEntitlementUsage_grantId_createdAt_idx" ON "SubscriptionEntitlementUsage"("grantId", "createdAt");
CREATE INDEX IF NOT EXISTS "SubscriptionEntitlementUsage_sourceType_sourceReference_idx" ON "SubscriptionEntitlementUsage"("sourceType", "sourceReference");
CREATE INDEX IF NOT EXISTS "SubscriptionEventIntent_publishedAt_createdAt_idx" ON "SubscriptionEventIntent"("publishedAt", "createdAt");
CREATE INDEX IF NOT EXISTS "SubscriptionInvoice_contractId_issuedAt_idx" ON "SubscriptionInvoice"("contractId", "issuedAt");
CREATE INDEX IF NOT EXISTS "SubscriptionInvoice_payerUserId_createdAt_idx" ON "SubscriptionInvoice"("payerUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "SubscriptionInvoice_status_dueAt_idx" ON "SubscriptionInvoice"("status", "dueAt");
CREATE INDEX IF NOT EXISTS "SubscriptionPaymentAuthority_provider_status_idx" ON "SubscriptionPaymentAuthority"("provider", "status");
CREATE INDEX IF NOT EXISTS "SubscriptionPlanVersion_status_effectiveFrom_idx" ON "SubscriptionPlanVersion"("status", "effectiveFrom");
CREATE INDEX IF NOT EXISTS "SubscriptionPlanVersionStatusHistory_planVersionId_createdAt_idx" ON "SubscriptionPlanVersionStatusHistory"("planVersionId", "createdAt");
CREATE INDEX IF NOT EXISTS "SubscriptionReconciliationCase_contractId_status_idx" ON "SubscriptionReconciliationCase"("contractId", "status");
CREATE INDEX IF NOT EXISTS "SubscriptionReconciliationCase_paymentId_status_idx" ON "SubscriptionReconciliationCase"("paymentId", "status");
CREATE INDEX IF NOT EXISTS "SubscriptionRenewalJob_contractId_status_idx" ON "SubscriptionRenewalJob"("contractId", "status");
CREATE INDEX IF NOT EXISTS "SubscriptionReview_programId_planVersionId_status_idx" ON "SubscriptionReview"("programId", "planVersionId", "status");
CREATE INDEX IF NOT EXISTS "SubscriptionReview_customerUserId_status_idx" ON "SubscriptionReview"("customerUserId", "status");
CREATE INDEX IF NOT EXISTS "SubscriptionReview_storeId_status_idx" ON "SubscriptionReview"("storeId", "status");

-- 4. Add Missing Promoter Foreign Keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PromoterAccount_userId_fkey'
  ) THEN
    ALTER TABLE "PromoterAccount"
      ADD CONSTRAINT "PromoterAccount_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PromoterAgreementVersion_approvedByUserId_fkey'
  ) THEN
    ALTER TABLE "PromoterAgreementVersion"
      ADD CONSTRAINT "PromoterAgreementVersion_approvedByUserId_fkey"
      FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PromoterProgramVersion_approvedByUserId_fkey'
  ) THEN
    ALTER TABLE "PromoterProgramVersion"
      ADD CONSTRAINT "PromoterProgramVersion_approvedByUserId_fkey"
      FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 5. Column / Default Alignment
ALTER TABLE "NotificationPreference" ALTER COLUMN "quietHoursDays" SET DEFAULT ARRAY[]::INTEGER[];

-- Final Closure: RecruitmentApplication status index
CREATE INDEX IF NOT EXISTS "RecruitmentApplication_status_phase26_idx" ON "RecruitmentApplication"("status");

-- 6. Eliminate Legacy Duplicate Foreign Key on PaymentWebhookEvent(paymentId)
DO $$
DECLARE
  canonical_fk_count INT;
  legacy_fk_count INT;
  fk_column_name TEXT;
  fk_ref_table TEXT;
  fk_del_action CHAR(1);
  fk_upd_action CHAR(1);
  total_fk_count INT;
BEGIN
  -- 1. Confirm canonical constraint exists and inspect its exact definition
  SELECT COUNT(*)::int INTO canonical_fk_count
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'PaymentWebhookEvent'
    AND c.conname = 'PaymentWebhookEvent_paymentId_phase12_restrict_fkey'
    AND c.contype = 'f';

  IF canonical_fk_count <> 1 THEN
    RAISE EXCEPTION 'Preflight failed: Canonical constraint PaymentWebhookEvent_paymentId_phase12_restrict_fkey not found on PaymentWebhookEvent.';
  END IF;

  -- Verify properties of canonical constraint
  SELECT
    payment_id_column.attname,
    ref_table.relname,
    c.confdeltype,
    c.confupdtype
  INTO
    fk_column_name,
    fk_ref_table,
    fk_del_action,
    fk_upd_action
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_class ref_table ON ref_table.oid = c.confrelid
  JOIN pg_attribute payment_id_column ON payment_id_column.attrelid = t.oid AND payment_id_column.attnum = ANY(c.conkey)
  WHERE n.nspname = 'public'
    AND t.relname = 'PaymentWebhookEvent'
    AND c.conname = 'PaymentWebhookEvent_paymentId_phase12_restrict_fkey'
    AND c.contype = 'f';

  IF fk_column_name <> 'paymentId' OR fk_ref_table <> 'Payment' OR fk_del_action <> 'r' OR fk_upd_action <> 'c' THEN
    RAISE EXCEPTION 'Preflight failed: Canonical constraint properties mismatch. Column: %, RefTable: %, OnDelete: %, OnUpdate: %',
      fk_column_name, fk_ref_table, fk_del_action, fk_upd_action;
  END IF;

  -- 2. Confirm legacy duplicate constraint PaymentWebhookEvent_paymentId_fkey exists
  SELECT COUNT(*)::int INTO legacy_fk_count
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'PaymentWebhookEvent'
    AND c.conname = 'PaymentWebhookEvent_paymentId_fkey'
    AND c.contype = 'f';

  IF legacy_fk_count = 1 THEN
    -- Explicitly drop the legacy duplicate constraint by exact name
    ALTER TABLE "PaymentWebhookEvent" DROP CONSTRAINT "PaymentWebhookEvent_paymentId_fkey";
  END IF;

  -- 3. Post-condition assertion: Exactly one FK remains on PaymentWebhookEvent(paymentId)
  SELECT COUNT(*)::int INTO total_fk_count
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_attribute col ON col.attrelid = t.oid AND col.attnum = ANY(c.conkey)
  WHERE n.nspname = 'public'
    AND t.relname = 'PaymentWebhookEvent'
    AND col.attname = 'paymentId'
    AND c.contype = 'f';

  IF total_fk_count <> 1 THEN
    RAISE EXCEPTION 'Postflight failed: Expected exactly 1 foreign key on PaymentWebhookEvent(paymentId), found %.', total_fk_count;
  END IF;
END $$;

