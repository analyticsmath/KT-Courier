import { createServer } from "node:http";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { verifyProductionParityRemote } from "@/lib/production-readiness/verification-adapters.server";
import { captureProtectedRowAuditReceipt } from "@/scripts/audit-reviewed-production";
import { createReleaseAuthorityHandler } from "@/services/release-authority/src/app.mjs";
import {
  REQUIRED_PROTECTED_AUDIT_TABLES,
  computeAuditReceiptDigest,
} from "@/services/release-authority/src/audit-receipt.mjs";
import { createPostgresStore } from "@/services/release-authority/src/store.mjs";

async function seedIsolatedApplicationDb(appDb: PGlite) {
  for (const table of REQUIRED_PROTECTED_AUDIT_TABLES) {
    await appDb.query(`CREATE TABLE "${table}" ("id" TEXT PRIMARY KEY, "payload" TEXT NOT NULL);`);
  }
  await appDb.query(
    `CREATE TABLE "_prisma_migrations" ("id" TEXT PRIMARY KEY, "migration_name" TEXT NOT NULL, "finished_at" TIMESTAMPTZ);`,
  );
  await appDb.query(
    `INSERT INTO "_prisma_migrations" ("id", "migration_name", "finished_at") VALUES ('mig-1', '20261125000000_init', NOW());`,
  );
  await appDb.query(`INSERT INTO "User" ("id", "payload") VALUES ('u-1', 'initial-user');`);
  await appDb.query(`INSERT INTO "Order" ("id", "payload") VALUES ('ord-1', 'initial-order');`);
  await appDb.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC;`);
  await appDb.query(`CREATE ROLE kt_audit_ro WITH LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;`);
  await appDb.query(`GRANT USAGE ON SCHEMA public TO kt_audit_ro;`);
  await appDb.query(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO kt_audit_ro;`);
  await appDb.query(`CREATE ROLE kt_writable_role WITH LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;`);
  await appDb.query(`GRANT USAGE ON SCHEMA public TO kt_writable_role;`);
  await appDb.query(`GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO kt_writable_role;`);
}

describe("release-authority Postgres store, read-only audit verification, and parity bridge", () => {
  const releaseSha = "07a5f71a482f32e93d6f211fe99961e024fc9551";
  const deployments = {
    vercelDeploymentId: "dpl_5Dq9XL1B5eSp3VneVKh2mBqyg9rR",
    webDeploymentId: "545fd6ec-13d6-4d33-9f31-073f1ea3440e",
    operationsDeploymentId: "98beae70-56e2-426f-87e2-955c56fda0e5",
    queryDeploymentId: "266e4ccf-ac8e-4bff-8362-a925597debe0",
  };

  it("captures genuine PGlite read-only baseline/candidate receipts, enforces least-privilege & diff proofs, and blocks falsified parity refs", async () => {
    const authDb = new PGlite();
    const appDb = new PGlite();
    const pgStore = createPostgresStore({ pool: authDb });
    await pgStore.init();
    await seedIsolatedApplicationDb(appDb);

    // Prove kt_audit_ro is blocked from writes in PostgreSQL while app writer works normally
    await appDb.query("BEGIN");
    await appDb.query("SET LOCAL ROLE kt_audit_ro");
    await expect(appDb.query(`INSERT INTO "Order" ("id", "payload") VALUES ('ord-ro', 'blocked')`)).rejects.toThrow();
    await appDb.query("ROLLBACK");

    await appDb.query(`INSERT INTO "Store" ("id", "payload") VALUES ('store-pre', 'app-write-ok')`);

    const now = new Date("2026-11-25T02:00:00.000Z");
    const baseline = await captureProtectedRowAuditReceipt({
      releaseSha,
      receiptReference: "audit-baseline-001",
      executor: appDb,
      asRole: "kt_audit_ro",
      classification: "production",
      deployments,
      auditorPrincipal: "ops-auditor-01",
      ttlMinutes: 120,
      now: new Date(now.getTime() - 15 * 60_000),
    });
    expect(baseline.databaseIdentity.leastPrivilegeVerified).toBe(true);
    expect(baseline.comparison.baselinePresent).toBe(false);
    expect(baseline.comparison.eligibleForParity).toBe(false);

    const candidateUnchanged = await captureProtectedRowAuditReceipt({
      releaseSha,
      receiptReference: "audit-candidate-001",
      executor: appDb,
      asRole: "kt_audit_ro",
      classification: "production",
      baselineReceipt: baseline,
      deployments,
      auditorPrincipal: "ops-auditor-01",
      ttlMinutes: 120,
      now: new Date(now.getTime() - 5 * 60_000),
    });
    expect(candidateUnchanged.comparison.baselinePresent).toBe(true);
    expect(candidateUnchanged.comparison.unchanged).toBe(true);
    expect(candidateUnchanged.comparison.eligibleForParity).toBe(true);
    expect(candidateUnchanged.inventory.inventoryComplete).toBe(true);

    // Capturing under writable role must fail least-privilege
    const writableAttempt = await captureProtectedRowAuditReceipt({
      releaseSha,
      receiptReference: "audit-writable-001",
      executor: appDb,
      asRole: "kt_writable_role",
      classification: "production",
      baselineReceipt: baseline,
      deployments,
      auditorPrincipal: "ops-auditor-01",
      ttlMinutes: 120,
      now,
    });
    expect(writableAttempt.databaseIdentity.leastPrivilegeVerified).toBe(false);
    expect(writableAttempt.databaseIdentity.writableTables.length).toBeGreaterThan(0);

    // Mutating protected row shows real diff
    await appDb.query(`INSERT INTO "Order" ("id", "payload") VALUES ('ord-2', 'active-commerce-order')`);
    const undocumentedChanged = await captureProtectedRowAuditReceipt({
      releaseSha,
      receiptReference: "audit-changed-undoc-001",
      executor: appDb,
      asRole: "kt_audit_ro",
      classification: "production",
      baselineReceipt: baseline,
      deployments,
      auditorPrincipal: "ops-auditor-01",
      ttlMinutes: 120,
      now,
    });
    expect(undocumentedChanged.comparison.unchanged).toBe(false);
    expect(undocumentedChanged.comparison.changedTables).toEqual(["Order"]);
    expect(undocumentedChanged.comparison.eligibleForParity).toBe(false);

    const authorizedChanged = await captureProtectedRowAuditReceipt({
      releaseSha,
      receiptReference: "audit-changed-doc-001",
      executor: appDb,
      asRole: "kt_audit_ro",
      classification: "production",
      baselineReceipt: baseline,
      deployments,
      auditorPrincipal: "ops-auditor-01",
      reviewerPrincipal: "finance-reviewer-01",
      documentedOperationalChanges: ["Order"],
      documentedChangeReference: "CHG-2026-1125-01",
      documentedChangeReason: "Legitimate live order checkout during release verification window.",
      ttlMinutes: 120,
      now,
    });
    expect(authorizedChanged.comparison.unchanged).toBe(false);
    expect(authorizedChanged.comparison.eligibleForParity).toBe(true);
    expect(authorizedChanged.comparison.changedTables).toEqual(["Order"]);

    let currentNow = now;
    let readyPayload = { status: "ready", database: "reachable", redis: "connected" };
    const handler = createReleaseAuthorityHandler({
      store: pgStore,
      readToken: "vitest_release_authority_read_token",
      adminToken: "vitest_release_authority_admin_token",
      allowLoopbackForTest: true,
      now: () => currentNow,
      env: {
        NODE_ENV: "production",
        VERCEL_TOKEN: "v_tok",
        RAILWAY_API_TOKEN: "r_tok",
        KT_PRODUCTION_ORIGIN: "https://127.0.0.1",
      },
      fetchImpl: async (url) => {
        const target = String(url);
        if (target.includes("api.vercel.com")) {
          return new Response(JSON.stringify({ id: deployments.vercelDeploymentId, readyState: "READY", meta: { githubCommitSha: releaseSha } }), { status: 200 });
        }
        if (target.includes("backboard.railway.com")) {
          return new Response(
            JSON.stringify({
              data: {
                web: { id: deployments.webDeploymentId, status: "SUCCESS", meta: { commitHash: releaseSha }, service: { name: "web" } },
                operations: { id: deployments.operationsDeploymentId, status: "SUCCESS", meta: { commitHash: releaseSha }, service: { name: "operations" } },
                query: { id: deployments.queryDeploymentId, status: "SUCCESS", meta: { commitHash: releaseSha }, service: { name: "query-storefront-categories" } },
              },
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify(readyPayload), { status: 200 });
      },
    });

    const server = createServer(handler);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const origin = `http://127.0.0.1:${port}`;
    const verifierUrl = `${origin}/v1/release-authority/parity/verify`;

    try {
      // Negative 1: arbitrary nonexistent reference MUST NOT manufacture pass
      await expect(
        verifyProductionParityRemote(
          { releaseSha, ...deployments, protectedDataAuditReference: "audit-bridge-001" },
          {
            allowLoopbackForTest: true,
            now,
            env: { KT_PARITY_VERIFIER_URL: verifierUrl, KT_PARITY_VERIFIER_TOKEN: "vitest_release_authority_read_token" },
          },
        ),
      ).rejects.toMatchObject({ code: "AUDIT_RECEIPT_NOT_FOUND", status: 409 });

      // Baseline receipt can be persisted for provenance, yet parity verification rejects BASELINE_CAPTURE_ONLY
      const putBaselineRes = await fetch(`${origin}/v1/release-authority/admin/audits`, {
        method: "PUT",
        headers: { authorization: "Bearer vitest_release_authority_admin_token", "content-type": "application/json" },
        body: JSON.stringify({ receipt: baseline }),
      });
      expect(putBaselineRes.status).toBe(201);
      await expect(
        verifyProductionParityRemote(
          { releaseSha, ...deployments, protectedDataAuditReference: baseline.receiptReference },
          {
            allowLoopbackForTest: true,
            now,
            env: { KT_PARITY_VERIFIER_URL: verifierUrl, KT_PARITY_VERIFIER_TOKEN: "vitest_release_authority_read_token" },
          },
        ),
      ).rejects.toMatchObject({ code: "AUDIT_BASELINE_MISSING", status: 409 });

      // Negative 2: writable role, undocumented change, self-reviewed change, incomplete inventory, wrong classification, & tampered receipts rejected immediately on ingest
      const missingTableSnapshots = Object.fromEntries(
        Object.entries(candidateUnchanged.snapshots.candidateProtected).filter(([k]) => k !== "Order"),
      );
      const incompleteReceiptBody = {
        ...candidateUnchanged,
        inventory: {
          ...candidateUnchanged.inventory,
          auditedTablesCount: Object.keys(missingTableSnapshots).length,
          missingRequiredTables: [],
          inventoryComplete: true,
        },
        snapshots: {
          ...candidateUnchanged.snapshots,
          candidateProtected: missingTableSnapshots,
        },
      };
      const isolatedClassBody = {
        ...candidateUnchanged,
        receiptReference: "audit-isolated-001",
        databaseIdentity: { ...candidateUnchanged.databaseIdentity, classification: "isolated_test" as const },
      };
      const selfReviewedBody = {
        ...authorizedChanged,
        receiptReference: "audit-selfrev-001",
        provenance: { ...authorizedChanged.provenance, reviewerPrincipal: authorizedChanged.provenance.auditorPrincipal },
      };
      for (const badReceipt of [
        writableAttempt,
        undocumentedChanged,
        { ...incompleteReceiptBody, receiptDigest: computeAuditReceiptDigest(incompleteReceiptBody) },
        { ...selfReviewedBody, receiptDigest: computeAuditReceiptDigest(selfReviewedBody) },
        {
          ...candidateUnchanged,
          snapshots: { ...candidateUnchanged.snapshots, candidateDigest: "f".repeat(64) },
          receiptDigest: computeAuditReceiptDigest({
            ...candidateUnchanged,
            snapshots: { ...candidateUnchanged.snapshots, candidateDigest: "f".repeat(64) },
          }),
        },
        { ...candidateUnchanged, receiptDigest: "0".repeat(64) },
      ]) {
        const res = await fetch(`${origin}/v1/release-authority/admin/audits`, {
          method: "PUT",
          headers: { authorization: "Bearer vitest_release_authority_admin_token", "content-type": "application/json" },
          body: JSON.stringify({ receipt: badReceipt }),
        });
        expect(res.ok).toBe(false);
      }

      // Ingest isolated_test classification receipt, then verify production parity rejects isolated_test classification
      const putIsolatedRes = await fetch(`${origin}/v1/release-authority/admin/audits`, {
        method: "PUT",
        headers: { authorization: "Bearer vitest_release_authority_admin_token", "content-type": "application/json" },
        body: JSON.stringify({ receipt: { ...isolatedClassBody, receiptDigest: computeAuditReceiptDigest(isolatedClassBody) } }),
      });
      expect(putIsolatedRes.status).toBe(201);
      await expect(
        verifyProductionParityRemote(
          { releaseSha, ...deployments, protectedDataAuditReference: "audit-isolated-001" },
          {
            allowLoopbackForTest: true,
            now,
            env: { KT_PARITY_VERIFIER_URL: verifierUrl, KT_PARITY_VERIFIER_TOKEN: "vitest_release_authority_read_token" },
          },
        ),
      ).rejects.toMatchObject({ code: "PARITY_VERIFICATION_MISMATCH", status: 409 });

      // Omitting KT_PARITY_VERIFIER_URL always fails closed (never falls back to app DB)
      await expect(
        verifyProductionParityRemote(
          { releaseSha, ...deployments, protectedDataAuditReference: candidateUnchanged.receiptReference },
          { allowLoopbackForTest: true, now, env: {} },
        ),
      ).rejects.toMatchObject({ code: "PARITY_VERIFICATION_UNAVAILABLE", status: 409 });

      // Non-admin read token cannot ingest audit receipts
      const forbiddenPut = await fetch(`${origin}/v1/release-authority/admin/audits`, {
        method: "PUT",
        headers: { authorization: "Bearer vitest_release_authority_read_token", "content-type": "application/json" },
        body: JSON.stringify({ receipt: candidateUnchanged }),
      });
      expect(forbiddenPut.status).toBe(403);

      // Ingest genuine unchanged candidate receipt & authorized active-commerce receipt
      for (const goodReceipt of [candidateUnchanged, authorizedChanged]) {
        const ingestRes = await fetch(`${origin}/v1/release-authority/admin/audits`, {
          method: "PUT",
          headers: { authorization: "Bearer vitest_release_authority_admin_token", "content-type": "application/json" },
          body: JSON.stringify({ receipt: goodReceipt }),
        });
        expect(ingestRes.status).toBe(201);
      }

      // Positive 1: unchanged candidate receipt passes verification cleanly
      const parity = await verifyProductionParityRemote(
        { releaseSha, ...deployments, protectedDataAuditReference: candidateUnchanged.receiptReference },
        {
          allowLoopbackForTest: true,
          now,
          env: { KT_PARITY_VERIFIER_URL: verifierUrl, KT_PARITY_VERIFIER_TOKEN: "vitest_release_authority_read_token" },
        },
      );
      expect(parity.vercelSha).toBe(releaseSha);
      expect(parity.querySha).toBe(releaseSha);
      expect(parity.leastPrivilege).toBe(true);
      expect(parity.auditBaselinePresent).toBe(true);
      expect(parity.auditInventoryComplete).toBe(true);
      expect(parity.auditParityEligible).toBe(true);
      expect(parity.protectedDataUnchanged).toBe(true);
      expect(parity.auditDigest).toBe(candidateUnchanged.receiptDigest);

      // Positive 2: documented active-commerce change passes parity WITHOUT falsely claiming unchanged=true
      const commerceParity = await verifyProductionParityRemote(
        { releaseSha, ...deployments, protectedDataAuditReference: authorizedChanged.receiptDigest },
        {
          allowLoopbackForTest: true,
          now,
          env: { KT_PARITY_VERIFIER_URL: verifierUrl, KT_PARITY_VERIFIER_TOKEN: "vitest_release_authority_read_token" },
        },
      );
      expect(commerceParity.protectedDataUnchanged).toBe(false);
      expect(commerceParity.auditParityEligible).toBe(true);
      expect(commerceParity.auditChangedTables).toEqual(["Order"]);

      // Negative 3: mismatching expected DB or deployment ID fails closed
      await expect(
        verifyProductionParityRemote(
          { ...deployments, releaseSha, webDeploymentId: "wrong-web-id", protectedDataAuditReference: candidateUnchanged.receiptReference },
          {
            allowLoopbackForTest: true,
            now,
            env: { KT_PARITY_VERIFIER_URL: verifierUrl, KT_PARITY_VERIFIER_TOKEN: "vitest_release_authority_read_token" },
          },
        ),
      ).rejects.toMatchObject({ status: 409 });

      // Negative 4: unhealthy Redis fails even when audit receipt is valid
      readyPayload = { status: "ready", database: "reachable", redis: "error" };
      await expect(
        verifyProductionParityRemote(
          { releaseSha, ...deployments, protectedDataAuditReference: candidateUnchanged.receiptReference },
          {
            allowLoopbackForTest: true,
            now,
            env: { KT_PARITY_VERIFIER_URL: verifierUrl, KT_PARITY_VERIFIER_TOKEN: "vitest_release_authority_read_token" },
          },
        ),
      ).rejects.toMatchObject({ status: 409 });
      readyPayload = { status: "ready", database: "reachable", redis: "connected" };

      // Negative 5: expired receipt fails closed both client-side and server-side
      await expect(
        verifyProductionParityRemote(
          { releaseSha, ...deployments, protectedDataAuditReference: candidateUnchanged.receiptReference },
          {
            allowLoopbackForTest: true,
            now: new Date(now.getTime() + 24 * 60 * 60_000),
            env: { KT_PARITY_VERIFIER_URL: verifierUrl, KT_PARITY_VERIFIER_TOKEN: "vitest_release_authority_read_token" },
          },
        ),
      ).rejects.toMatchObject({ code: "STALE_EVIDENCE", status: 409 });

      currentNow = new Date(now.getTime() + 24 * 60 * 60_000);
      await expect(
        verifyProductionParityRemote(
          { releaseSha, ...deployments, protectedDataAuditReference: candidateUnchanged.receiptReference },
          {
            allowLoopbackForTest: true,
            now: currentNow,
            env: { KT_PARITY_VERIFIER_URL: verifierUrl, KT_PARITY_VERIFIER_TOKEN: "vitest_release_authority_read_token" },
          },
        ),
      ).rejects.toMatchObject({ code: "STALE_EVIDENCE", status: 409 });
      currentNow = now;

      // Negative 6: revoked audit receipt immediately blocks parity
      const revRes = await fetch(`${origin}/v1/release-authority/admin/revocations`, {
        method: "POST",
        headers: { authorization: "Bearer vitest_release_authority_admin_token", "content-type": "application/json" },
        body: JSON.stringify({ kind: "audit_receipt", targetId: candidateUnchanged.receiptReference, reason: "Role rotation test" }),
      });
      expect(revRes.status).toBe(200);
      await expect(
        verifyProductionParityRemote(
          { releaseSha, ...deployments, protectedDataAuditReference: candidateUnchanged.receiptReference },
          {
            allowLoopbackForTest: true,
            now,
            env: { KT_PARITY_VERIFIER_URL: verifierUrl, KT_PARITY_VERIFIER_TOKEN: "vitest_release_authority_read_token" },
          },
        ),
      ).rejects.toMatchObject({ code: "AUDIT_RECEIPT_REVOKED", status: 409 });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await appDb.close();
      await authDb.close();
    }
  }, 60_000);
});
