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
  AND EXISTS (
    SELECT 1 FROM "Address" pickup
    WHERE pickup."id" = cert."pickupAddressId"
      AND pickup."storeId" = store."id"
      AND pickup."type" = 'PICKUP'
      AND pickup."id" = COALESCE(store."defaultPickupAddressId", pickup."id")
      AND BTRIM(COALESCE(pickup."line1", '')) <> ''
      AND BTRIM(COALESCE(pickup."line2", '')) <> ''
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
              '{"id":', to_json(pickup."id")::text,
              ',"storeId":', to_json(pickup."storeId")::text,
              ',"line1":', to_json(BTRIM(pickup."line1"))::text,
              ',"line2":', to_json(BTRIM(pickup."line2"))::text,
              ',"city":', to_json(BTRIM(pickup."city"))::text,
              ',"province":', to_json(BTRIM(pickup."province"))::text,
              ',"postalCode":', to_json(BTRIM(pickup."postalCode"))::text,
              ',"country":', to_json(UPPER(BTRIM(pickup."country")))::text,
              ',"placeId":', COALESCE(to_json(NULLIF(BTRIM(pickup."placeId"), ''))::text, 'null'),
              ',"latitude":', to_json(ROUND(pickup."latitude"::numeric, 6)::double precision)::text,
              ',"longitude":', to_json(ROUND(pickup."longitude"::numeric, 6)::double precision)::text,
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
