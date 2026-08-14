-- Keep physical index identifiers aligned with Prisma's generated names.
-- This is a forward-only rename of Phase B indexes; no data or constraints
-- are changed.
ALTER INDEX "CommercialSurcharge_enabled_effectiveFrom_effectiveTo_priority_idx" RENAME TO "CommercialSurcharge_enabled_effectiveFrom_effectiveTo_prior_idx";
ALTER INDEX "DeliveryServiceDefinition_stableKey_status_effectiveFrom_effectiveTo_idx" RENAME TO "DeliveryServiceDefinition_stableKey_status_effectiveFrom_ef_idx";
ALTER INDEX "ParcelProfileVersion_stableKey_status_effectiveFrom_effectiveTo_idx" RENAME TO "ParcelProfileVersion_stableKey_status_effectiveFrom_effecti_idx";
ALTER INDEX "PaymentMethodPolicy_businessModuleId_storeId_deliveryServiceId_idx" RENAME TO "PaymentMethodPolicy_businessModuleId_storeId_deliveryServic_idx";
