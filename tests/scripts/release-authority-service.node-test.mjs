import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

import { authorizeProductionRelease } from "../../scripts/verify-release-authorization.mjs";
import { createReleaseAuthorityHandler } from "../../services/release-authority/src/app.mjs";
import { collectVerifiedReleaseContext } from "../../services/release-authority/src/collectors.mjs";
import {
  assembleSignedEnvelope,
  buildTrustBundle,
  buildUnsignedPayloadV2,
  generateRoleKeypair,
  signRoleApproval,
} from "../../services/release-authority/src/signing.mjs";
import {
  AUDIT_RECEIPT_SCHEMA_VERSION,
  REQUIRED_PROTECTED_AUDIT_TABLES,
  computeAuditReceiptDigest,
  computeProtectedSnapshotDigest,
  evaluateAuditComparison,
  hashAuditHost,
} from "../../services/release-authority/src/audit-receipt.mjs";
import { createDurableFileStore, createPostgresStore } from "../../services/release-authority/src/store.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function buildMockUpstreamFetch(commitSha, treeSha) {
  const certJobs = [
    "quality",
    "postgres (docker:migration-smoke)",
    "postgres (test:integration:auth)",
    "postgres (test:integration:permissions)",
    "postgres (test:integration:orders)",
    "postgres (test:integration:pricing)",
    "postgres (test:integration:dispatch)",
    "postgres (test:integration:cross-module)",
    "postgres (test:integration:driver-operations)",
    "postgres (test:integration:ledger)",
    "postgres (test:integration:payment-foundation)",
    "postgres (test:integration:refunds)",
    "postgres (test:integration:withdrawals)",
    "postgres (test:integration:store-earnings)",
    "postgres (test:integration:driver-earnings)",
    "postgres (test:integration:marketplace-checkout)",
    "postgres (test:integration:store-orders)",
    "postgres (test:integration:storefront)",
    "postgres (test:integration:catalog)",
    "postgres (test:integration:closure)",
    "postgres (docker:gate4)",
    "redis-and-recovery",
    "recovery",
    "browser",
    "Phase 2 automated engineering verification (not live launch approval)",
    "Release authorization status (informational)",
  ].map((name) => ({ name, conclusion: "success" }));

  const ciJobs = [
    "quality",
    "container-build",
    "migration-smoke",
    "pricing-integration",
    "dispatch-integration",
    "cross-module-integration",
    "ledger-integration",
    "Phase 1 Release-Critical Verification (Paystack, Invariants, Security, Processors, Refunds)",
    "Phase 1 PostgreSQL Webhook Concurrency Integration",
    "docker-runtime",
  ].map((name) => ({ name, conclusion: "success" }));

  return async (url) => {
    const target = String(url);
    if (target.endsWith(`/git/commits/${commitSha}`)) {
      return new Response(JSON.stringify({ tree: { sha: treeSha } }), { status: 200 });
    }
    if (target.endsWith("/actions/runs/45352739658")) {
      return new Response(
        JSON.stringify({
          head_sha: commitSha,
          head_branch: "main",
          path: ".github/workflows/ci.yml",
          status: "completed",
          conclusion: "success",
          run_attempt: 1,
        }),
        { status: 200 },
      );
    }
    if (target.endsWith("/actions/runs/45352739746")) {
      return new Response(
        JSON.stringify({
          head_sha: commitSha,
          head_branch: "main",
          path: ".github/workflows/production-certification.yml",
          status: "completed",
          conclusion: "success",
          run_attempt: 1,
        }),
        { status: 200 },
      );
    }
    if (target.includes("/actions/runs/45352739658/attempts/1/jobs")) {
      return new Response(JSON.stringify({ total_count: ciJobs.length, jobs: ciJobs }), { status: 200 });
    }
    if (target.includes("/actions/runs/45352739746/attempts/1/jobs")) {
      return new Response(JSON.stringify({ total_count: certJobs.length, jobs: certJobs }), { status: 200 });
    }
    if (target.includes("api.vercel.com/v13/deployments/dpl_5Dq9XL1B5eSp3VneVKh2mBqyg9rR")) {
      return new Response(
        JSON.stringify({
          id: "dpl_5Dq9XL1B5eSp3VneVKh2mBqyg9rR",
          readyState: "READY",
          target: "production",
          meta: { githubCommitSha: commitSha },
        }),
        { status: 200 },
      );
    }
    if (target.includes("backboard.railway.com/graphql/v2")) {
      return new Response(
        JSON.stringify({
          data: {
            web: { id: "545fd6ec-13d6-4d33-9f31-073f1ea3440e", status: "SUCCESS", meta: { commitHash: commitSha }, service: { name: "web" } },
            operations: { id: "98beae70-56e2-426f-87e2-955c56fda0e5", status: "SUCCESS", meta: { commitHash: commitSha }, service: { name: "operations" } },
            query: { id: "266e4ccf-ac8e-4bff-8362-a925597debe0", status: "SUCCESS", meta: { commitHash: commitSha }, service: { name: "query-storefront-categories" } },
          },
        }),
        { status: 200 },
      );
    }
    if (target.endsWith("/api/infrastructure/ready")) {
      return new Response(
        JSON.stringify({ status: "ready", database: "reachable", redis: "connected" }),
        { status: 200 },
      );
    }
    return new Response("not found", { status: 404 });
  };
}

function buildDomainInputs(nowMs, commitSha, receiptReference = `audit-${commitSha.slice(0, 8)}-001`) {
  const snapshots = Object.fromEntries(
    REQUIRED_PROTECTED_AUDIT_TABLES.map((table, i) => [
      table,
      { count: i + 1, hash: i.toString(16).padStart(64, "0") },
    ]),
  );
  const snapDigest = computeProtectedSnapshotDigest(snapshots);
  const baselineAt = new Date(nowMs - 20 * 60_000).toISOString();
  const observedAt = new Date(nowMs - 5 * 60_000).toISOString();
  const expiresAt = new Date(nowMs + 30 * 60_000).toISOString();
  const receiptBody = {
    schemaVersion: AUDIT_RECEIPT_SCHEMA_VERSION,
    receiptReference,
    releaseSha: commitSha,
    baselineReference: `${receiptReference}-base`,
    baselineSha: commitSha,
    baselineAt,
    observedAt,
    expiresAt,
    window: {
      captureMode: "BEFORE_AND_AFTER_COMPARISON",
      windowStart: baselineAt,
      windowEnd: observedAt,
    },
    deployments: {
      vercelDeploymentId: "dpl_5Dq9XL1B5eSp3VneVKh2mBqyg9rR",
      webDeploymentId: "545fd6ec-13d6-4d33-9f31-073f1ea3440e",
      operationsDeploymentId: "98beae70-56e2-426f-87e2-955c56fda0e5",
      queryDeploymentId: "266e4ccf-ac8e-4bff-8362-a925597debe0",
    },
    databaseIdentity: {
      database: "kt_prod",
      role: "kt_audit_ro",
      classification: "production",
      hostDigest: hashAuditHost("db.internal:5432"),
      transactionReadOnly: "on",
      rolsuper: false,
      rolbypassrls: false,
      writableTables: [],
      leastPrivilegeVerified: true,
      privilegeFindings: [],
    },
    inventory: {
      requiredTablesCount: REQUIRED_PROTECTED_AUDIT_TABLES.length,
      auditedTablesCount: REQUIRED_PROTECTED_AUDIT_TABLES.length,
      missingRequiredTables: [],
      inventoryComplete: true,
      migrationCount: 132,
      latestMigration: "20261125000000_parity_evidence_correction",
    },
    snapshots: {
      baselineDigest: snapDigest,
      candidateDigest: snapDigest,
      baselineProtected: snapshots,
      candidateProtected: snapshots,
    },
    comparison: evaluateAuditComparison(snapshots, snapshots),
    provenance: {
      auditorPrincipal: "ops-auditor-01",
      reviewerPrincipal: null,
      captureSource: "DEDICATED_READONLY_CLI",
    },
  };
  const auditReceipt = { ...receiptBody, receiptDigest: computeAuditReceiptDigest(receiptBody) };

  const evidence = Object.fromEntries(
    ["provider", "packing", "driver_store", "physical_pod", "tax_finance", "notification", "media", "database_audit"].map((k) => [
      k,
      k === "database_audit"
        ? {
            reference: auditReceipt.receiptReference,
            digest: auditReceipt.receiptDigest,
            observedAt,
            expiresAt,
          }
        : {
            reference: `ev-${k}-001`,
            digest: sha256(`ev-${k}-001`),
            observedAt,
            expiresAt,
          },
    ]),
  );
  return {
    evidence,
    policies: { cod: "cod-v2", commission: "comm-v2", retention: "ret-v2" },
    auditReceipt,
  };
}

async function exerciseFullServiceLifecycle(store, { name }) {
  const now = new Date("2026-11-24T12:00:00.000Z");
  const commitSha = "07a5f71a482f32e93d6f211fe99961e024fc9551";
  const treeSha = "2222222222222222222222222222222222222222";
  const evidenceReference = "rel-auth-2026-11-24-live-01";
  const readToken = "read_bearer_token_for_service_test_001";
  const adminToken = "admin_bearer_token_for_service_test_002";

  const keys = {
    operator: generateRoleKeypair({ role: "operator", principal: "ops-signer-01" }),
    finance: generateRoleKeypair({ role: "finance", principal: "fin-signer-01" }),
    database: generateRoleKeypair({ role: "database", principal: "db-signer-01" }),
    security: generateRoleKeypair({ role: "security", principal: "sec-signer-01" }),
  };
  const { trust, trustSha256 } = buildTrustBundle(Object.values(keys));

  await store.init();
  const handler = createReleaseAuthorityHandler({
    store,
    readToken,
    adminToken,
    now: () => now,
    allowLoopbackForTest: true,
    fetchImpl: buildMockUpstreamFetch(commitSha, treeSha),
    env: {
      GITHUB_RELEASE_READ_TOKEN: "ghp_service_collector_token",
      VERCEL_TOKEN: "vercel_service_collector_token",
      RAILWAY_API_TOKEN: "railway_service_collector_token",
      KT_PRODUCTION_ORIGIN: "https://127.0.0.1",
    },
  });

  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;
  const outDir = mkdtempSync(path.join(os.tmpdir(), "kt-ra-svc-"));

  try {
    // 1. Public liveness works, admin routes reject read token
    const healthRes = await fetch(`${origin}/healthz`);
    assert.equal(healthRes.status, 200);
    const forbiddenAdmin = await fetch(`${origin}/v1/release-authority/admin/trust`, {
      method: "PUT",
      headers: { authorization: `Bearer ${readToken}`, "content-type": "application/json" },
      body: JSON.stringify({ trust }),
    });
    assert.equal(forbiddenAdmin.status, 403);

    // 2. Admin uploads trust bundle + runs collector -> gets verified context
    const putTrustRes = await fetch(`${origin}/v1/release-authority/admin/trust`, {
      method: "PUT",
      headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
      body: JSON.stringify({ trust }),
    });
    assert.equal(putTrustRes.status, 200);

    const { evidence, policies, auditReceipt } = buildDomainInputs(now.getTime(), commitSha, `audit-${name}-001`);

    // Unpersisted boolean audit claims in /admin/collect must fail closed
    const collectWithoutAuditRes = await fetch(`${origin}/v1/release-authority/admin/collect`, {
      method: "POST",
      headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        commitSha,
        evidenceReference,
        ciRunId: 45352739658,
        certificationRunId: 45352739746,
        vercelDeploymentId: "dpl_5Dq9XL1B5eSp3VneVKh2mBqyg9rR",
        webDeploymentId: "545fd6ec-13d6-4d33-9f31-073f1ea3440e",
        operationsDeploymentId: "98beae70-56e2-426f-87e2-955c56fda0e5",
        queryDeploymentId: "266e4ccf-ac8e-4bff-8362-a925597debe0",
        policies,
        evidence,
        auditReceipt: { releaseSha: commitSha, protectedDataUnchanged: true, leastPrivilege: true },
      }),
    });
    assert.equal(collectWithoutAuditRes.ok, false, `${name}: expected unpersisted audit collect to reject`);

    const putAuditRes = await fetch(`${origin}/v1/release-authority/admin/audits`, {
      method: "PUT",
      headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
      body: JSON.stringify({ receipt: auditReceipt }),
    });
    assert.equal(putAuditRes.status, 201, `${name}: ingesting verified audit receipt failed`);

    const getAuditRes = await fetch(`${origin}/v1/release-authority/audits/${encodeURIComponent(auditReceipt.receiptReference)}`, {
      headers: { authorization: `Bearer ${readToken}` },
    });
    assert.equal(getAuditRes.status, 200);

    const collectRes = await fetch(`${origin}/v1/release-authority/admin/collect`, {
      method: "POST",
      headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        commitSha,
        evidenceReference,
        ciRunId: 45352739658,
        certificationRunId: 45352739746,
        vercelDeploymentId: "dpl_5Dq9XL1B5eSp3VneVKh2mBqyg9rR",
        webDeploymentId: "545fd6ec-13d6-4d33-9f31-073f1ea3440e",
        operationsDeploymentId: "98beae70-56e2-426f-87e2-955c56fda0e5",
        queryDeploymentId: "266e4ccf-ac8e-4bff-8362-a925597debe0",
        policies,
        evidence,
        auditReference: auditReceipt.receiptReference,
      }),
    });
    assert.equal(collectRes.status, 201, `${name}: admin collect failed`);
    const { context } = await collectRes.json();
    assert.equal(context.treeSha, treeSha);

    // 3. Offline 4-role human signing ceremony (never stored on server)
    const unsignedPayload = buildUnsignedPayloadV2({
      verifiedContext: context,
      maker: "release-maker-01",
      issuanceId: `issuance-${name}-20261124-0001`,
      issuedAt: new Date(now.getTime() - 2 * 60_000).toISOString(),
      expiresAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
    });
    const approvals = Object.values(keys).map((k) =>
      signRoleApproval({
        payload: unsignedPayload,
        role: k.role,
        principal: k.principal,
        keyId: k.keyId,
        privateKeyPem: k.privateKeyPem,
      }),
    );
    const envelope = assembleSignedEnvelope({
      payload: unsignedPayload,
      approvals,
      trust,
      nowMs: now.getTime(),
    });

    const putEnvRes = await fetch(`${origin}/v1/release-authority/admin/envelopes`, {
      method: "PUT",
      headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
      body: JSON.stringify({ evidenceReference, envelope }),
    });
    assert.equal(putEnvRes.status, 201);

    // 4. authorizeProductionRelease executes end-to-end against live HTTP service using remote pinned trust SHA-256
    const authResult = await authorizeProductionRelease({
      releaseSha: commitSha,
      workflowSha: commitSha,
      sourceSha: commitSha,
      treeSha,
      evidenceReference,
      now,
      outputDir: outDir,
      allowLoopbackForTest: true,
      env: {
        RELEASE_AUTHORITY_ORIGIN: origin,
        RELEASE_AUTHORITY_ALLOWED_ORIGIN: origin,
        RELEASE_AUTHORITY_TOKEN: readToken,
        RELEASE_AUTHORITY_TRUST_SHA256: trustSha256,
      },
    });
    assert.equal(authResult.releaseAuthorized, true, `${name}: expected authorized`);
    assert.equal(authResult.status, "RELEASE_AUTHORIZED");
    assert.ok(authResult.receiptId.startsWith("rcpt_"));

    // 5. Immediate replay of same issuanceId fails atomically with ISSUANCE_REPLAYED
    const replayResult = await authorizeProductionRelease({
      releaseSha: commitSha,
      workflowSha: commitSha,
      sourceSha: commitSha,
      treeSha,
      evidenceReference,
      now,
      outputDir: outDir,
      allowLoopbackForTest: true,
      env: {
        RELEASE_AUTHORITY_ORIGIN: origin,
        RELEASE_AUTHORITY_ALLOWED_ORIGIN: origin,
        RELEASE_AUTHORITY_TOKEN: readToken,
        RELEASE_AUTHORITY_TRUST_SHA256: trustSha256,
      },
    });
    assert.equal(replayResult.releaseAuthorized, false);
    assert.equal(replayResult.reason, "ISSUANCE_REPLAYED");

    // 6. Revocation of a key/evidence immediately blocks fresh issuance for same reference
    const revRes = await fetch(`${origin}/v1/release-authority/admin/revocations`, {
      method: "POST",
      headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
      body: JSON.stringify({ kind: "evidence_reference", targetId: evidenceReference, reason: "Post-release rotation drill" }),
    });
    assert.equal(revRes.status, 200);
    const afterRevRes = await authorizeProductionRelease({
      releaseSha: commitSha,
      workflowSha: commitSha,
      sourceSha: commitSha,
      treeSha,
      evidenceReference,
      now,
      outputDir: outDir,
      allowLoopbackForTest: true,
      env: {
        RELEASE_AUTHORITY_ORIGIN: origin,
        RELEASE_AUTHORITY_ALLOWED_ORIGIN: origin,
        RELEASE_AUTHORITY_TOKEN: readToken,
        RELEASE_AUTHORITY_TRUST_SHA256: trustSha256,
      },
    });
    assert.equal(afterRevRes.releaseAuthorized, false);
    assert.equal(afterRevRes.reason, "EVIDENCE_REVOKED");
  } finally {
    await new Promise((resolve) => server.close(() => resolve()));
    rmSync(outDir, { recursive: true, force: true });
  }
}

test("services/release-authority executes end-to-end via durable file store and real Postgres SQL (PGlite)", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "kt-ra-filestore-"));
  const db = new PGlite();
  try {
    const fileStore = createDurableFileStore(dataDir);
    await exerciseFullServiceLifecycle(fileStore, { name: "filestore" });

    const pgStore = createPostgresStore({ pool: db });
    await exerciseFullServiceLifecycle(pgStore, { name: "postgres" });

    // Confirm collector utility requires persisted verified audit receipt and exports clean verified snapshot
    const commitSha = "07a5f71a482f32e93d6f211fe99961e024fc9551";
    const treeSha = "2222222222222222222222222222222222222222";
    const directInputs = buildDomainInputs(Date.parse("2026-11-24T12:00:00.000Z"), commitSha, "audit-direct-collect-01");
    await pgStore.putAuditReceipt({
      receipt: directInputs.auditReceipt,
      ingestedBy: "test-collector",
      ingestedAt: "2026-11-24T11:58:00.000Z",
    });

    await assert.rejects(
      () =>
        collectVerifiedReleaseContext(
          {
            commitSha,
            evidenceReference: "collect-direct-no-store",
            ciRunId: 45352739658,
            certificationRunId: 45352739746,
            vercelDeploymentId: "dpl_5Dq9XL1B5eSp3VneVKh2mBqyg9rR",
            webDeploymentId: "545fd6ec-13d6-4d33-9f31-073f1ea3440e",
            operationsDeploymentId: "98beae70-56e2-426f-87e2-955c56fda0e5",
            queryDeploymentId: "266e4ccf-ac8e-4bff-8362-a925597debe0",
            ...directInputs,
            auditReference: directInputs.auditReceipt.receiptReference,
          },
          {
            env: {
              GITHUB_RELEASE_READ_TOKEN: "ghp_tok",
              VERCEL_TOKEN: "ver_tok",
              RAILWAY_API_TOKEN: "rail_tok",
              KT_PRODUCTION_ORIGIN: "https://127.0.0.1",
            },
            allowLoopbackForTest: true,
            fetchImpl: buildMockUpstreamFetch(commitSha, treeSha),
          },
        ),
      (err) => err?.code === "AUDIT_STORE_UNAVAILABLE",
    );

    const collected = await collectVerifiedReleaseContext(
      {
        commitSha,
        evidenceReference: "collect-direct-01",
        ciRunId: 45352739658,
        certificationRunId: 45352739746,
        vercelDeploymentId: "dpl_5Dq9XL1B5eSp3VneVKh2mBqyg9rR",
        webDeploymentId: "545fd6ec-13d6-4d33-9f31-073f1ea3440e",
        operationsDeploymentId: "98beae70-56e2-426f-87e2-955c56fda0e5",
        queryDeploymentId: "266e4ccf-ac8e-4bff-8362-a925597debe0",
        ...directInputs,
        auditReference: directInputs.auditReceipt.receiptReference,
      },
      {
        store: pgStore,
        now: () => new Date("2026-11-24T12:00:00.000Z"),
        env: {
          GITHUB_RELEASE_READ_TOKEN: "ghp_tok",
          VERCEL_TOKEN: "ver_tok",
          RAILWAY_API_TOKEN: "rail_tok",
          KT_PRODUCTION_ORIGIN: "https://127.0.0.1",
        },
        allowLoopbackForTest: true,
        fetchImpl: buildMockUpstreamFetch(commitSha, treeSha),
      },
    );
    assert.equal(collected.deployments.railwayQuery.serviceName, "query-storefront-categories");
    assert.equal(collected.auditReceipt.reference, directInputs.auditReceipt.receiptReference);
    assert.equal(collected.auditReceipt.leastPrivilege, true);
  } finally {
    await db.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
});
