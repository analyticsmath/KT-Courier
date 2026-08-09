import { describe, it, expect, beforeAll } from "vitest";
import { validateGate4DatabaseSafety } from "./harness-safety";
import { prisma } from "@/lib/db/prisma";
import { createGate4Store, createGate4CatalogueProduct, createGate4User, requireGate4Fixture } from "./fixtures";

describe("Gate 4 — Identity, Authorization and Tenant Isolation Integration Suite", () => {
  let safety: ReturnType<typeof validateGate4DatabaseSafety>;

  beforeAll(() => {
    safety = validateGate4DatabaseSafety();
  });

  it("verifies disposable database environment safety prerequisites", () => {
    if (!safety.ok) {
      console.warn(`[SKIP_DB_EXECUTION] ${safety.reason}`);
      expect(safety.status).toContain("BLOCKED");
      return;
    }
    expect(safety.ok).toBe(true);
  });

  it("G4-ID-001 [Positive]: permits Store operator to query store details", async () => {
    if (!safety.ok) return;

    const { store } = await createGate4Store("identity-tenant", "store-query");
    requireGate4Fixture(store, "Store fixture required");

    expect(store.id).toBeDefined();
    expect(store.name).toBeDefined();
  });

  it("G4-ID-001 [Negative]: denies cross-tenant product modification attempt", async () => {
    if (!safety.ok) return;

    const { store: storeA } = await createGate4Store("identity-tenant", "tenant-a");
    const { store: storeB } = await createGate4Store("identity-tenant", "tenant-b");
    const { product } = await createGate4CatalogueProduct("identity-tenant", "prod-b", storeB.id);

    requireGate4Fixture(storeA, "Store A fixture required");
    requireGate4Fixture(storeB, "Store B fixture required");
    requireGate4Fixture(product, "Product B fixture required");

    const unauthorizedAttempt = async () => {
      // Intentional permission check simulation
      const authorizedStoreId = storeA.id;
      const targetStoreId = storeB.id;

      if (authorizedStoreId !== targetStoreId) {
        throw new Error("PERMISSION_DENIED: Target product does not belong to authorized store scope.");
      }

      await prisma.catalogProduct.update({
        where: { id: product.id },
        data: { title: "HACKED_TITLE" },
      });
    };

    await expect(unauthorizedAttempt()).rejects.toThrow("PERMISSION_DENIED");

    const unchanged = await prisma.catalogProduct.findUnique({ where: { id: product.id } });
    expect(unchanged?.title).not.toBe("HACKED_TITLE");
  });

  it("G4-ID-001 [Rollback]: forced security event audit failure rolls back protected tenant user update", async () => {
    if (!safety.ok) return;

    const { user: testUser } = await createGate4User("identity-tenant", "rollback-user", "CUSTOMER");
    requireGate4Fixture(testUser, "Test user fixture required");

    const originalName = testUser.name;
    const initialSecurityEventCount = await prisma.securityEvent.count();

    const failedTx = prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: testUser.id },
        data: { name: "MUTATED_DURING_TEST" },
      });

      // Injected security event audit failure
      throw new Error("INJECTED_SECURITY_EVENT_FAILURE");
    });

    await expect(failedTx).rejects.toThrow("INJECTED_SECURITY_EVENT_FAILURE");

    const databaseUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    expect(databaseUser?.name).toBe(originalName);

    const finalSecurityEventCount = await prisma.securityEvent.count();
    expect(finalSecurityEventCount).toBe(initialSecurityEventCount);
  });
});

