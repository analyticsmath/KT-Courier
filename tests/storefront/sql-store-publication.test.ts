import { describe, expect, it } from "vitest";
import { activePublicProductDocumentSql, activePublicStoreDocumentSql } from "@/lib/storefront/sql-store-publication";

function sqlString(fragment: { sql: string }) {
  return fragment.sql.replace(/\\s+/g, " ");
}

describe("public catalogue reflects current reviewed store checkout authority", () => {
  it.each([
    ["store", activePublicStoreDocumentSql],
    ["product", activePublicProductDocumentSql],
  ])("requires independent, non-expired evidence on %s reads", (_, fragment) => {
    const sql = sqlString(fragment);
    expect(sql).toContain('"StoreCheckoutCertification"');
    expect(sql).toContain('cert."expiresAt" > CURRENT_TIMESTAMP');
    expect(sql).toContain('cert."approvedByUserId" <> cert."preparedByUserId"');
    expect(sql).toContain('cert."routeEvidenceDigest"');
    expect(sql).toContain('cert."checkoutEvidenceDigest"');
    expect(sql).toContain('pickup."storeId" = store."id"');
    expect(sql).toContain("pickup.\"type\" = 'PICKUP'");
    expect(sql).toContain('cert."pickupFingerprint"');
    expect(sql).toContain('"StoreSellerLegalIdentity"');
    expect(sql).toContain("identity.\"status\" = 'APPROVED'");
    expect(sql).toContain('"StoreOrderOperationalPolicy"');
    expect(sql).toContain("policy.\"status\" = 'ACTIVE'");
    expect(sql).toContain('store."status" = \'ACTIVE\'');
  });
  it("ties catalogue product offers to the correct exact store, not just the same slug", () => {
    expect(sqlString(activePublicProductDocumentSql)).toContain('store."id" = "StorefrontProductDocument"."storeId"');
  });
  it("does not reuse a historical projection as live certification", () => {
    expect(sqlString(activePublicStoreDocumentSql)).toContain('store."id" = "StorefrontStoreDocument"."storeId"');
  });
  it("enforces exact pickup fingerprint canonical JSON key parity with pickupCertificationFingerprint", () => {
    const sql = sqlString(activePublicStoreDocumentSql);
    expect(sql).toContain('"storeId":');
    expect(sql).toContain('"addressId":');
    expect(sql).toContain('"street":');
    expect(sql).toContain('"suburb":');
    expect(sql).toContain('"city":');
    expect(sql).toContain('"province":');
    expect(sql).toContain('"postcode":');
    expect(sql).toContain('"country":');
    expect(sql).toContain('"lat":');
    expect(sql).toContain('"lng":');
    expect(sql).toContain('"placeId":');
    expect(sql).toContain("FM990.0000000");
  });
});
