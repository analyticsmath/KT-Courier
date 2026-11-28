import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

const mocks = vi.hoisted(() => {
  const activityLogs: Array<{
    actorUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    message: string;
    metadata: Record<string, unknown>;
    createdAt: Date;
  }> = [];

  return {
    activityLogs,
    requireAdminApiPermission: vi.fn(),
    getEffectivePermissionKeysForUser: vi.fn(),
    enforceSameOriginRequest: vi.fn(),
    reconFindMany: vi.fn(),
    reconFindUnique: vi.fn(),
    reconUpdate: vi.fn(),
    recoverAttempt: vi.fn(),
    recoverPayment: vi.fn(),
    activityCreate: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      activityLogs.unshift({
        actorUserId: String(data.actorUserId ?? ""),
        action: String(data.action ?? "STATUS_CHANGE"),
        entityType: String(data.entityType ?? ""),
        entityId: String(data.entityId ?? ""),
        message: String(data.message ?? ""),
        metadata: (data.metadata as Record<string, unknown>) ?? {},
        createdAt: new Date(),
      });
      return activityLogs[0];
    }),
    activityFindMany: vi.fn(async ({ where }: { where?: { entityType?: string; action?: string } }) =>
      activityLogs.filter(
        (entry) =>
          (!where?.entityType || entry.entityType === where.entityType) &&
          (!where?.action || entry.action === where.action),
      ),
    ),
  };
});

vi.mock("@/lib/auth/admin-api", () => ({
  requireAdminApiPermission: mocks.requireAdminApiPermission,
}));

vi.mock("@/lib/auth/permissions", () => ({
  getEffectivePermissionKeysForUser: mocks.getEffectivePermissionKeysForUser,
}));

vi.mock("@/lib/security/request-origin", () => ({
  enforceSameOriginRequest: mocks.enforceSameOriginRequest,
}));

vi.mock("@/lib/services/paystack-verify-recovery.service", () => ({
  recoverPaystackAttemptViaVerify: mocks.recoverAttempt,
  recoverPendingPaystackPaymentForPaymentId: mocks.recoverPayment,
}));

vi.mock("@/lib/db/prisma", () => {
  const db = {
    paymentReconciliationCase: {
      findMany: mocks.reconFindMany,
      findUnique: mocks.reconFindUnique,
      update: mocks.reconUpdate,
    },
    adminActivityLog: {
      create: mocks.activityCreate,
      findMany: mocks.activityFindMany,
    },
  };
  return { prisma: db };
});

vi.mock("@/lib/db", () => {
  const db = {
    paymentReconciliationCase: {
      findMany: mocks.reconFindMany,
      findUnique: mocks.reconFindUnique,
      update: mocks.reconUpdate,
    },
    adminActivityLog: {
      create: mocks.activityCreate,
      findMany: mocks.activityFindMany,
    },
  };
  return { db, prisma: db };
});

vi.mock("@/lib/operations/phase5-repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/operations/phase5-repository")>()),
  phase5Repository: {
    paymentReconciliationCase: {
      findMany: mocks.reconFindMany,
      findUnique: mocks.reconFindUnique,
      update: mocks.reconUpdate,
    },
  },
}));

import {
  getUnifiedReconciliationCase,
  listUnifiedReconciliationCases,
} from "@/lib/reconciliation/service";
import { POST as executeActionPost } from "@/app/api/admin/reconciliation/[domain]/[reference]/actions/[action]/route";

describe("Unified reconciliation permission projection, stale revocation, and idempotent retry", () => {
  const sampleCase = {
    id: "case-1",
    publicReference: "prc_test_case_001",
    paymentId: "pay-1",
    attemptId: "att-1",
    provider: "PAYSTACK",
    status: "OPEN",
    priority: "HIGH",
    reason: "WEBHOOK_DELAY",
    summary: "Paystack attempt awaiting verification",
    openedAt: new Date("2026-11-27T10:00:00Z"),
    createdAt: new Date("2026-11-27T10:00:00Z"),
    updatedAt: new Date("2026-11-27T10:00:00Z"),
    safeEvidence: { merchantReference: "pay_ref_001" },
  };

  beforeEach(() => {
    mocks.activityLogs.length = 0;
    vi.clearAllMocks();
    mocks.enforceSameOriginRequest.mockResolvedValue(null);
    mocks.requireAdminApiPermission.mockResolvedValue({ user: { id: "usr-admin-1", role: "ADMIN" } });
    mocks.reconFindMany.mockResolvedValue([sampleCase]);
    mocks.reconFindUnique.mockResolvedValue({
      ...sampleCase,
      payment: { status: "PROCESSING", successLedgerJournalId: null },
      attempt: { status: "PROCESSING" },
    });
    mocks.reconUpdate.mockResolvedValue({ ...sampleCase, status: "RESOLVED" });
    mocks.activityCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      const entry = {
        actorUserId: String(data.actorUserId ?? ""),
        action: String(data.action ?? "STATUS_CHANGE"),
        entityType: String(data.entityType ?? ""),
        entityId: String(data.entityId ?? ""),
        message: String(data.message ?? ""),
        metadata: (data.metadata as Record<string, unknown>) ?? {},
        createdAt: new Date(),
      };
      mocks.activityLogs.unshift(entry);
      return entry;
    });
    mocks.activityFindMany.mockImplementation(
      async ({ where }: { where?: { entityType?: string; action?: string } }) =>
        mocks.activityLogs.filter(
          (entry) =>
            (!where?.entityType || entry.entityType === where.entityType) &&
            (!where?.action || entry.action === where.action),
        ),
    );
    mocks.recoverAttempt.mockResolvedValue({
      recovered: true,
      outcome: "SETTLED_VIA_VERIFY",
      paymentId: "pay-1",
      paymentReference: "pay_001",
      attemptId: "att-1",
    });
  });

  it("projects UNAVAILABLE_PERMISSION for ADMIN (read-only) and EXECUTABLE for SUPER_ADMIN (manage)", async () => {
    const adminReadOnly = new Set([PERMISSIONS.PAYMENT_RECONCILIATION_READ]);
    const listResult = await listUnifiedReconciliationCases(adminReadOnly, { domain: "payments", limit: 10 });
    expect(listResult.cases).toHaveLength(1);
    const adminRetry = listResult.cases[0]!.permittedActions.find(
      (a) => a.actionKey === "RETRY_PAYMENT_VERIFICATION",
    );
    expect(adminRetry).toMatchObject({
      actionKey: "RETRY_PAYMENT_VERIFICATION",
      requiredPermission: PERMISSIONS.PAYMENT_RECONCILIATION_MANAGE,
      authorized: false,
      availabilityStatus: "UNAVAILABLE_PERMISSION",
      readinessState: "BLOCKED",
    });
    expect(adminRetry?.readinessBlocker).toContain(PERMISSIONS.PAYMENT_RECONCILIATION_MANAGE);

    const detailResult = await getUnifiedReconciliationCase(adminReadOnly, "payments", "prc_test_case_001");
    expect(detailResult?.permittedActions.every((a) => a.authorized === false && a.readinessState === "BLOCKED")).toBe(
      true,
    );

    const superAdminManage = new Set([
      PERMISSIONS.PAYMENT_RECONCILIATION_READ,
      PERMISSIONS.PAYMENT_RECONCILIATION_MANAGE,
    ]);
    const superDetail = await getUnifiedReconciliationCase(superAdminManage, "payments", "prc_test_case_001");
    const superRetry = superDetail?.permittedActions.find((a) => a.actionKey === "RETRY_PAYMENT_VERIFICATION");
    expect(superRetry).toMatchObject({
      authorized: true,
      availabilityStatus: "EXECUTABLE",
      readinessState: "READY",
    });
  });

  it("enforces HTTP 403 for unauthorized or stale permissions and executes idempotent operationId retries once", async () => {
    const makePost = (operationId: string, action = "RETRY_PAYMENT_VERIFICATION") =>
      new NextRequest(`https://kt.local/api/admin/reconciliation/payments/prc_test_case_001/actions/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operationId,
          reasonCode: "MANUAL_RETRY",
          confirmAction: action,
        }),
      });

    // 1. ADMIN holding only PAYMENT_RECONCILIATION_READ is rejected with 403
    mocks.getEffectivePermissionKeysForUser.mockResolvedValue([PERMISSIONS.PAYMENT_RECONCILIATION_READ]);
    const adminRes = await executeActionPost(makePost("RECOP-TEST-001"), {
      params: Promise.resolve({ domain: "payments", reference: "prc_test_case_001", action: "RETRY_PAYMENT_VERIFICATION" }),
    });
    expect(adminRes.status).toBe(403);
    expect(mocks.recoverAttempt).not.toHaveBeenCalled();

    // 2. Authorized actor executes recovery once for RECOP-TEST-002
    mocks.getEffectivePermissionKeysForUser.mockResolvedValue([
      PERMISSIONS.PAYMENT_RECONCILIATION_READ,
      PERMISSIONS.PAYMENT_RECONCILIATION_MANAGE,
    ]);
    const firstExec = await executeActionPost(makePost("RECOP-TEST-002"), {
      params: Promise.resolve({ domain: "payments", reference: "prc_test_case_001", action: "RETRY_PAYMENT_VERIFICATION" }),
    });
    const firstBody = await firstExec.json();
    expect(firstExec.status, `Unexpected response: ${JSON.stringify(firstBody)}`).toBe(200);
    expect(firstBody.data).toMatchObject({
      success: true,
      operationId: "RECOP-TEST-002",
      updatedStatus: "CONVERGED",
    });
    expect(mocks.recoverAttempt).toHaveBeenCalledTimes(1);

    // 3. Replaying identical operationId returns cached result without calling Paystack verify again
    const replayExec = await executeActionPost(makePost("RECOP-TEST-002"), {
      params: Promise.resolve({ domain: "payments", reference: "prc_test_case_001", action: "RETRY_PAYMENT_VERIFICATION" }),
    });
    expect(replayExec.status).toBe(200);
    const replayBody = await replayExec.json();
    expect(replayBody.data).toMatchObject({
      success: true,
      operationId: "RECOP-TEST-002",
      idempotentReplay: true,
    });
    expect(mocks.recoverAttempt).toHaveBeenCalledTimes(1);

    // 4. Reusing RECOP-TEST-002 for a different action is rejected with 409
    const reuseMismatch = await executeActionPost(makePost("RECOP-TEST-002", "MARK_RECONCILED"), {
      params: Promise.resolve({ domain: "payments", reference: "prc_test_case_001", action: "MARK_RECONCILED" }),
    });
    expect(reuseMismatch.status).toBe(409);

    // 5. Stale permission: actor loses manage permission and even replay is rejected with 403
    mocks.getEffectivePermissionKeysForUser.mockResolvedValue([PERMISSIONS.PAYMENT_RECONCILIATION_READ]);
    const staleDenied = await executeActionPost(makePost("RECOP-TEST-002"), {
      params: Promise.resolve({ domain: "payments", reference: "prc_test_case_001", action: "RETRY_PAYMENT_VERIFICATION" }),
    });
    expect(staleDenied.status).toBe(403);

    // 6. Already reconciled/settled payments project BLOCKED and reject new retry requests with 409
    mocks.getEffectivePermissionKeysForUser.mockResolvedValue([
      PERMISSIONS.PAYMENT_RECONCILIATION_READ,
      PERMISSIONS.PAYMENT_RECONCILIATION_MANAGE,
    ]);
    const settledCase = {
      ...sampleCase,
      status: "OPEN",
      payment: { status: "SUCCEEDED", reconciliationStatus: "RESOLVED", successLedgerJournalId: "jrn-settled-1" },
      attempt: { status: "SUCCEEDED" },
    };
    mocks.reconFindUnique.mockResolvedValue(settledCase);
    const settledDetail = await getUnifiedReconciliationCase(
      new Set([PERMISSIONS.PAYMENT_RECONCILIATION_READ, PERMISSIONS.PAYMENT_RECONCILIATION_MANAGE]),
      "payments",
      "prc_test_case_001",
    );
    const blockedRetryAction = settledDetail?.permittedActions.find(
      (a) => a.actionKey === "RETRY_PAYMENT_VERIFICATION",
    );
    expect(blockedRetryAction).toMatchObject({
      authorized: true,
      availabilityStatus: "BLOCKED",
      readinessState: "BLOCKED",
    });
    const blockedRetryRes = await executeActionPost(makePost("RECOP-TEST-NEW-AFTER-SETTLE"), {
      params: Promise.resolve({ domain: "payments", reference: "prc_test_case_001", action: "RETRY_PAYMENT_VERIFICATION" }),
    });
    expect(blockedRetryRes.status).toBe(409);
    expect(mocks.recoverAttempt).toHaveBeenCalledTimes(1);
  });
});
