import { createSign } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { verifyAuditReceipt } from "./audit-receipt.mjs";
import {
  AUDIENCE,
  ENVIRONMENT,
  EVIDENCE_KEYS,
  EXPECTED_EXCLUDED_CAPABILITIES,
  REPOSITORY,
  REQUIRED_LAUNCH_SCOPE,
  SAFE_ID_PATTERN,
  SHA_PATTERN,
  assertSafeTargetUrl,
  canonicalBytes,
  sha256Hex,
} from "./security.mjs";

const REQUIRED_PRIMARY_CI_JOBS = Object.freeze([
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
]);

const REQUIRED_CERTIFICATION_JOBS = Object.freeze([
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
]);

function extractCommitSha(meta) {
  if (!meta || typeof meta !== "object") return "";
  for (const key of ["commitHash", "githubCommitSha", "RAILWAY_GIT_COMMIT_SHA", "VERCEL_GIT_COMMIT_SHA", "sha"]) {
    const val = meta[key];
    if (typeof val === "string" && SHA_PATTERN.test(val.trim())) {
      return val.trim();
    }
  }
  return "";
}

async function fetchPaginatedGithubJobs(baseUrl, headers, fetchImpl) {
  const jobs = [];
  for (let page = 1; page <= 10; page += 1) {
    const res = await fetchImpl(`${baseUrl}?per_page=100&page=${page}`, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      if (res.status === 429 || (res.status === 403 && res.headers?.get?.("x-ratelimit-remaining") === "0")) {
        throw classifyGithubFailure(res, "workflow jobs");
      }
      throw Object.assign(new Error("Failed to query GitHub workflow jobs."), { code: "UPSTREAM_UNREACHABLE", status: 502 });
    }
    const payload = await res.json();
    const pageJobs = Array.isArray(payload.jobs) ? payload.jobs : [];
    jobs.push(...pageJobs);
    if (pageJobs.length < 100 || (typeof payload.total_count === "number" && jobs.length >= payload.total_count)) {
      break;
    }
  }
  return jobs;
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createGithubAppJwt(appId, privateKeyPem, nowEpochSeconds = Math.floor(Date.now() / 1000)) {
  const normalizedPem = String(privateKeyPem).replace(/\\n/g, "\n").trim();
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iat: nowEpochSeconds - 60,
      exp: nowEpochSeconds + 540,
      iss: String(appId).trim(),
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256").update(unsigned).end().sign(normalizedPem);
  return `${unsigned}.${base64UrlEncode(signature)}`;
}

async function resolveGithubHeaders({ env = process.env, fetchImpl = fetch }) {
  const baseHeaders = {
    accept: "application/vnd.github+json",
    "user-agent": "KT-Courier-Release-Authority",
    "x-github-api-version": "2022-11-28",
  };
  const staticToken = (env.GITHUB_RELEASE_READ_TOKEN ?? "").trim();
  if (staticToken) {
    return { ...baseHeaders, authorization: `Bearer ${staticToken}` };
  }

  const appId = (env.GITHUB_APP_ID ?? "").trim();
  const privateKey = (env.GITHUB_APP_PRIVATE_KEY ?? "").trim();
  const installationId = (env.GITHUB_APP_INSTALLATION_ID ?? "").trim();
  if (appId && privateKey && installationId) {
    const jwt = createGithubAppJwt(appId, privateKey);
    const tokenRes = await fetchImpl(
      `https://api.github.com/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
      {
        method: "POST",
        headers: { ...baseHeaders, authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ permissions: { actions: "read", contents: "read", metadata: "read" } }),
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (tokenRes.ok) {
      const tokenJson = await tokenRes.json();
      if (typeof tokenJson?.token === "string" && tokenJson.token.trim()) {
        return { ...baseHeaders, authorization: `Bearer ${tokenJson.token.trim()}` };
      }
    }
  }

  // analyticsmath/KT-Courier is public: public GitHub Actions run/job metadata is readable anonymously.
  return baseHeaders;
}

function extractPrimaryTestCountFromZip(zipBuffer) {
  let eocdOffset = -1;
  for (let i = zipBuffer.length - 22; i >= Math.max(0, zipBuffer.length - 65557); i -= 1) {
    if (zipBuffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) return null;
  const cdOffset = zipBuffer.readUInt32LE(eocdOffset + 16);
  const totalEntries = zipBuffer.readUInt16LE(eocdOffset + 10);
  let cursor = cdOffset;
  for (let idx = 0; idx < totalEntries && cursor + 46 <= zipBuffer.length; idx += 1) {
    if (zipBuffer.readUInt32LE(cursor) !== 0x02014b50) break;
    const compression = zipBuffer.readUInt16LE(cursor + 10);
    const compressedSize = zipBuffer.readUInt32LE(cursor + 20);
    const nameLen = zipBuffer.readUInt16LE(cursor + 28);
    const extraLen = zipBuffer.readUInt16LE(cursor + 30);
    const commentLen = zipBuffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = zipBuffer.readUInt32LE(cursor + 42);
    const fileName = zipBuffer.subarray(cursor + 46, cursor + 46 + nameLen).toString("utf8");
    cursor += 46 + nameLen + extraLen + commentLen;
    if (!/(?:^|\/)(?:test-coverage|vitest-coverage|coverage-summary)\.json$/i.test(fileName)) continue;
    if (zipBuffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) continue;
    const lNameLen = zipBuffer.readUInt16LE(localHeaderOffset + 26);
    const lExtraLen = zipBuffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + lNameLen + lExtraLen;
    const compressed = zipBuffer.subarray(dataStart, dataStart + compressedSize);
    const content = compression === 0 ? compressed : compression === 8 ? inflateRawSync(compressed) : null;
    if (!content) continue;
    try {
      const parsed = JSON.parse(content.toString("utf8"));
      if (
        (typeof parsed.testsFailed === "number" && parsed.testsFailed > 0) ||
        (typeof parsed.testsSkipped === "number" && parsed.testsSkipped > 0) ||
        (typeof parsed.status === "string" && parsed.status !== "PASS")
      ) {
        continue;
      }
      const count = parsed.numPassedTests ?? parsed.testsPassed;
      if (typeof count === "number" && Number.isInteger(count) && count > 0) {
        return count;
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function collectGithubWorkflows({ commitSha, ciRunId, certificationRunId, githubHeaders, githubToken, fetchImpl }) {
  const headers = githubHeaders ?? {
    accept: "application/vnd.github+json",
    "user-agent": "KT-Courier-Release-Authority",
    "x-github-api-version": "2022-11-28",
    ...(githubToken ? { authorization: `Bearer ${githubToken}` } : {}),
  };

  const [commitRes, ciRunRes, certRunRes] = await Promise.all([
    fetchImpl(`https://api.github.com/repos/${REPOSITORY}/git/commits/${commitSha}`, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    }),
    fetchImpl(`https://api.github.com/repos/${REPOSITORY}/actions/runs/${encodeURIComponent(String(ciRunId))}`, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    }),
    fetchImpl(`https://api.github.com/repos/${REPOSITORY}/actions/runs/${encodeURIComponent(String(certificationRunId))}`, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    }),
  ]);

  if (!commitRes.ok || !ciRunRes.ok || !certRunRes.ok) {
    throw Object.assign(new Error("Unable to fetch commit or GitHub Actions runs."), { code: "UPSTREAM_UNREACHABLE", status: 502 });
  }

  const [commitJson, ciRunJson, certRunJson] = await Promise.all([commitRes.json(), ciRunRes.json(), certRunRes.json()]);
  const treeSha = String(commitJson?.tree?.sha ?? "");
  if (!SHA_PATTERN.test(treeSha)) {
    throw Object.assign(new Error("Git commit did not resolve to a valid tree SHA."), { code: "SOURCE_CONTEXT_MISMATCH", status: 409 });
  }

  const ciAttempt = Number(ciRunJson.run_attempt) > 0 ? Number(ciRunJson.run_attempt) : 1;
  const certAttempt = Number(certRunJson.run_attempt) > 0 ? Number(certRunJson.run_attempt) : 1;

  const [ciJobs, certJobs] = await Promise.all([
    fetchPaginatedGithubJobs(
      `https://api.github.com/repos/${REPOSITORY}/actions/runs/${encodeURIComponent(String(ciRunId))}/attempts/${ciAttempt}/jobs`,
      headers,
      fetchImpl,
    ),
    fetchPaginatedGithubJobs(
      `https://api.github.com/repos/${REPOSITORY}/actions/runs/${encodeURIComponent(String(certificationRunId))}/attempts/${certAttempt}/jobs`,
      headers,
      fetchImpl,
    ),
  ]);

  const ciSucceeded = new Set(ciJobs.filter((j) => j.conclusion === "success" && typeof j.name === "string").map((j) => j.name));
  const ciSkipped = ciJobs.filter((j) => REQUIRED_PRIMARY_CI_JOBS.includes(j.name) && j.conclusion === "skipped").length;
  const ciAllPassed = REQUIRED_PRIMARY_CI_JOBS.every((jobName) => ciSucceeded.has(jobName)) && ciSkipped === 0;

  const certSucceeded = new Set(certJobs.filter((j) => j.conclusion === "success" && typeof j.name === "string").map((j) => j.name));
  const certMissing = REQUIRED_CERTIFICATION_JOBS.filter((jobName) => !certSucceeded.has(jobName));
  const certSkipped = certJobs.filter((j) => j.conclusion === "skipped").length;

  return {
    treeSha,
    ciRun: {
      id: Number(ciRunId),
      workflowName: "CI",
      workflowPath: String(ciRunJson.path ?? ".github/workflows/ci.yml"),
      headBranch: String(ciRunJson.head_branch ?? ""),
      headSha: String(ciRunJson.head_sha ?? ""),
      status: String(ciRunJson.status ?? ""),
      conclusion: String(ciRunJson.conclusion ?? ""),
      mandatoryJobsSucceeded: ciAllPassed,
      skippedCriticalJobs: ciSkipped,
      artifactDigest: sha256Hex(canonicalBytes({ runId: Number(ciRunId), headSha: ciRunJson.head_sha, jobs: REQUIRED_PRIMARY_CI_JOBS })),
    },
    certificationRun: {
      id: Number(certificationRunId),
      workflowName: "Engineering Certification",
      workflowPath: String(certRunJson.path ?? ".github/workflows/production-certification.yml"),
      headBranch: String(certRunJson.head_branch ?? ""),
      headSha: String(certRunJson.head_sha ?? ""),
      status: String(certRunJson.status ?? ""),
      conclusion: String(certRunJson.conclusion ?? ""),
      jobsPassed: REQUIRED_CERTIFICATION_JOBS.length - certMissing.length,
      jobsTotal: REQUIRED_CERTIFICATION_JOBS.length,
      skippedJobs: certSkipped,
      missingJobs: certMissing,
      evidenceDigest: sha256Hex(canonicalBytes({ runId: Number(certificationRunId), headSha: certRunJson.head_sha, jobs: REQUIRED_CERTIFICATION_JOBS })),
    },
  };
}

async function collectVercelAndRailway({
  vercelDeploymentId,
  webDeploymentId,
  operationsDeploymentId,
  queryDeploymentId,
  vercelToken,
  vercelTeamId,
  railwayToken,
  fetchImpl,
}) {
  const teamQuery = vercelTeamId ? `?teamId=${encodeURIComponent(vercelTeamId)}` : "";
  const graphql = `
    query ReleaseAuthorityParity($webId: String!, $opsId: String!, $queryId: String!) {
      web: deployment(id: $webId) { id status meta service { name } }
      operations: deployment(id: $opsId) { id status meta service { name } }
      query: deployment(id: $queryId) { id status meta service { name } }
    }
  `;

  const [vercelRes, railwayRes] = await Promise.all([
    fetchImpl(`https://api.vercel.com/v13/deployments/${encodeURIComponent(vercelDeploymentId)}${teamQuery}`, {
      headers: { authorization: `Bearer ${vercelToken}`, accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    }),
    fetchImpl("https://backboard.railway.com/graphql/v2", {
      method: "POST",
      headers: {
        authorization: `Bearer ${railwayToken}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        query: graphql,
        variables: { webId: webDeploymentId, opsId: operationsDeploymentId, queryId: queryDeploymentId },
      }),
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    }),
  ]);

  if (!vercelRes.ok || !railwayRes.ok) {
    throw Object.assign(new Error("Unable to query Vercel or Railway deployment status."), { code: "UPSTREAM_UNREACHABLE", status: 502 });
  }

  const [vercelJson, railwayJson] = await Promise.all([vercelRes.json(), railwayRes.json()]);
  const vercelSha = extractCommitSha(vercelJson.meta) || String(vercelJson.gitSource?.sha ?? "");
  const rData = railwayJson?.data;
  if (railwayJson?.errors?.length || !rData?.web || !rData?.operations || !rData?.query) {
    throw Object.assign(new Error("Railway response missing one or more required services."), { code: "DEPLOYMENT_PARITY_MISMATCH", status: 409 });
  }

  return {
    vercel: {
      id: String(vercelJson.id ?? vercelDeploymentId),
      sha: vercelSha,
      state: String(vercelJson.readyState ?? ""),
      target: String(vercelJson.target ?? ""),
    },
    railwayWeb: {
      id: String(rData.web.id ?? webDeploymentId),
      sha: extractCommitSha(rData.web.meta),
      status: String(rData.web.status ?? ""),
      serviceName: String(rData.web.service?.name ?? ""),
    },
    railwayOperations: {
      id: String(rData.operations.id ?? operationsDeploymentId),
      sha: extractCommitSha(rData.operations.meta),
      status: String(rData.operations.status ?? ""),
      serviceName: String(rData.operations.service?.name ?? ""),
    },
    railwayQuery: {
      id: String(rData.query.id ?? queryDeploymentId),
      sha: extractCommitSha(rData.query.meta),
      status: String(rData.query.status ?? ""),
      serviceName: String(rData.query.service?.name ?? ""),
    },
  };
}

async function loadAndVerifyStoredAuditReceipt({
  store,
  auditReference,
  releaseSha,
  deployments,
  env,
  nowMs,
}) {
  if (!store || typeof store.getAuditReceipt !== "function") {
    throw Object.assign(
      new Error("Release authority audit store is required to verify protected-row audit receipts."),
      { code: "AUDIT_STORE_UNAVAILABLE", status: 503 },
    );
  }
  const ref = String(auditReference ?? "").trim();
  if (!ref || !SAFE_ID_PATTERN.test(ref)) {
    throw Object.assign(new Error("A valid protected-row audit receipt reference or digest is required."), {
      code: "AUDIT_RECEIPT_INVALID",
      status: 400,
    });
  }

  const stored = await store.getAuditReceipt(ref);
  if (!stored || !stored.receipt) {
    throw Object.assign(new Error("Protected-row audit receipt was not found in independent authority storage."), {
      code: "AUDIT_RECEIPT_NOT_FOUND",
      status: 404,
    });
  }

  const rev =
    typeof store.getRevocationStatus === "function"
      ? await store.getRevocationStatus({ releaseSha, auditReference: ref })
      : { revokedAuditReceiptIds: [] };
  const revokedList = rev.revokedAuditReceiptIds ?? [];
  if (
    stored.revoked === true ||
    revokedList.includes(stored.receiptReference) ||
    revokedList.includes(stored.receiptDigest) ||
    revokedList.includes(ref)
  ) {
    throw Object.assign(new Error("Protected-row audit receipt has been revoked."), {
      code: "AUDIT_RECEIPT_REVOKED",
      status: 410,
    });
  }

  const configuredClassification = env.KT_EXPECTED_AUDIT_CLASSIFICATION?.trim();
  const expectedClassification =
    configuredClassification === "isolated_test" && env.KT_ALLOW_ISOLATED_AUDIT_CLASSIFICATION_FOR_TEST === "true"
      ? "isolated_test"
      : "production";

  return verifyAuditReceipt(stored.receipt, {
    releaseSha,
    reference: ref,
    deployments,
    database: env.KT_EXPECTED_AUDIT_DATABASE?.trim() || undefined,
    classification: expectedClassification,
    nowMs,
    enforceFreshness: true,
    requireParityEligibility: true,
  });
}

export async function collectVerifiedReleaseContext(params, options = {}) {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const nowMs = (options.now ?? (() => new Date()))().getTime();

  const vercelToken = (env.VERCEL_TOKEN ?? "").trim();
  const railwayToken = (env.RAILWAY_API_TOKEN ?? "").trim();
  const appOrigin = (env.KT_PRODUCTION_ORIGIN ?? env.PAYMENT_APP_ORIGIN ?? "").trim();

  if (!vercelToken || !railwayToken || !appOrigin) {
    throw Object.assign(
      new Error("Release authority upstream collector tokens (Vercel, Railway, KT_PRODUCTION_ORIGIN) must be configured."),
      { code: "INDEPENDENT_AUTHORITY_UNAVAILABLE", status: 503 },
    );
  }
  const githubHeaders = await resolveGithubHeaders({ env, fetchImpl });

  const readyUrl = await assertSafeTargetUrl(`${appOrigin.replace(/\/$/, "")}/api/infrastructure/ready`, {
    allowLoopbackForTest: options.allowLoopbackForTest === true,
    resolveDns: options.resolveDns,
  });

  const auditRef = String(params.auditReference ?? params.evidence?.database_audit?.reference ?? "").trim();

  const [githubState, deployments, readyRes, verifiedAudit] = await Promise.all([
    collectGithubWorkflows({
      commitSha: params.commitSha,
      ciRunId: params.ciRunId,
      certificationRunId: params.certificationRunId,
      githubHeaders,
      fetchImpl,
    }),
    collectVercelAndRailway({
      vercelDeploymentId: params.vercelDeploymentId,
      webDeploymentId: params.webDeploymentId,
      operationsDeploymentId: params.operationsDeploymentId,
      queryDeploymentId: params.queryDeploymentId,
      vercelToken,
      vercelTeamId: env.VERCEL_TEAM_ID?.trim(),
      railwayToken,
      fetchImpl,
    }),
    fetchImpl(readyUrl, {
      headers: { accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    }),
    loadAndVerifyStoredAuditReceipt({
      store: options.store,
      auditReference: auditRef,
      releaseSha: params.commitSha,
      deployments: {
        vercelDeploymentId: params.vercelDeploymentId,
        webDeploymentId: params.webDeploymentId,
        operationsDeploymentId: params.operationsDeploymentId,
        queryDeploymentId: params.queryDeploymentId,
      },
      env,
      nowMs,
    }),
  ]);

  if (!readyRes.ok) {
    throw Object.assign(new Error("Production health check returned non-200 status."), { code: "HEALTH_CHECK_FAILED", status: 409 });
  }
  const readyJson = await readyRes.json();
  const redisOnline =
    readyJson?.redis === "connected" ||
    (readyJson?.redis?.configured === true && readyJson?.redis?.connected === true);
  const health = {
    postgresOnline: readyJson?.database === "reachable",
    redisOnline,
    healthy: readyJson?.status === "ready" && readyJson?.database === "reachable" && redisOnline,
  };

  for (const key of EVIDENCE_KEYS) {
    if (key === "database_audit") continue;
    if (!params.evidence?.[key]?.reference || !params.evidence?.[key]?.digest || !params.evidence?.[key]?.observedAt || !params.evidence?.[key]?.expiresAt) {
      throw Object.assign(new Error(`Missing evidence bundle details for ${key}.`), { code: "SCOPE_OR_POLICY_MISMATCH", status: 409 });
    }
  }

  const boundEvidence = {
    ...params.evidence,
    database_audit: {
      reference: verifiedAudit.receiptReference,
      digest: verifiedAudit.receiptDigest,
      observedAt: verifiedAudit.observedAt,
      expiresAt: verifiedAudit.expiresAt,
    },
  };

  const scope = {
    mandatoryChecks: [...(params.scope?.mandatoryChecks ?? REQUIRED_LAUNCH_SCOPE)],
    excludedCapabilities: [...EXPECTED_EXCLUDED_CAPABILITIES],
  };

  return {
    repository: REPOSITORY,
    environment: ENVIRONMENT,
    audience: AUDIENCE,
    commitSha: params.commitSha,
    treeSha: githubState.treeSha,
    evidenceReference: params.evidenceReference,
    ciRun: githubState.ciRun,
    certificationRun: {
      id: githubState.certificationRun.id,
      workflowName: githubState.certificationRun.workflowName,
      workflowPath: githubState.certificationRun.workflowPath,
      headBranch: githubState.certificationRun.headBranch,
      headSha: githubState.certificationRun.headSha,
      status: githubState.certificationRun.status,
      conclusion: githubState.certificationRun.conclusion,
      jobsPassed: githubState.certificationRun.jobsPassed,
      jobsTotal: githubState.certificationRun.jobsTotal,
      skippedJobs: githubState.certificationRun.skippedJobs,
      evidenceDigest: githubState.certificationRun.evidenceDigest,
    },
    deployments,
    health,
    scope,
    policies: params.policies,
    evidence: boundEvidence,
    auditReceipt: {
      reference: verifiedAudit.receiptReference,
      baselineReference: verifiedAudit.baselineReference,
      baselinePresent: verifiedAudit.comparison.baselinePresent,
      releaseSha: verifiedAudit.releaseSha,
      database: verifiedAudit.databaseIdentity.database,
      classification: verifiedAudit.databaseIdentity.classification,
      leastPrivilege: verifiedAudit.databaseIdentity.leastPrivilegeVerified,
      unchanged: verifiedAudit.comparison.unchanged,
      eligibleForParity: verifiedAudit.comparison.eligibleForParity,
      changedTables: verifiedAudit.comparison.changedTables,
      documentedChangeReference: verifiedAudit.comparison.documentedChangeReference ?? null,
      documentedChangesAuthorized: Boolean(
        verifiedAudit.comparison.documentedChangeReference &&
          verifiedAudit.comparison.documentedChangeReason &&
          verifiedAudit.provenance?.reviewerPrincipal &&
          verifiedAudit.provenance.reviewerPrincipal !== verifiedAudit.provenance.auditorPrincipal,
      ),
      deployments: verifiedAudit.deployments,
      observedAt: verifiedAudit.observedAt,
      expiresAt: verifiedAudit.expiresAt,
      inventoryComplete: verifiedAudit.inventory.inventoryComplete,
      digest: verifiedAudit.receiptDigest,
    },
  };
}

export async function verifyParityRemote(input, options = {}) {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const nowMs = (options.now ?? (() => new Date()))().getTime();
  const vercelToken = (env.VERCEL_TOKEN ?? "").trim();
  const railwayToken = (env.RAILWAY_API_TOKEN ?? "").trim();
  const appOrigin = (env.KT_PRODUCTION_ORIGIN ?? env.PAYMENT_APP_ORIGIN ?? "").trim();

  if (!vercelToken || !railwayToken || !appOrigin) {
    throw Object.assign(new Error("Parity collector credentials are unavailable."), { code: "PARITY_VERIFICATION_UNAVAILABLE", status: 503 });
  }

  const readyUrl = await assertSafeTargetUrl(`${appOrigin.replace(/\/$/, "")}/api/infrastructure/ready`, {
    allowLoopbackForTest: options.allowLoopbackForTest === true,
    resolveDns: options.resolveDns,
  });

  const [deployments, readyRes, verifiedAudit] = await Promise.all([
    collectVercelAndRailway({
      vercelDeploymentId: input.vercelDeploymentId,
      webDeploymentId: input.webDeploymentId,
      operationsDeploymentId: input.operationsDeploymentId,
      queryDeploymentId: input.queryDeploymentId,
      vercelToken,
      vercelTeamId: env.VERCEL_TEAM_ID?.trim(),
      railwayToken,
      fetchImpl,
    }),
    fetchImpl(readyUrl, { headers: { accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(10_000) }),
    loadAndVerifyStoredAuditReceipt({
      store: options.store,
      auditReference: input.protectedDataAuditReference,
      releaseSha: input.releaseSha,
      deployments: {
        vercelDeploymentId: input.vercelDeploymentId,
        webDeploymentId: input.webDeploymentId,
        operationsDeploymentId: input.operationsDeploymentId,
        queryDeploymentId: input.queryDeploymentId,
      },
      env,
      nowMs,
    }),
  ]);

  if (!readyRes.ok) {
    throw Object.assign(new Error("Health endpoint failed."), { code: "HEALTH_CHECK_FAILED", status: 409 });
  }
  const readyJson = await readyRes.json();
  const redisConnected =
    readyJson?.redis === "connected" ||
    (readyJson?.redis?.configured === true && readyJson?.redis?.connected === true);
  const healthy = readyJson?.status === "ready" && readyJson?.database === "reachable" && redisConnected;
  if (!healthy) {
    throw Object.assign(new Error("Infrastructure database or Redis readiness check is not healthy."), { code: "HEALTH_CHECK_FAILED", status: 409 });
  }

  return {
    vercelSha: deployments.vercel.sha,
    vercelState: deployments.vercel.state,
    webSha: deployments.railwayWeb.sha,
    webStatus: deployments.railwayWeb.status,
    operationsSha: deployments.railwayOperations.sha,
    operationsStatus: deployments.railwayOperations.status,
    querySha: deployments.railwayQuery.sha,
    queryStatus: deployments.railwayQuery.status,
    auditReleaseSha: verifiedAudit.releaseSha,
    auditReference: verifiedAudit.receiptReference,
    auditBaselineReference: verifiedAudit.baselineReference,
    auditBaselinePresent: verifiedAudit.comparison.baselinePresent,
    protectedDataUnchanged: verifiedAudit.comparison.unchanged,
    auditParityEligible: verifiedAudit.comparison.eligibleForParity,
    auditChangedTables: verifiedAudit.comparison.changedTables,
    auditUnexpectedChangedTables: verifiedAudit.comparison.unexpectedChangedTables,
    auditInventoryComplete: verifiedAudit.inventory.inventoryComplete,
    auditDatabase: verifiedAudit.databaseIdentity.database,
    auditClassification: verifiedAudit.databaseIdentity.classification,
    auditObservedAt: verifiedAudit.observedAt,
    auditExpiresAt: verifiedAudit.expiresAt,
    leastPrivilege: verifiedAudit.databaseIdentity.leastPrivilegeVerified,
    auditDigest: verifiedAudit.receiptDigest,
  };
}

const REQUIRED_CERTIFICATION_ARTIFACTS = Object.freeze([
  "certification-quality",
  ...Array.from({ length: 20 }, (_, i) => `postgres-${i}`),
  "certification-redis-and-recovery",
  "certification-recovery",
  "browser-evidence",
  "certification-browser-reports",
  "phase2-automated-engineering",
]);

function classifyGithubFailure(res, context) {
  const remaining = res.headers?.get?.("x-ratelimit-remaining");
  const reset = res.headers?.get?.("x-ratelimit-reset");
  const resetIso = reset && /^\d+$/.test(reset) ? new Date(Number(reset) * 1000).toISOString() : null;
  if (res.status === 429 || (res.status === 403 && remaining === "0")) {
    return Object.assign(
      new Error(`GitHub API rate limit exceeded while querying ${context}${resetIso ? ` (resets at ${resetIso})` : ""}.`),
      { code: "CI_VERIFICATION_UNAVAILABLE", status: 502 },
    );
  }
  if (res.status === 401 || res.status === 403) {
    return Object.assign(
      new Error(`GitHub API denied access while querying ${context} (HTTP ${res.status}).`),
      { code: "CI_VERIFICATION_UNAVAILABLE", status: 502 },
    );
  }
  return Object.assign(new Error(`Unable to query GitHub ${context} (HTTP ${res.status}).`), {
    code: "CI_VERIFICATION_UNAVAILABLE",
    status: 502,
  });
}

export async function verifyCiRemote(input, options = {}) {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const runId = String(input?.runId ?? "").trim();
  const releaseSha = String(input?.releaseSha ?? "").trim();

  if (!/^\d+$/.test(runId) || !SHA_PATTERN.test(releaseSha)) {
    throw Object.assign(new Error("Valid numeric runId and 40-char releaseSha are required."), {
      code: "CI_VERIFICATION_MISMATCH",
      status: 409,
    });
  }

  const headers = await resolveGithubHeaders({ env, fetchImpl });
  const authMode = headers.authorization ? "TOKEN" : "PUBLIC_ANONYMOUS";
  const runRes = await fetchImpl(
    `https://api.github.com/repos/${REPOSITORY}/actions/runs/${encodeURIComponent(runId)}`,
    { headers, redirect: "error", signal: AbortSignal.timeout(10_000) },
  );
  if (!runRes.ok) {
    if (runRes.status === 404) {
      throw Object.assign(new Error("GitHub certification workflow run was not found."), {
        code: "CI_VERIFICATION_MISMATCH",
        status: 409,
      });
    }
    throw classifyGithubFailure(runRes, "workflow run");
  }

  const runJson = await runRes.json();
  const repository = runJson?.repository?.full_name ? String(runJson.repository.full_name) : undefined;
  if (repository && repository !== REPOSITORY) {
    throw Object.assign(new Error("GitHub certification workflow run repository does not match canonical repo."), {
      code: "CI_VERIFICATION_MISMATCH",
      status: 409,
    });
  }

  const attempt = Number(runJson.run_attempt) > 0 ? Number(runJson.run_attempt) : 1;
  const [certJobs, ciRunsRes, artifactsRes] = await Promise.all([
    fetchPaginatedGithubJobs(
      `https://api.github.com/repos/${REPOSITORY}/actions/runs/${encodeURIComponent(runId)}/attempts/${attempt}/jobs`,
      headers,
      fetchImpl,
    ),
    fetchImpl(
      `https://api.github.com/repos/${REPOSITORY}/actions/workflows/ci.yml/runs?head_sha=${encodeURIComponent(releaseSha)}&branch=main&per_page=20`,
      { headers, redirect: "error", signal: AbortSignal.timeout(10_000) },
    ),
    fetchImpl(
      `https://api.github.com/repos/${REPOSITORY}/actions/runs/${encodeURIComponent(runId)}/artifacts?per_page=100`,
      { headers, redirect: "error", signal: AbortSignal.timeout(10_000) },
    ),
  ]);

  const certSucceeded = new Set(
    certJobs.filter((j) => j.conclusion === "success" && typeof j.name === "string").map((j) => j.name),
  );
  const missingJobs = REQUIRED_CERTIFICATION_JOBS.filter((name) => !certSucceeded.has(name));
  const skippedJobs = certJobs.filter((j) => j.conclusion === "skipped").length;

  let primaryCiVerified = false;
  if (!ciRunsRes.ok) {
    if (ciRunsRes.status === 403 || ciRunsRes.status === 429 || ciRunsRes.status === 401) {
      throw classifyGithubFailure(ciRunsRes, "primary CI workflow runs");
    }
  } else {
    const ciRunsJson = await ciRunsRes.json();
    const matchingCi = (ciRunsJson?.workflow_runs ?? []).find(
      (r) =>
        (!r.repository?.full_name || r.repository.full_name === REPOSITORY) &&
        (!r.path || r.path === ".github/workflows/ci.yml") &&
        r.head_sha === releaseSha &&
        r.head_branch === "main" &&
        r.status === "completed" &&
        r.conclusion === "success" &&
        typeof r.id === "number",
    );
    if (matchingCi?.id) {
      const ciAttempt = Number(matchingCi.run_attempt) > 0 ? Number(matchingCi.run_attempt) : 1;
      const ciJobs = await fetchPaginatedGithubJobs(
        `https://api.github.com/repos/${REPOSITORY}/actions/runs/${matchingCi.id}/attempts/${ciAttempt}/jobs`,
        headers,
        fetchImpl,
      );
      const ciSucceeded = new Set(
        ciJobs.filter((j) => j.conclusion === "success" && typeof j.name === "string").map((j) => j.name),
      );
      const ciSkipped = ciJobs.filter((j) => REQUIRED_PRIMARY_CI_JOBS.includes(j.name) && j.conclusion === "skipped").length;
      primaryCiVerified = REQUIRED_PRIMARY_CI_JOBS.every((jobName) => ciSucceeded.has(jobName)) && ciSkipped === 0;
    }
  }

  if (!artifactsRes.ok) {
    throw classifyGithubFailure(artifactsRes, "certification artifacts");
  }

  const artifactsPayload = await artifactsRes.json();
  const activeArtifacts = (artifactsPayload?.artifacts ?? []).filter(
    (a) => a.expired !== true && typeof a.name === "string",
  );
  const presentArtifacts = new Set(activeArtifacts.map((a) => a.name));
  const missingArtifacts = REQUIRED_CERTIFICATION_ARTIFACTS.filter((name) => !presentArtifacts.has(name));
  const artifactsVerified = missingArtifacts.length === 0;

  let verifiedTestsPassed = null;
  let artifactDownloadVerified = false;
  let artifactDownloadStatus = artifactsVerified
    ? authMode === "PUBLIC_ANONYMOUS"
      ? "REQUIRES_AUTH"
      : "UNAVAILABLE"
    : "MISSING_REQUIRED_ARTIFACT";

  const qualityArtifact = activeArtifacts.find(
    (a) => a.name === "certification-quality" && typeof a.archive_download_url === "string",
  );
  if (qualityArtifact?.archive_download_url) {
    if (authMode === "PUBLIC_ANONYMOUS") {
      artifactDownloadStatus = artifactsVerified ? "REQUIRES_AUTH" : "MISSING_REQUIRED_ARTIFACT";
    } else {
      const zipRes = await fetchImpl(qualityArtifact.archive_download_url, {
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      }).catch(() => null);
      if (!zipRes) {
        artifactDownloadStatus = "UNAVAILABLE";
      } else if (zipRes.status === 401 || zipRes.status === 403) {
        const rateLimited = zipRes.status === 403 && zipRes.headers?.get?.("x-ratelimit-remaining") === "0";
        artifactDownloadStatus = rateLimited ? "RATE_LIMITED" : "UNAUTHORIZED";
      } else if (zipRes.status === 429) {
        artifactDownloadStatus = "RATE_LIMITED";
      } else if (zipRes.ok) {
        const buf = Buffer.from(await zipRes.arrayBuffer());
        verifiedTestsPassed = extractPrimaryTestCountFromZip(buf);
        if (verifiedTestsPassed !== null) {
          artifactDownloadVerified = true;
          artifactDownloadStatus = "VERIFIED";
        } else {
          artifactDownloadStatus = "INVALID_PAYLOAD";
        }
      } else {
        artifactDownloadStatus = "UNAVAILABLE";
      }
    }
  }

  const headSha = String(runJson.head_sha ?? "");
  const headBranch = String(runJson.head_branch ?? "");
  const workflowPath = String(runJson.path ?? "");
  const status = String(runJson.status ?? "");
  const conclusion = String(runJson.conclusion ?? "");

  if (
    headSha !== releaseSha ||
    headBranch !== "main" ||
    workflowPath !== ".github/workflows/production-certification.yml" ||
    status !== "completed" ||
    conclusion !== "success" ||
    skippedJobs !== 0 ||
    missingJobs.length > 0 ||
    !primaryCiVerified ||
    !artifactsVerified
  ) {
    throw Object.assign(
      new Error("GitHub CI or Engineering Certification run did not pass every mandatory check and required artifact on main at exact SHA."),
      { code: "CI_VERIFICATION_MISMATCH", status: 409 },
    );
  }

  return {
    repository: repository ?? REPOSITORY,
    headSha,
    headBranch,
    workflowPath,
    status,
    conclusion,
    completedAt: String(runJson.updated_at ?? (options.now ?? (() => new Date()))().toISOString()),
    jobsPassed: certJobs.filter((j) => j.conclusion === "success").length,
    skippedJobs,
    missingJobs,
    primaryCiVerified,
    verifiedTestsPassed,
    artifactsVerified,
    missingArtifacts,
    artifactDownloadVerified,
    artifactDownloadStatus,
    authMode,
  };
}
