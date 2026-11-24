import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import yaml from "js-yaml";

import { canonicalBytes } from "../../scripts/release-attestation.mjs";
import { authorizeProductionRelease } from "../../scripts/verify-release-authorization.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function makeSigner(role, principal, revoked = false) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const keyId = `key-${role}-${principal}`;
  return {
    keyId,
    role,
    principal,
    revoked,
    publicKeyPem: publicKey.export({ format: "pem", type: "spki" }).toString(),
    privateKey,
  };
}

function buildFixture(overrides = {}) {
  const now = new Date("2026-11-24T12:00:00.000Z");
  const commitSha = overrides.commitSha ?? "691ebded959858e86b4cb28674f52394c1f5676c";
  const treeSha = overrides.treeSha ?? "1111111111111111111111111111111111111111";
  const evidenceReference = overrides.evidenceReference ?? "rel-auth-2026-11-24-001";
  const issuanceId = overrides.issuanceId ?? "issuance-20261124-ktcourier-prod-0001";
  const ciEvidenceDigest = overrides.ciEvidenceDigest ?? sha256("ci-cert-artifact-691ebded");

  const signers = overrides.signers ?? {
    operator: makeSigner("operator", "ops-reviewer-01"),
    finance: makeSigner("finance", "finance-reviewer-01"),
    database: makeSigner("database", "db-reviewer-01"),
    security: makeSigner("security", "sec-reviewer-01"),
  };

  const deployments = {
    vercel: "dpl_5Dq9XL1B5eSp3VneVKh2mBqyg9rR",
    railwayWeb: "545fd6ec-13d6-4d33-9f31-073f1ea3440e",
    railwayOperations: "98beae70-56e2-426f-87e2-955c56fda0e5",
    railwayQuery: "266e4ccf-ac8e-4bff-8362-a925597debe0",
    ...overrides.deployments,
  };

  const attestedEvidence = Object.fromEntries(
    ["provider", "packing", "driver_store", "physical_pod", "tax_finance", "notification", "media", "database_audit"].map((k) => [
      k,
      { reference: `ev-${k}-001`, digest: sha256(`ev-${k}-001`), ...(overrides.evidence?.[k] ?? {}) },
    ]),
  );

  const scope = overrides.scope ?? {
    mandatoryChecks: ["checkout", "cod", "store_operational_policy", "commissions", "notifications", "retention", "audit"],
    excludedCapabilities: ["ADVERTISING", "PROMOTERS", "SUBSCRIPTIONS"],
  };

  const policies = overrides.policies ?? {
    cod: "cod-v1",
    commission: "comm-v1",
    retention: "ret-v1",
  };

  const payload = {
    version: 1,
    repository: "analyticsmath/KT-Courier",
    environment: "production",
    audience: "kt-couriers-release",
    commitSha,
    treeSha,
    ciRunId: "45352739746",
    ciEvidenceDigest,
    deployments: {
      vercel: deployments.vercel,
      railwayWeb: deployments.railwayWeb,
      railwayOperations: deployments.railwayOperations,
    },
    scope: [...scope.mandatoryChecks],
    policies,
    evidence: attestedEvidence,
    maker: "maker-author-01",
    issuanceId,
    issuedAt: "2026-11-24T11:55:00.000Z",
    expiresAt: "2026-11-24T12:08:00.000Z",
    ...overrides.payload,
  };

  const approvals = ["operator", "finance", "database", "security"].map((role) => {
    const s = signers[role];
    const claim = { role, principal: s.principal, keyId: s.keyId };
    return {
      role,
      principal: s.principal,
      keyId: s.keyId,
      signature: sign(null, canonicalBytes({ payload, claim }), s.privateKey).toString("base64"),
      ...(overrides.approvalOverrides?.[role] ?? {}),
    };
  });

  const envelope = { payload, approvals };

  const trust = {};
  for (const s of Object.values(signers)) {
    trust[s.keyId] = {
      roles: [s.role],
      principal: s.principal,
      publicKey: s.publicKeyPem,
      revoked: s.revoked,
    };
  }
  if (overrides.trustMutator) overrides.trustMutator(trust);

  const verifiedContext = {
    repository: "analyticsmath/KT-Courier",
    environment: "production",
    audience: "kt-couriers-release",
    commitSha,
    treeSha,
    evidenceReference,
    ciRun: {
      id: 45352739658,
      workflowName: "CI",
      headSha: commitSha,
      status: "completed",
      conclusion: "success",
      mandatoryJobsSucceeded: true,
      skippedCriticalJobs: 0,
      artifactDigest: sha256("ci-main-45352739658"),
    },
    certificationRun: {
      id: 45352739746,
      workflowName: "Engineering Certification",
      headSha: commitSha,
      status: "completed",
      conclusion: "success",
      jobsPassed: 26,
      jobsTotal: 26,
      skippedJobs: 0,
      evidenceDigest: ciEvidenceDigest,
    },
    deployments: {
      vercel: { id: deployments.vercel, sha: commitSha, state: "READY", target: "production" },
      railwayWeb: { id: deployments.railwayWeb, sha: commitSha, status: "SUCCESS" },
      railwayOperations: { id: deployments.railwayOperations, sha: commitSha, status: "SUCCESS" },
      railwayQuery: { id: deployments.railwayQuery, sha: commitSha, status: "SUCCESS" },
    },
    health: { postgresOnline: true, redisOnline: true, healthy: true },
    scope,
    policies,
    evidence: attestedEvidence,
    ...(overrides.verifiedContext ?? {}),
  };

  return { now, commitSha, treeSha, evidenceReference, issuanceId, envelope, trust, verifiedContext };
}

async function startDisposableAuthority(fixture, serverBehavior = {}) {
  const claimed = new Set();
  const inFlight = new Set();
  const expectedToken = serverBehavior.expectedToken ?? "authority_secret_bearer_token_for_isolated_tests_only";

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.headers.authorization !== `Bearer ${expectedToken}`) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "UNAUTHORIZED" }));
      return;
    }

    const sendJson = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };

    if (req.method === "GET" && url.pathname.startsWith("/v1/release-authority/releases/") && url.pathname.includes("/evidence/")) {
      if (serverBehavior.evidenceStatus) {
        return sendJson(serverBehavior.evidenceStatus, { error: "SIMULATED_ERROR" });
      }
      return sendJson(200, { envelope: fixture.envelope, evidenceReference: serverBehavior.returnedEvidenceReference ?? fixture.evidenceReference });
    }

    if (req.method === "GET" && url.pathname.startsWith("/v1/release-authority/releases/") && url.pathname.endsWith("/context")) {
      return sendJson(200, { context: fixture.verifiedContext });
    }

    if (req.method === "GET" && url.pathname === "/v1/release-authority/revocations") {
      return sendJson(200, {
        revokedKeyIds: serverBehavior.revokedKeyIds ?? [],
        revokedIssuanceIds: serverBehavior.revokedIssuanceIds ?? [],
        revokedEvidenceReferences: serverBehavior.revokedEvidenceReferences ?? [],
      });
    }

    if (req.method === "GET" && url.pathname === "/v1/release-authority/trust") {
      return sendJson(200, { trust: fixture.trust });
    }

    if (req.method === "POST" && url.pathname === "/v1/release-authority/issuances/claim") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));

      if (serverBehavior.claimFailure) {
        return sendJson(serverBehavior.claimFailure.status ?? 503, serverBehavior.claimFailure.body ?? { error: "PERSISTENCE_FAILED" });
      }
      if (serverBehavior.holdClaimMs) {
        if (inFlight.has(body.issuanceId)) {
          return sendJson(409, { code: "ISSUANCE_CONCURRENT", claimed: false });
        }
        inFlight.add(body.issuanceId);
        await new Promise((r) => setTimeout(r, serverBehavior.holdClaimMs));
      }
      try {
        if (claimed.has(body.issuanceId)) {
          return sendJson(409, { code: "ISSUANCE_ALREADY_CLAIMED", claimed: false });
        }
        claimed.add(body.issuanceId);
        return sendJson(201, {
          claimed: true,
          issuanceId: serverBehavior.wrongReceiptIssuance ? "wrong-id-from-bug" : body.issuanceId,
          receiptId: `rcpt_${sha256(body.issuanceId).slice(0, 24)}`,
          claimedAt: new Date("2026-11-24T12:00:01.000Z").toISOString(),
        });
      } finally {
        inFlight.delete(body.issuanceId);
      }
    }

    sendJson(404, { error: "NOT_FOUND" });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  return {
    origin,
    token: expectedToken,
    claimed,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

function makeTempOutputDir() {
  return mkdtempSync(path.join(os.tmpdir(), "kt-release-auth-"));
}

test("authorizes valid release against disposable authority, emits redacted success artifact, and records single-use claim", async () => {
  const fixture = buildFixture();
  const authority = await startDisposableAuthority(fixture);
  const outDir = makeTempOutputDir();
  try {
    const result = await authorizeProductionRelease({
      releaseSha: fixture.commitSha,
      workflowSha: fixture.commitSha,
      sourceSha: fixture.commitSha,
      treeSha: fixture.treeSha,
      evidenceReference: fixture.evidenceReference,
      now: fixture.now,
      outputDir: outDir,
      allowLoopbackForTest: true,
      env: {
        RELEASE_AUTHORITY_ORIGIN: authority.origin,
        RELEASE_AUTHORITY_ALLOWED_ORIGIN: authority.origin,
        RELEASE_AUTHORITY_TOKEN: authority.token,
        RELEASE_AUTHORITY_TRUST_ANCHORS: JSON.stringify(fixture.trust),
        RELEASE_AUTHORITY_TRUST_SHA256: sha256(canonicalBytes(fixture.trust)),
      },
    });

    assert.equal(result.releaseAuthorized, true);
    assert.equal(result.status, "RELEASE_AUTHORIZED");
    assert.equal(result.reason, "AUTHORIZED");
    assert.equal(result.issuanceId, fixture.issuanceId);
    assert.ok(result.receiptId?.startsWith("rcpt_"));
    assert.equal(authority.claimed.size, 1);

    const artifactPath = path.join(outDir, "release-authorization-result.json");
    assert.equal(existsSync(artifactPath), true);
    assert.equal(existsSync(path.join(outDir, "release-authorization-refusal.json")), false);

    const rawArtifact = readFileSync(artifactPath, "utf8");
    assert.equal(rawArtifact.includes(authority.token), false, "token must never appear in artifact");
    assert.equal(rawArtifact.includes("PRIVATE KEY"), false, "private key must never appear");
    assert.equal(rawArtifact.includes("ops-reviewer-01"), false, "raw signer principals must be redacted");
    const parsed = JSON.parse(rawArtifact);
    assert.equal(parsed.signers.length, 4);
    assert.ok(parsed.signers.every((s) => typeof s.signerDigest === "string" && s.signerDigest.length === 64 && typeof s.keyIdDigest === "string" && s.keyIdDigest.length === 64));
  } finally {
    await authority.close();
    rmSync(outDir, { recursive: true, force: true });
  }
});

test("refuses replay and concurrent authorization attempts with single-use claim enforcement", async () => {
  const fixture = buildFixture();
  const authority = await startDisposableAuthority(fixture, { holdClaimMs: 40 });
  const outDir = makeTempOutputDir();
  const baseParams = () => ({
    releaseSha: fixture.commitSha,
    workflowSha: fixture.commitSha,
    sourceSha: fixture.commitSha,
    treeSha: fixture.treeSha,
    evidenceReference: fixture.evidenceReference,
    now: fixture.now,
    outputDir: makeTempOutputDir(),
    allowLoopbackForTest: true,
    env: {
      RELEASE_AUTHORITY_ORIGIN: authority.origin,
      RELEASE_AUTHORITY_ALLOWED_ORIGIN: authority.origin,
      RELEASE_AUTHORITY_TOKEN: authority.token,
      RELEASE_AUTHORITY_TRUST_ANCHORS: JSON.stringify(fixture.trust),
    },
  });

  const p1 = baseParams();
  const p2 = baseParams();
  try {
    const [r1, r2] = await Promise.all([authorizeProductionRelease(p1), authorizeProductionRelease(p2)]);
    const outcomes = [r1, r2];
    assert.equal(outcomes.filter((r) => r.releaseAuthorized).length, 1, "exactly one concurrent claim succeeds");
    const conflict = outcomes.find((r) => !r.releaseAuthorized);
    assert.ok(["CONCURRENT_AUTHORIZATION_CONFLICT", "ISSUANCE_REPLAYED"].includes(conflict.reason));

    const replay = await authorizeProductionRelease({ ...baseParams(), outputDir: outDir });
    assert.equal(replay.releaseAuthorized, false);
    assert.equal(replay.reason, "ISSUANCE_REPLAYED");
    assert.equal(existsSync(path.join(outDir, "release-authorization-refusal.json")), true);
  } finally {
    await authority.close();
    rmSync(outDir, { recursive: true, force: true });
    rmSync(p1.outputDir, { recursive: true, force: true });
    rmSync(p2.outputDir, { recursive: true, force: true });
  }
});

test("refuses unconfigured authority, missing trust anchors, trust hash mismatch, SSRF URLs, and unreachable authority", async () => {
  const fixture = buildFixture();
  const authority = await startDisposableAuthority(fixture);
  const outDir = makeTempOutputDir();
  try {
    const noAuth = await authorizeProductionRelease({
      releaseSha: fixture.commitSha,
      workflowSha: fixture.commitSha,
      sourceSha: fixture.commitSha,
      treeSha: fixture.treeSha,
      evidenceReference: fixture.evidenceReference,
      now: fixture.now,
      outputDir: outDir,
      env: {},
    });
    assert.equal(noAuth.releaseAuthorized, false);
    assert.equal(noAuth.reason, "INDEPENDENT_AUTHORITY_UNAVAILABLE");

    const noTrust = await authorizeProductionRelease({
      releaseSha: fixture.commitSha,
      workflowSha: fixture.commitSha,
      sourceSha: fixture.commitSha,
      treeSha: fixture.treeSha,
      evidenceReference: fixture.evidenceReference,
      now: fixture.now,
      outputDir: outDir,
      allowLoopbackForTest: true,
      env: {
        RELEASE_AUTHORITY_ORIGIN: authority.origin,
        RELEASE_AUTHORITY_ALLOWED_ORIGIN: authority.origin,
        RELEASE_AUTHORITY_TOKEN: authority.token,
      },
    });
    assert.equal(noTrust.releaseAuthorized, false);
    assert.equal(noTrust.reason, "INDEPENDENT_TRUST_UNCONFIGURED");

    const badTrustHash = await authorizeProductionRelease({
      releaseSha: fixture.commitSha,
      workflowSha: fixture.commitSha,
      sourceSha: fixture.commitSha,
      treeSha: fixture.treeSha,
      evidenceReference: fixture.evidenceReference,
      now: fixture.now,
      outputDir: outDir,
      allowLoopbackForTest: true,
      env: {
        RELEASE_AUTHORITY_ORIGIN: authority.origin,
        RELEASE_AUTHORITY_ALLOWED_ORIGIN: authority.origin,
        RELEASE_AUTHORITY_TOKEN: authority.token,
        RELEASE_AUTHORITY_TRUST_ANCHORS: JSON.stringify(fixture.trust),
        RELEASE_AUTHORITY_TRUST_SHA256: "0".repeat(64),
      },
    });
    assert.equal(badTrustHash.releaseAuthorized, false);
    assert.equal(badTrustHash.reason, "TRUST_ANCHOR_INTEGRITY_MISMATCH");

    for (const ssrfUrl of [
      "http://169.254.169.254",
      "https://10.0.0.5",
      "http://127.0.0.1:9999",
      "https://user:pass@authority.example",
      "https://authority.example/path?leak=1",
    ]) {
      const ssrf = await authorizeProductionRelease({
        releaseSha: fixture.commitSha,
        workflowSha: fixture.commitSha,
        sourceSha: fixture.commitSha,
        treeSha: fixture.treeSha,
        evidenceReference: fixture.evidenceReference,
        now: fixture.now,
        outputDir: outDir,
        env: {
          RELEASE_AUTHORITY_ORIGIN: ssrfUrl,
          RELEASE_AUTHORITY_ALLOWED_ORIGIN: ssrfUrl,
          RELEASE_AUTHORITY_TOKEN: authority.token,
          RELEASE_AUTHORITY_TRUST_ANCHORS: JSON.stringify(fixture.trust),
        },
      });
      assert.equal(ssrf.releaseAuthorized, false);
      assert.equal(ssrf.reason, "AUTHORITY_ENDPOINT_INVALID");
    }

    const unreachable = await authorizeProductionRelease({
      releaseSha: fixture.commitSha,
      workflowSha: fixture.commitSha,
      sourceSha: fixture.commitSha,
      treeSha: fixture.treeSha,
      evidenceReference: fixture.evidenceReference,
      now: fixture.now,
      outputDir: outDir,
      allowLoopbackForTest: true,
      env: {
        RELEASE_AUTHORITY_ORIGIN: "http://127.0.0.1:1",
        RELEASE_AUTHORITY_ALLOWED_ORIGIN: "http://127.0.0.1:1",
        RELEASE_AUTHORITY_TOKEN: authority.token,
        RELEASE_AUTHORITY_TRUST_ANCHORS: JSON.stringify(fixture.trust),
      },
    });
    assert.equal(unreachable.releaseAuthorized, false);
    assert.equal(unreachable.reason, "AUTHORITY_UNREACHABLE");
  } finally {
    await authority.close();
    rmSync(outDir, { recursive: true, force: true });
  }
});

test("refuses bad signature, wrong role, duplicate principal, maker self-sign, revoked key/issuance, and expired/future timestamps", async () => {
  const cases = [
    {
      name: "bad signature",
      build: () => buildFixture({ approvalOverrides: { operator: { signature: "A".repeat(86) + "==" } } }),
      expectedReason: "ATTESTATION_INVALID",
    },
    {
      name: "wrong role in trust",
      build: () => buildFixture({ trustMutator: (t) => { t["key-operator-ops-reviewer-01"].roles = ["finance"]; } }),
      expectedReason: "ATTESTATION_INVALID",
    },
    {
      name: "duplicate principal across roles",
      build: () => buildFixture({
        signers: {
          operator: makeSigner("operator", "ops-reviewer-01"),
          finance: makeSigner("finance", "finance-reviewer-01"),
          database: makeSigner("database", "db-reviewer-01"),
          security: makeSigner("security", "ops-reviewer-01"),
        },
      }),
      expectedReason: "ATTESTATION_INVALID",
    },
    {
      name: "maker signs own release",
      build: () => buildFixture({ payload: { maker: "ops-reviewer-01" } }),
      expectedReason: "ATTESTATION_INVALID",
    },
    {
      name: "revoked key in trust",
      build: () => buildFixture({ trustMutator: (t) => { t["key-security-sec-reviewer-01"].revoked = true; } }),
      expectedReason: "ATTESTATION_INVALID",
    },
    {
      name: "revoked key via authority feed",
      build: () => buildFixture(),
      behavior: { revokedKeyIds: ["key-security-sec-reviewer-01"] },
      expectedReason: "ATTESTATION_INVALID",
    },
    {
      name: "revoked issuance via authority feed",
      build: () => buildFixture(),
      behavior: { revokedIssuanceIds: ["issuance-20261124-ktcourier-prod-0001"] },
      expectedReason: "EVIDENCE_REVOKED",
    },
    {
      name: "expired attestation",
      build: () => buildFixture({ payload: { issuedAt: "2026-11-24T11:30:00.000Z", expiresAt: "2026-11-24T11:44:00.000Z" } }),
      expectedReason: "ATTESTATION_INVALID",
    },
    {
      name: "future issuedAt attestation",
      build: () => buildFixture({ payload: { issuedAt: "2026-11-24T12:05:00.000Z", expiresAt: "2026-11-24T12:15:00.000Z" } }),
      expectedReason: "ATTESTATION_INVALID",
    },
    {
      name: "stale >15m validity window",
      build: () => buildFixture({ payload: { issuedAt: "2026-11-24T11:40:00.000Z", expiresAt: "2026-11-24T12:10:00.000Z" } }),
      expectedReason: "ATTESTATION_INVALID",
    },
  ];

  for (const c of cases) {
    const fixture = c.build();
    const authority = await startDisposableAuthority(fixture, c.behavior);
    const outDir = makeTempOutputDir();
    try {
      const res = await authorizeProductionRelease({
        releaseSha: fixture.commitSha,
        workflowSha: fixture.commitSha,
        sourceSha: fixture.commitSha,
        treeSha: fixture.treeSha,
        evidenceReference: fixture.evidenceReference,
        now: fixture.now,
        outputDir: outDir,
        allowLoopbackForTest: true,
        env: {
          RELEASE_AUTHORITY_ORIGIN: authority.origin,
          RELEASE_AUTHORITY_ALLOWED_ORIGIN: authority.origin,
          RELEASE_AUTHORITY_TOKEN: authority.token,
          RELEASE_AUTHORITY_TRUST_ANCHORS: JSON.stringify(fixture.trust),
        },
      });
      assert.equal(res.releaseAuthorized, false, `${c.name} must refuse`);
      assert.equal(res.reason, c.expectedReason, `${c.name} reason mismatch`);
      assert.equal(authority.claimed.size, 0, `${c.name} must never claim issuance`);
    } finally {
      await authority.close();
      rmSync(outDir, { recursive: true, force: true });
    }
  }
});

test("refuses wrong tree, CI/cert failure, deployment SHA mismatch, health failure, stale evidence, wrong scope/audience, malformed input, and failed claim persistence", async () => {
  const cases = [
    {
      name: "wrong treeSha in verified context",
      build: () => buildFixture({ verifiedContext: { treeSha: "2".repeat(40) } }),
      expectedReason: "SOURCE_CONTEXT_MISMATCH",
    },
    {
      name: "CI run not succeeded",
      build: () => {
        const f = buildFixture();
        f.verifiedContext.ciRun.conclusion = "failure";
        return f;
      },
      expectedReason: "CI_VERIFICATION_FAILED",
    },
    {
      name: "Certification job count mismatch",
      build: () => {
        const f = buildFixture();
        f.verifiedContext.certificationRun.jobsPassed = 25;
        return f;
      },
      expectedReason: "CERTIFICATION_VERIFICATION_FAILED",
    },
    {
      name: "Railway query deployment SHA mismatch",
      build: () => {
        const f = buildFixture();
        f.verifiedContext.deployments.railwayQuery.sha = "3".repeat(40);
        return f;
      },
      expectedReason: "DEPLOYMENT_PARITY_MISMATCH",
    },
    {
      name: "Database/Redis health degraded",
      build: () => buildFixture({ verifiedContext: { health: { postgresOnline: true, redisOnline: false, healthy: false } } }),
      expectedReason: "HEALTH_CHECK_FAILED",
    },
    {
      name: "Stale domain evidence in context",
      build: () => {
        const f = buildFixture();
        f.verifiedContext.evidence.provider = {
          ...f.verifiedContext.evidence.provider,
          expiresAt: "2026-11-24T11:59:00.000Z",
        };
        return f;
      },
      expectedReason: "STALE_EVIDENCE",
    },
    {
      name: "Unauthorized scope exclusion",
      build: () => buildFixture({ scope: { mandatoryChecks: ["checkout"], excludedCapabilities: ["ADVERTISING", "PROMOTERS", "SUBSCRIPTIONS", "STORE_CHECKOUT"] } }),
      expectedReason: "SCOPE_OR_POLICY_MISMATCH",
    },
    {
      name: "Wrong audience",
      build: () => buildFixture({ payload: { audience: "wrong-audience" } }),
      expectedReason: "ATTESTATION_INVALID",
    },
    {
      name: "Malformed evidenceReference",
      build: () => buildFixture(),
      evidenceReference: "https://evil.example/ref",
      expectedReason: "INVALID_EVIDENCE_REFERENCE",
    },
    {
      name: "Failed atomic claim persistence",
      build: () => buildFixture(),
      behavior: { claimFailure: { status: 500, body: { error: "DB_DOWN" } } },
      expectedReason: "ISSUANCE_PERSISTENCE_FAILED",
    },
    {
      name: "Mismatched issuance receipt",
      build: () => buildFixture(),
      behavior: { wrongReceiptIssuance: true },
      expectedReason: "ISSUANCE_PERSISTENCE_FAILED",
    },
  ];

  for (const c of cases) {
    const fixture = c.build();
    const authority = await startDisposableAuthority(fixture, c.behavior);
    const outDir = makeTempOutputDir();
    try {
      const res = await authorizeProductionRelease({
        releaseSha: fixture.commitSha,
        workflowSha: fixture.commitSha,
        sourceSha: fixture.commitSha,
        treeSha: fixture.treeSha,
        evidenceReference: c.evidenceReference ?? fixture.evidenceReference,
        now: fixture.now,
        outputDir: outDir,
        allowLoopbackForTest: true,
        env: {
          RELEASE_AUTHORITY_ORIGIN: authority.origin,
          RELEASE_AUTHORITY_ALLOWED_ORIGIN: authority.origin,
          RELEASE_AUTHORITY_TOKEN: authority.token,
          RELEASE_AUTHORITY_TRUST_ANCHORS: JSON.stringify(fixture.trust),
        },
      });
      assert.equal(res.releaseAuthorized, false, `${c.name} must refuse`);
      assert.equal(res.reason, c.expectedReason, `${c.name} reason mismatch`);
      assert.equal(existsSync(path.join(outDir, "release-authorization-result.json")), false);
    } finally {
      await authority.close();
      rmSync(outDir, { recursive: true, force: true });
    }
  }
});

test("protected release authorization workflow stays fail-closed, least-privilege, and main-only", () => {
  const workflow = yaml.load(readFileSync(".github/workflows/production-release-authorization.yml", "utf8"));
  assert.deepEqual(Object.keys(workflow.on), ["workflow_dispatch"]);
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.equal(workflow.jobs.authorize.environment, "production-release");
  assert.match(String(workflow.jobs.authorize.if), /github\.ref\s*==\s*'refs\/heads\/main'/);
  assert.equal(workflow.jobs.authorize["continue-on-error"], undefined);

  const authStep = workflow.jobs.authorize.steps.find((s) => String(s.run ?? "").includes("verify-release-authorization.mjs"));
  assert.ok(authStep, "must invoke scripts/verify-release-authorization.mjs");
  assert.equal(authStep.env.RELEASE_AUTHORITY_ORIGIN, "${{ vars.RELEASE_AUTHORITY_ORIGIN }}");
  assert.equal(authStep.env.RELEASE_AUTHORITY_ALLOWED_ORIGIN, "${{ vars.RELEASE_AUTHORITY_ALLOWED_ORIGIN }}");
  assert.equal(authStep.env.RELEASE_AUTHORITY_TRUST_SHA256, "${{ vars.RELEASE_AUTHORITY_TRUST_SHA256 }}");
  assert.equal(authStep.env.RELEASE_AUTHORITY_TOKEN, "${{ secrets.RELEASE_AUTHORITY_TOKEN }}");
  assert.equal(authStep.env.RELEASE_AUTHORITY_TRUST_ANCHORS, "${{ secrets.RELEASE_AUTHORITY_TRUST_ANCHORS }}");
});

test("supports remote trust fetch when pinned via SHA-256 and refuses unauthorized credentials", async () => {
  const fixture = buildFixture();
  const authority = await startDisposableAuthority(fixture);
  const outDir = makeTempOutputDir();
  try {
    const okRemote = await authorizeProductionRelease({
      releaseSha: fixture.commitSha,
      workflowSha: fixture.commitSha,
      sourceSha: fixture.commitSha,
      treeSha: fixture.treeSha,
      evidenceReference: fixture.evidenceReference,
      now: fixture.now,
      outputDir: outDir,
      allowLoopbackForTest: true,
      env: {
        RELEASE_AUTHORITY_ORIGIN: authority.origin,
        RELEASE_AUTHORITY_ALLOWED_ORIGIN: authority.origin,
        RELEASE_AUTHORITY_TOKEN: authority.token,
        RELEASE_AUTHORITY_TRUST_SHA256: sha256(canonicalBytes(fixture.trust)),
      },
    });
    assert.equal(okRemote.releaseAuthorized, true);

    const badToken = await authorizeProductionRelease({
      releaseSha: fixture.commitSha,
      workflowSha: fixture.commitSha,
      sourceSha: fixture.commitSha,
      treeSha: fixture.treeSha,
      evidenceReference: fixture.evidenceReference,
      now: fixture.now,
      outputDir: outDir,
      allowLoopbackForTest: true,
      env: {
        RELEASE_AUTHORITY_ORIGIN: authority.origin,
        RELEASE_AUTHORITY_ALLOWED_ORIGIN: authority.origin,
        RELEASE_AUTHORITY_TOKEN: "wrong_token_value_1234567890",
        RELEASE_AUTHORITY_TRUST_ANCHORS: JSON.stringify(fixture.trust),
      },
    });
    assert.equal(badToken.releaseAuthorized, false);
    assert.equal(badToken.reason, "AUTHORITY_UNAUTHORIZED");
  } finally {
    await authority.close();
    rmSync(outDir, { recursive: true, force: true });
  }
});
