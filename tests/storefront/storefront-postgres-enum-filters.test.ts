import { beforeEach, describe, expect, it, vi } from "vitest";
import { PostgresStorefrontSearchAdapter } from "@/lib/storefront/search/storefront-search-adapter";

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn(async (query: unknown) => { void query; return []; }) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $queryRaw: queryRaw } }));

describe("Postgres storefront enum filters", () => {
  beforeEach(() => queryRaw.mockClear());

  it("casts validated filter parameters to their PostgreSQL enum types", async () => {
    await new PostgresStorefrontSearchAdapter().search({
      availability: ["IN_STOCK"], condition: ["NEW"], fulfilment: ["COURIER_DELIVERY"], limit: 5,
    });
    const query = queryRaw.mock.calls[0]?.[0] as { sql: string; values: unknown[] };
    expect(query.sql).toContain('::"StorefrontAvailabilityState"');
    expect(query.sql).toContain('::"CatalogProductCondition"');
    expect(query.sql).toContain('::"CatalogFulfilmentMode"');
    expect(query.values).toEqual(expect.arrayContaining(["IN_STOCK", "NEW", "COURIER_DELIVERY"]));
  });

  it("returns no products when a requested enum filter contains no valid values", async () => {
    expect(await new PostgresStorefrontSearchAdapter().search({ condition: ["UNKNOWN"] })).toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
