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
    expect(sql).toContain('store."status" = \'ACTIVE\'');
  });
  it("ties catalogue product offers to the correct exact store, not just the same slug", () => {
    expect(sqlString(activePublicProductDocumentSql)).toContain('store."id" = "StorefrontProductDocument"."storeId"');
  });
  it("does not reuse a historical projection as live certification", () => {
    expect(sqlString(activePublicStoreDocumentSql)).toContain('store."id" = "StorefrontStoreDocument"."storeId"');
  });
});
