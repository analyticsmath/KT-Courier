import { createServer } from "node:http";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { verifyProductionParityRemote } from "@/lib/production-readiness/verification-adapters.server";
import { createReleaseAuthorityHandler } from "@/services/release-authority/src/app.mjs";
import { createPostgresStore } from "@/services/release-authority/src/store.mjs";

describe("release-authority Postgres store and parity adapter bridge", () => {
  const releaseSha = "07a5f71a482f32e93d6f211fe99961e024fc9551";

  it("enforces atomic single-use SQL claim in PGlite Postgres and serves KT_PARITY_VERIFIER_URL cleanly", async () => {
    const db = new PGlite();
    const pgStore = createPostgresStore({ pool: db });
    await pgStore.init();

    const first = await pgStore.claimSingleUseIssuance({
      repository: "analyticsmath/KT-Courier",
      environment: "production",
      audience: "kt-couriers-release",
      commitSha: releaseSha,
      treeSha: "3".repeat(40),
      issuanceId: "issuance-pglite-atomic-001",
      evidenceReferenceDigest: "a".repeat(64),
      ciRunId: 45352739658,
      certificationRunId: 45352739746,
      ciEvidenceDigest: "b".repeat(64),
      deployments: { vercel: "v1", railwayWeb: "w1", railwayOperations: "o1", railwayQuery: "q1" },
      scopeDigest: "c".repeat(64),
      policyDigest: "d".repeat(64),
      claimedAt: "2026-11-24T12:00:00.000Z",
    });
    expect(first.claimed).toBe(true);

    await expect(
      pgStore.claimSingleUseIssuance({
        repository: "analyticsmath/KT-Courier",
        environment: "production",
        audience: "kt-couriers-release",
        commitSha: releaseSha,
        treeSha: "3".repeat(40),
        issuanceId: "issuance-pglite-atomic-001",
        evidenceReferenceDigest: "a".repeat(64),
        ciRunId: 45352739658,
        certificationRunId: 45352739746,
        ciEvidenceDigest: "b".repeat(64),
        deployments: { vercel: "v1", railwayWeb: "w1", railwayOperations: "o1", railwayQuery: "q1" },
        scopeDigest: "c".repeat(64),
        policyDigest: "d".repeat(64),
        claimedAt: "2026-11-24T12:00:01.000Z",
      }),
    ).rejects.toMatchObject({ code: "ISSUANCE_ALREADY_CLAIMED", status: 409 });

    const handler = createReleaseAuthorityHandler({
      store: pgStore,
      readToken: "vitest_release_authority_read_token",
      adminToken: "vitest_release_authority_admin_token",
      allowLoopbackForTest: true,
      env: {
        NODE_ENV: "production",
        VERCEL_TOKEN: "v_tok",
        RAILWAY_API_TOKEN: "r_tok",
        KT_PRODUCTION_ORIGIN: "https://127.0.0.1",
      },
      fetchImpl: async (url) => {
        const target = String(url);
        if (target.includes("api.vercel.com")) {
          return new Response(JSON.stringify({ id: "dpl_5Dq9XL1B5eSp3VneVKh2mBqyg9rR", readyState: "READY", meta: { githubCommitSha: releaseSha } }), { status: 200 });
        }
        if (target.includes("backboard.railway.com")) {
          return new Response(
            JSON.stringify({
              data: {
                web: { id: "545fd6ec-13d6-4d33-9f31-073f1ea3440e", status: "SUCCESS", meta: { commitHash: releaseSha }, service: { name: "web" } },
                operations: { id: "98beae70-56e2-426f-87e2-955c56fda0e5", status: "SUCCESS", meta: { commitHash: releaseSha }, service: { name: "operations" } },
                query: { id: "266e4ccf-ac8e-4bff-8362-a925597debe0", status: "SUCCESS", meta: { commitHash: releaseSha }, service: { name: "query-storefront-categories" } },
              },
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ status: "ready", database: "reachable", redis: { configured: true, connected: true } }), { status: 200 });
      },
    });

    const server = createServer(handler);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    try {
      const parity = await verifyProductionParityRemote(
        {
          releaseSha,
          vercelDeploymentId: "dpl_5Dq9XL1B5eSp3VneVKh2mBqyg9rR",
          webDeploymentId: "545fd6ec-13d6-4d33-9f31-073f1ea3440e",
          operationsDeploymentId: "98beae70-56e2-426f-87e2-955c56fda0e5",
          queryDeploymentId: "266e4ccf-ac8e-4bff-8362-a925597debe0",
          protectedDataAuditReference: "audit-bridge-001",
        },
        {
          allowLoopbackForTest: true,
          env: {
            KT_PARITY_VERIFIER_URL: `http://127.0.0.1:${port}/v1/release-authority/parity/verify`,
            KT_PARITY_VERIFIER_TOKEN: "vitest_release_authority_read_token",
          },
        },
      );
      expect(parity.vercelSha).toBe(releaseSha);
      expect(parity.querySha).toBe(releaseSha);
      expect(parity.queryStatus).toBe("SUCCESS");
      expect(parity.protectedDataUnchanged).toBe(true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.close();
    }
  });
});
