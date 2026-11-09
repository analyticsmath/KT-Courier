import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $queryRaw: mock.queryRaw } }));

import { listStorefrontCategories, listStorefrontStores, getStorefrontStore } from "@/lib/services/storefront-catalog.service";
import { PostgresStorefrontSearchAdapter, loadStorefrontDocuments } from "@/lib/storefront/search/storefront-search-adapter";

beforeEach(() => {
  mock.queryRaw.mockReset().mockResolvedValue([]);
});

function lastSql() {
  const argument = mock.queryRaw.mock.lastCall?.[0] as { sql?: string } | undefined;
  expect(argument?.sql).toBeTypeOf("string");
  return argument!.sql!;
}
function expectLiveCertificatePredicate(sql: string) {
  expect(sql).toContain('"StoreCheckoutCertification"');
  expect(sql).toContain('cert."expiresAt" > CURRENT_TIMESTAMP');
  expect(sql).toContain('cert."approvedByUserId" <> cert."preparedByUserId"');
}

describe("all public core catalogue routes revalidate store checkout certification at read time", () => {
  it("rejects uncertified or expired stores from store directory", async () => {
    await listStorefrontStores({ limit: 10 });
    expectLiveCertificatePredicate(lastSql());
  });
  it("rejects uncertified or expired stores from direct store details", async () => {
    expect(await getStorefrontStore("test-store")).toBeNull();
    expectLiveCertificatePredicate(lastSql());
  });
  it("cannot show unapproved merchant products in product discovery", async () => {
    await new PostgresStorefrontSearchAdapter().search({ query: "book" });
    expectLiveCertificatePredicate(lastSql());
    expect(lastSql()).toContain('store."id" = "StorefrontProductDocument"."storeId"');
  });
  it("cannot load an unapproved merchant offer by guessing its product reference", async () => {
    await loadStorefrontDocuments({ productReference: "pro-1" });
    expectLiveCertificatePredicate(lastSql());
  });
  it("does not count hidden checkout-blocked products in public category listings", async () => {
    expect(await listStorefrontCategories()).toEqual([]);
    expect(mock.queryRaw).toHaveBeenCalledTimes(2);
    const sql = (mock.queryRaw.mock.calls[1]?.[0] as { sql: string }).sql;
    expectLiveCertificatePredicate(sql);
  });
});
