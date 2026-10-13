import { describe, expect, it, vi } from "vitest";
import { createPrismaMarketplaceCartRepository } from "@/lib/marketplace-checkout/prisma-cart-repository";

function carts() {
  // The older checkout cart is deliberately first: database row order must
  // never decide which shopping bag a customer's mutation targets.
  const rows = [
    { id: "old", publicReference: "cart_old", ownerType: "GUEST", guestTokenHash: "owner", status: "CHECKOUT_LOCKED", version: 2, storeGroups: [] },
    { id: "current", publicReference: "cart_current", ownerType: "GUEST", guestTokenHash: "owner", status: "ACTIVE", version: 1, storeGroups: [] },
    { id: "foreign", publicReference: "cart_foreign", ownerType: "GUEST", guestTokenHash: "someone-else", status: "ACTIVE", version: 1, storeGroups: [] },
  ];
  const database = {
    $queryRawUnsafe: vi.fn(async () => []),
    marketplaceCart: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => rows.find((row) => Object.entries(where).every(([key, value]) => {
        const actual = row[key as keyof typeof row];
        return typeof value === "object" && value !== null && "in" in value
          ? (value.in as string[]).includes(actual as string)
          : actual === value;
      })) ?? null),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => rows.find((row) => row.id === where.id) ?? null),
    },
  };
  return createPrismaMarketplaceCartRepository(database);
}

describe("cart lookup after a previous checkout", () => {
  const owner = { type: "GUEST" as const, guestTokenHash: "owner" };

  it("resolves the same active shopping bag for reads and owner-based mutations", async () => {
    const repository = carts();
    expect((await repository.findCartByOwner(owner))?.publicReference).toBe("cart_current");
    expect((await repository.lockCartByOwner(owner))?.publicReference).toBe("cart_current");
  });

  it("resolves the requested cart reference within its owner's carts", async () => {
    const repository = carts();
    expect((await repository.lockCartByOwner(owner, { publicReference: "cart_current" }))?.publicReference).toBe("cart_current");
    // An old checkout remains identifiable so the mutation policy can report
    // its locked state; it must never redirect the mutation to another cart.
    expect((await repository.lockCartByOwner(owner, { publicReference: "cart_old" }))?.status).toBe("CHECKOUT_LOCKED");
    expect(await repository.lockCartByOwner(owner, { publicReference: "cart_foreign" })).toBeNull();
    expect(await repository.lockCartByOwner(owner, { publicReference: "cart_missing" })).toBeNull();
  });
});
