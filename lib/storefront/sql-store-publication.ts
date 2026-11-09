import { Prisma } from "@prisma/client";

/** A stored ACTIVE projection may be stale after a certificate expires.
 * Re-check the real Store and independently approved operational receipt
 * on every public query. Never infer spendability from cached catalogue rows.
 * Correlations use the source table's fixed, quoted SQL identifiers.
 */
const approvedCheckoutEvidence = Prisma.sql`
  cert."status" = 'APPROVED'
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
