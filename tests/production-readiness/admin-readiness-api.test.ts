import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdminApiPermission: vi.fn(),
  mutation: vi.fn(),
  txExecuteRaw: vi.fn(),
  systemSettingFindUnique: vi.fn(),
  systemSettingFindMany: vi.fn(),
  systemSettingUpsert: vi.fn(),
  systemSettingUpdate: vi.fn(),
  adminActivityLogCreate: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("@/lib/auth/admin-api", () => ({
  requireAdminApiPermission: mocks.requireAdminApiPermission,
}));

vi.mock("@/lib/client-platform/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/client-platform/api")>("@/lib/client-platform/api");
  return {
    ...actual,
    mutation: mocks.mutation,
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transactionMock,
    systemSetting: {
      findUnique: mocks.systemSettingFindUnique,
      findMany: mocks.systemSettingFindMany,
      upsert: mocks.systemSettingUpsert,
      update: mocks.systemSettingUpdate,
    },
    adminActivityLog: {
      create: mocks.adminActivityLogCreate,
    },
  },
}));

import { POST, PATCH } from "@/app/api/admin/production-readiness/route";
import {
  recordAcceptanceEvidence,
  reviewAcceptanceEvidence,
} from "@/lib/production-readiness/evidence";
import { applyReleaseAndParityGuardsToEntries } from "@/lib/production-readiness/readiness-guards";
import {
  assertSafeRemoteUrl,
  buildProductionVerificationOptions,
  verifyProductionParityRemote,
} from "@/lib/production-readiness/verification-adapters.server";
import type { Capability } from "@/lib/production-readiness/contracts";

describe("production readiness API, verification adapters, and parity guards", () => {
  const releaseSha = "691ebded959858e86b4cb28674f52394c1f5676c";
  const observedAt = "2026-10-07T00:05:00.000Z";
  const expiresAt = "2026-10-07T02:00:00.000Z";
  const reviewNow = new Date("2026-10-07T00:10:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminApiPermission.mockResolvedValue({
      user: { id: "admin-1", role: "SUPER_ADMIN" },
      response: null,
    });
  });

  it("blocks SSRF private/loopback URLs and verifies full 4-service Vercel + Railway + ready + audit parity", async () => {
    await expect(assertSafeRemoteUrl("http://verifier.example.com/parity")).rejects.toMatchObject({
      code: "UNSAFE_VERIFIER_URL",
      status: 409,
    });
    await expect(
      assertSafeRemoteUrl("https://127.0.0.1/parity"),
    ).rejects.toMatchObject({ code: "UNSAFE_VERIFIER_URL", status: 409 });
    await expect(
      assertSafeRemoteUrl("https://evil.example.com/parity", {
        resolveDns: async () => [{ address: "169.254.169.254", family: 4 }],
      }),
    ).rejects.toMatchObject({ code: "UNSAFE_VERIFIER_URL", status: 409 });

    const parityInput = {
      releaseSha,
      vercelDeploymentId: "dpl_5Dq9XL1B5eSp3VneVKh2mBqyg9rR",
      webDeploymentId: "545fd6ec-13d6-4d33-9f31-073f1ea3440e",
      operationsDeploymentId: "98beae70-56e2-426f-87e2-955c56fda0e5",
      queryDeploymentId: "266e4ccf-ac8e-4bff-8362-a925597debe0",
      protectedDataAuditReference: "audit-ref-01",
    };

    const badServiceFetch = vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target.includes("api.vercel.com")) {
        return new Response(JSON.stringify({ id: parityInput.vercelDeploymentId, readyState: "READY", meta: { githubCommitSha: releaseSha } }), { status: 200 });
      }
      if (target.includes("backboard.railway.com")) {
        return new Response(
          JSON.stringify({
            data: {
              web: { id: parityInput.webDeploymentId, status: "SUCCESS", meta: { commitHash: releaseSha }, service: { name: "web" } },
              operations: { id: parityInput.operationsDeploymentId, status: "SUCCESS", meta: { commitHash: releaseSha }, service: { name: "operations" } },
              query: { id: parityInput.queryDeploymentId, status: "SUCCESS", meta: { commitHash: releaseSha }, service: { name: "wrong-service" } },
            },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ status: "ready", database: "reachable", redis: { configured: true, connected: true } }), { status: 200 });
    }) as unknown as typeof fetch;

    await expect(
      verifyProductionParityRemote(parityInput, {
        env: {
          VERCEL_TOKEN: "vercel_tok",
          RAILWAY_API_TOKEN: "rail_tok",
          PAYMENT_APP_ORIGIN: "https://127.0.0.1",
        },
        allowLoopbackForTest: true,
        fetchImpl: badServiceFetch,
        auditRunner: async () =>
          ({
            readOnly: true,
            migrationCount: 14,
            releaseSha,
            receiptDigest: "a".repeat(64),
            database: { leastPrivilegeVerified: true },
          }) as unknown as Awaited<ReturnType<typeof import("@/scripts/audit-reviewed-production").reviewedProtectedRowAudit>>,
      }),
    ).rejects.toMatchObject({ code: "PARITY_VERIFICATION_MISMATCH", status: 409 });

    const goodFetch = vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target.includes("api.vercel.com")) {
        return new Response(JSON.stringify({ id: parityInput.vercelDeploymentId, readyState: "READY", meta: { githubCommitSha: releaseSha } }), { status: 200 });
      }
      if (target.includes("backboard.railway.com")) {
        return new Response(
          JSON.stringify({
            data: {
              web: { id: parityInput.webDeploymentId, status: "SUCCESS", meta: { commitHash: releaseSha }, service: { name: "web" } },
              operations: { id: parityInput.operationsDeploymentId, status: "SUCCESS", meta: { commitHash: releaseSha }, service: { name: "operations" } },
              query: { id: parityInput.queryDeploymentId, status: "SUCCESS", meta: { commitHash: releaseSha }, service: { name: "query-storefront-categories" } },
            },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ status: "ready", database: "reachable", redis: { configured: true, connected: true } }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await verifyProductionParityRemote(parityInput, {
      env: {
        VERCEL_TOKEN: "vercel_tok",
        RAILWAY_API_TOKEN: "rail_tok",
        PAYMENT_APP_ORIGIN: "https://127.0.0.1",
      },
      allowLoopbackForTest: true,
      fetchImpl: goodFetch,
      auditRunner: async () =>
        ({
          readOnly: true,
          migrationCount: 14,
          releaseSha,
          receiptDigest: "a".repeat(64),
          database: { leastPrivilegeVerified: true },
        }) as unknown as Awaited<ReturnType<typeof import("@/scripts/audit-reviewed-production").reviewedProtectedRowAudit>>,
    });
    expect(result.querySha).toBe(releaseSha);
    expect(result.queryStatus).toBe("SUCCESS");
    expect(result.leastPrivilege).toBe(true);
    expect(result.auditDigest).toBe("a".repeat(64));
  });

  it("runs remote verification before transaction lock and rejects stale expectedVersion on commit", async () => {
    const callOrder: string[] = [];
    const verifyParity = vi.fn(async () => {
      callOrder.push("remote-parity");
      return {
        vercelSha: releaseSha,
        vercelState: "READY",
        webSha: releaseSha,
        webStatus: "SUCCESS",
        operationsSha: releaseSha,
        operationsStatus: "SUCCESS",
        querySha: releaseSha,
        queryStatus: "SUCCESS",
        auditReleaseSha: releaseSha,
        protectedDataUnchanged: true,
        leastPrivilege: true,
        auditDigest: "b".repeat(64),
      };
    });

    // Outside tx: none stored; inside tx: concurrent writer bumped version to 1
    mocks.systemSettingFindUnique.mockResolvedValueOnce(null);
    mocks.transactionMock.mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) => {
      callOrder.push("begin-tx");
      return cb({
        $executeRaw: mocks.txExecuteRaw,
        systemSetting: {
          findUnique: vi.fn().mockResolvedValue({
            id: "set-1",
            updatedAt: new Date(observedAt),
            value: {
              evidence: {
                kind: "LIVE",
                key: "settlement_acceptance",
                releaseSha,
                observedAt,
                expiresAt,
                evidenceReference: "ref:12345678",
                reason: "Concurrent acceptance draft already stored",
                genuineOperatorAcceptance: true,
                financialAuthorizationReference: "FIN-0001",
              },
              version: 1,
              status: "DRAFT",
              authorId: "admin-other",
              approverId: null,
              approvedAt: null,
            },
          }),
          upsert: mocks.systemSettingUpsert,
        },
        adminActivityLog: { create: mocks.adminActivityLogCreate },
      });
    });

    const parityDraft = {
      expectedVersion: 0,
      evidence: {
        kind: "PARITY" as const,
        key: "production_deployment_sha_parity" as const,
        releaseSha,
        observedAt,
        expiresAt,
        evidenceReference: "audit:parity-tx-1",
        reason: "Verify zero external HTTP inside tx lock",
        vercelSha: releaseSha,
        webSha: releaseSha,
        operationsSha: releaseSha,
        querySha: releaseSha,
        vercelDeploymentId: "dpl_5Dq9XL1B5eSp3VneVKh2mBqyg9rR",
        webDeploymentId: "545fd6ec-13d6-4d33-9f31-073f1ea3440e",
        operationsDeploymentId: "98beae70-56e2-426f-87e2-955c56fda0e5",
        queryDeploymentId: "266e4ccf-ac8e-4bff-8362-a925597debe0",
        protectedDataAuditReference: "audit-ref-01",
        protectedDataUnchanged: true as const,
      },
    };

    await expect(
      recordAcceptanceEvidence("admin-1", parityDraft, {
        now: reviewNow,
        requireServerVerification: true,
        env: { NODE_ENV: "production", KT_DATABASE_CLASSIFICATION: "production", RAILWAY_GIT_COMMIT_SHA: releaseSha },
        adapters: { verifyParity },
      }),
    ).rejects.toMatchObject({ code: "EVIDENCE_CONFLICT", status: 409 });

    expect(callOrder).toEqual(["remote-parity", "begin-tx"]);
    expect(verifyParity).toHaveBeenCalledTimes(1);

    // Self-review blocked cleanly before transaction
    mocks.systemSettingFindUnique.mockResolvedValueOnce({
      id: "set-2",
      updatedAt: new Date(observedAt),
      value: {
        evidence: parityDraft.evidence,
        version: 1,
        status: "DRAFT",
        authorId: "admin-1",
        approverId: null,
        approvedAt: null,
      },
    });
    await expect(
      reviewAcceptanceEvidence(
        "admin-1",
        { key: "production_deployment_sha_parity", expectedVersion: 1, action: "APPROVE", reason: "Trying self approval" },
        { now: reviewNow },
      ),
    ).rejects.toMatchObject({ code: "INDEPENDENT_REVIEW_REQUIRED", status: 403 });
    expect(mocks.transactionMock).toHaveBeenCalledTimes(1);
  });

  it("enforces POST/PATCH API validation and buildProductionVerificationOptions composition", async () => {
    const liveObservedAt = new Date(Date.now() - 60_000).toISOString();
    const liveExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    mocks.mutation.mockResolvedValueOnce({
      body: {
        expectedVersion: 0,
        evidence: {
          kind: "LIVE",
          key: "settlement_acceptance",
          releaseSha,
          observedAt: liveObservedAt,
          expiresAt: liveExpiresAt,
          evidenceReference: "finance:settlement-ok",
          reason: "Valid live settlement attestation draft",
          genuineOperatorAcceptance: true,
          financialAuthorizationReference: "FIN-AUTH-1234",
        },
      },
    });
    mocks.systemSettingFindUnique.mockResolvedValueOnce(null);
    mocks.transactionMock.mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        $executeRaw: mocks.txExecuteRaw,
        systemSetting: { findUnique: vi.fn().mockResolvedValue(null), upsert: mocks.systemSettingUpsert },
        adminActivityLog: { create: mocks.adminActivityLogCreate },
      }),
    );

    const req = new NextRequest("http://localhost/api/admin/production-readiness", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { verificationMode?: string; status: string };
    expect(body.verificationMode).toBe("HUMAN_ATTESTED");
    expect(body.status).toBe("DRAFT");

    mocks.mutation.mockResolvedValueOnce({ body: { bad: true } });
    const badPatch = await PATCH(new NextRequest("http://localhost/api/admin/production-readiness", { method: "PATCH" }));
    expect(badPatch.status).toBe(422);

    expect(buildProductionVerificationOptions({}).adapters?.verifyParity).toBeTypeOf("function");
  });

  it("downgrades READY live/sandbox acceptance without required provenance in production guards", async () => {
    mocks.systemSettingFindUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
      if (where.key === "production_acceptance_vendor_onboarding_acceptance") {
        return {
          value: {
            evidence: {
              kind: "LIVE",
              key: "vendor_onboarding_acceptance",
              releaseSha,
              observedAt,
              expiresAt,
              evidenceReference: "vendor:onboard-01",
              reason: "Legacy draft missing verification mode",
              genuineOperatorAcceptance: true,
              financialAuthorizationReference: "FIN-AUTH-001",
            },
            version: 2,
            status: "APPROVED",
            authorId: "admin-1",
            approverId: "admin-2",
            approvedAt: observedAt,
          },
        };
      }
      return null;
    });

    const entries: Capability[] = [
      {
        key: "vendor_onboarding_acceptance",
        owner: "OPERATIONS",
        status: "READY",
        severity: "INFO",
        reasonCode: "OK",
        safeSummary: "Ready",
      },
    ];
    const guarded = await applyReleaseAndParityGuardsToEntries(entries, {
      now: reviewNow,
      env: { NODE_ENV: "production", KT_DATABASE_CLASSIFICATION: "production", RAILWAY_GIT_COMMIT_SHA: releaseSha },
    });
    expect(guarded[0]?.status).toBe("BLOCKED_LIVE_ACCEPTANCE");
    expect(guarded[0]?.reasonCode).toBe("ACCEPTANCE_SERVER_VERIFICATION_REQUIRED");
  });
});
