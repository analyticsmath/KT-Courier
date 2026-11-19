import { Prisma } from "@prisma/client";

/** A stored ACTIVE projection may be stale after a certificate expires.
 * Re-check the real Store and independently approved operational receipt
 * on every public query. Never infer spendability from cached catalogue rows.
 * Correlations use the source table's fixed, quoted SQL identifiers.
 */
const approvedCheckoutEvidence = Prisma.sql`
  BTRIM(store."name") <> ''
  AND cert."status" = 'APPROVED'
  AND cert."expiresAt" > CURRENT_TIMESTAMP
  AND cert."approvedAt" IS NOT NULL
  AND cert."approvedByUserId" IS NOT NULL
  AND cert."approvedByUserId" <> cert."preparedByUserId"
  AND cert."routeEvidenceDigest" ~ '^[a-f0-9]{64}$'
  AND cert."checkoutEvidenceDigest" ~ '^[a-f0-9]{64}$'
  AND cert."evidenceType" = 'REAL_STORE_CATALOG_CHECKOUT_CAPABILITY_PROOF'
  AND cert."engineProofDigest" ~ '^[a-f0-9]{64}$'
  AND cert."proofOfferReference" IS NOT NULL
  AND cert."proofPriceVersionReference" IS NOT NULL
  AND cert."sourceCommerceReadinessRevision" = store."commerceReadinessRevision"
  AND cert."globalPolicyRevision" = COALESCE(
    (
      SELECT (setting."value"->>'version')::int
      FROM "SystemSetting" setting
      WHERE setting."key" = 'platform.commerce_readiness_revision'
    ),
    1
  )
  AND EXISTS (
    SELECT 1
    FROM "CommissionPlan" plan
    WHERE plan."subjectType" = 'MARKETPLACE_STORE_ORDER'
      AND plan."scopeKey" = 'STORE:' || store."id"
      AND plan."currency" = 'ZAR'
      AND plan."status" = 'ACTIVE'
      AND plan."approvedAt" IS NOT NULL
      AND plan."effectiveFrom" <= CURRENT_TIMESTAMP
      AND (plan."effectiveUntil" IS NULL OR plan."effectiveUntil" > CURRENT_TIMESTAMP)
  )
  AND EXISTS (
    SELECT 1
    FROM "StorefrontProductDocument" doc
    INNER JOIN "StoreCatalogOffer" offer ON offer."id" = doc."offerId"
    INNER JOIN "StoreOfferPriceVersion" price ON price."id" = offer."currentPriceVersionId"
    LEFT JOIN "CatalogInventoryItem" inv ON inv."offerId" = offer."id"
    WHERE doc."storeId" = store."id"
      AND doc."status" = 'ACTIVE'
      AND doc."searchable" = true
      AND offer."storeId" = store."id"
      AND offer."status" = 'ACTIVE'
      AND offer."publicationStatus" = 'PUBLISHED'
      AND price."status" = 'ACTIVE'
      AND price."effectiveFrom" <= CURRENT_TIMESTAMP
      AND (price."effectiveUntil" IS NULL OR price."effectiveUntil" > CURRENT_TIMESTAMP)
      AND (
        inv."trackingMode" = 'UNTRACKED'
        OR EXISTS (
          SELECT 1
          FROM "CatalogInventoryLevel" lvl
          INNER JOIN "InventoryLocation" loc ON loc."id" = lvl."locationId"
          WHERE lvl."inventoryItemId" = inv."id"
            AND loc."status" = 'ACTIVE'
            AND lvl."available" >= GREATEST(1, CEIL(offer."minimumQuantity")::int)
        )
      )
  )
  AND EXISTS (
    SELECT 1 FROM "Address" pickup
    WHERE pickup."id" = cert."pickupAddressId"
      AND pickup."storeId" = store."id"
      AND pickup."type" = 'PICKUP'
      AND pickup."id" = COALESCE(store."defaultPickupAddressId", pickup."id")
      AND BTRIM(COALESCE(pickup."line1", '')) <> ''
      AND BTRIM(COALESCE(NULLIF(BTRIM(pickup."suburb"), ''), pickup."line2", '')) <> ''
      AND BTRIM(COALESCE(pickup."city", '')) <> ''
      AND BTRIM(COALESCE(pickup."province", '')) <> ''
      AND BTRIM(COALESCE(pickup."postalCode", '')) <> ''
      AND UPPER(BTRIM(COALESCE(pickup."country", ''))) IN ('ZA', 'SOUTH AFRICA')
      AND pickup."latitude" IS NOT NULL
      AND pickup."latitude" BETWEEN -35 AND -22
      AND pickup."longitude" IS NOT NULL
      AND pickup."longitude" BETWEEN 16 AND 33
      AND encode(
        sha256(
          convert_to(
            concat(
              '{"storeId":', to_json(pickup."storeId")::text,
              ',"addressId":', to_json(pickup."id")::text,
              ',"street":', to_json(lower(regexp_replace(btrim(coalesce(pickup."line1", '')), '[[:space:]]+', ' ', 'g')))::text,
              ',"suburb":', to_json(lower(regexp_replace(btrim(coalesce(NULLIF(btrim(pickup."suburb"), ''), pickup."line2", '')), '[[:space:]]+', ' ', 'g')))::text,
              ',"city":', to_json(lower(regexp_replace(btrim(coalesce(pickup."city", '')), '[[:space:]]+', ' ', 'g')))::text,
              ',"province":', to_json(lower(regexp_replace(btrim(coalesce(pickup."province", '')), '[[:space:]]+', ' ', 'g')))::text,
              ',"postcode":', to_json(lower(regexp_replace(btrim(coalesce(pickup."postalCode", '')), '[[:space:]]+', ' ', 'g')))::text,
              ',"country":', to_json(lower(regexp_replace(btrim(coalesce(pickup."country", '')), '[[:space:]]+', ' ', 'g')))::text,
              ',"lat":', to_json(to_char(pickup."latitude"::numeric, 'FM990.0000000'))::text,
              ',"lng":', to_json(to_char(pickup."longitude"::numeric, 'FM990.0000000'))::text,
              ',"placeId":', to_json(lower(regexp_replace(btrim(coalesce(pickup."placeId", '')), '[[:space:]]+', ' ', 'g')))::text,
              '}'
            ),
            'UTF8'
          )
        ),
        'hex'
      ) = cert."pickupFingerprint"
  )
  AND EXISTS (
    SELECT 1 FROM "StoreSellerLegalIdentity" identity
    WHERE identity."storeId" = store."id"
      AND identity."status" = 'APPROVED'
      AND identity."effectiveFrom" <= CURRENT_TIMESTAMP
      AND (identity."effectiveUntil" IS NULL OR identity."effectiveUntil" > CURRENT_TIMESTAMP)
  )
  AND EXISTS (
    SELECT 1 FROM "StoreOrderOperationalPolicy" policy
    WHERE policy."status" = 'ACTIVE'
      AND policy."effectiveFrom" <= CURRENT_TIMESTAMP
      AND (policy."effectiveUntil" IS NULL OR policy."effectiveUntil" > CURRENT_TIMESTAMP)
  )
`;

/** Only use in a query FROM "StorefrontStoreDocument" (unaliased). */
export const activePublicStoreDocumentSql = Prisma.sql`
  EXISTS (
    SELECT 1 FROM "Store" store
    JOIN "StoreCheckoutCertification" cert ON cert."storeId" = store."id"
    WHERE store."id" = "StorefrontStoreDocument"."storeId"
      AND store."status" = 'ACTIVE'
      AND ${approvedCheckoutEvidence}
  )
`;

/** Only use in a query FROM "StorefrontProductDocument" (unaliased). */
export const activePublicProductDocumentSql = Prisma.sql`
  EXISTS (
    SELECT 1 FROM "StorefrontStoreDocument" public_store
    JOIN "Store" store ON store."id" = public_store."storeId"
    JOIN "StoreCheckoutCertification" cert ON cert."storeId" = store."id"
    WHERE store."id" = "StorefrontProductDocument"."storeId"
      AND public_store."publicStatus" = 'ACTIVE'
      AND store."status" = 'ACTIVE'
      AND ${approvedCheckoutEvidence}
  )
`;
