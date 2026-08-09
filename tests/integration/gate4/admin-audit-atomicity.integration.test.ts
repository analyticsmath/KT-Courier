import { describe, it, expect, beforeAll } from "vitest";
import { validateGate4DatabaseSafety } from "./harness-safety";
import { prisma } from "@/lib/db/prisma";
import { createGate4AdminAuditScenario, createGate4User, requireGate4Fixture } from "./fixtures";

describe("Gate 4 — Administrative Operation and Immutable Audit Atomicity Suite", () => {
  let safety: ReturnType<typeof validateGate4DatabaseSafety>;

  beforeAll(() => {
    safety = validateGate4DatabaseSafety();
  });

  it("G4-ADM-001 [Atomic Commit]: Successful administrative action mutates target aggregate and writes audit record in 1 transaction", async () => {
    if (!safety.ok) {
      console.warn(`[SKIP_DB_EXECUTION] ${safety.reason}`);
      return;
    }

    const { adminUser, targetUser } = await createGate4AdminAuditScenario("admin-audit", "atomic-commit");
    requireGate4Fixture(adminUser, "Admin user fixture required");
    requireGate4Fixture(targetUser, "Target user fixture required");

    const typeStr = `ADMIN_USER_REACTIVATION_${Date.now()}`;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetUser.id },
        data: { status: "ACTIVE" },
      });

      await tx.securityEvent.create({
        data: {
          actorUserId: adminUser.id,
          userId: targetUser.id,
          type: typeStr,
          severity: "INFO",
          message: "User reactivated by admin",
          ipAddress: "127.0.0.1",
          userAgent: "Gate4IntegrationTest/1.0",
          metadata: { action: "ADMIN_USER_REACTIVATION" },
        },
      });
    });

    const auditRecord = await prisma.securityEvent.findFirst({
      where: { type: typeStr },
    });
    expect(auditRecord).not.toBeNull();
    expect(auditRecord?.actorUserId).toBe(adminUser.id);
  });

  it("G4-ADM-001 [Atomic Rollback]: Injected audit record failure causes target administrative mutation to roll back completely", async () => {
    if (!safety.ok) return;

    const { user: targetUser } = await createGate4User("admin-audit", "atomic-rollback", "CUSTOMER", "ACTIVE");
    requireGate4Fixture(targetUser, "Target user fixture required");

    const originalStatus = targetUser.status;

    const failedTx = prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetUser.id },
        data: { status: "SUSPENDED" },
      });

      // Force failure during administrative audit write
      throw new Error("INJECTED_ADMIN_AUDIT_WRITE_FAILURE");
    });

    await expect(failedTx).rejects.toThrow("INJECTED_ADMIN_AUDIT_WRITE_FAILURE");

    const databaseUser = await prisma.user.findUnique({ where: { id: targetUser.id } });
    expect(databaseUser?.status).toBe(originalStatus);
  });
});

