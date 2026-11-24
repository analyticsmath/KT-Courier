import {
  AUDIENCE,
  ENVIRONMENT,
  EVIDENCE_KEYS,
  EXPECTED_EXCLUDED_CAPABILITIES,
  REPOSITORY,
  REQUIRED_LAUNCH_SCOPE,
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

async function collectGithubWorkflows({ commitSha, ciRunId, certificationRunId, githubToken, fetchImpl }) {
  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${githubToken}`,
    "user-agent": "KT-Courier-Release-Authority",
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

export async function collectVerifiedReleaseContext(params, options = {}) {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;

  const githubToken = (env.GITHUB_RELEASE_READ_TOKEN ?? "").trim();
  const vercelToken = (env.VERCEL_TOKEN ?? "").trim();
  const railwayToken = (env.RAILWAY_API_TOKEN ?? "").trim();
  const appOrigin = (env.KT_PRODUCTION_ORIGIN ?? env.PAYMENT_APP_ORIGIN ?? "").trim();

  if (!githubToken || !vercelToken || !railwayToken || !appOrigin) {
    throw Object.assign(
      new Error("Release authority upstream collector tokens (GitHub, Vercel, Railway, KT_PRODUCTION_ORIGIN) must be configured."),
      { code: "INDEPENDENT_AUTHORITY_UNAVAILABLE", status: 503 },
    );
  }

  const readyUrl = await assertSafeTargetUrl(`${appOrigin.replace(/\/$/, "")}/api/infrastructure/ready`, {
    allowLoopbackForTest: options.allowLoopbackForTest === true,
    resolveDns: options.resolveDns,
  });

  const [githubState, deployments, readyRes] = await Promise.all([
    collectGithubWorkflows({
      commitSha: params.commitSha,
      ciRunId: params.ciRunId,
      certificationRunId: params.certificationRunId,
      githubToken,
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
  ]);

  if (!readyRes.ok) {
    throw Object.assign(new Error("Production health check returned non-200 status."), { code: "HEALTH_CHECK_FAILED", status: 409 });
  }
  const readyJson = await readyRes.json();
  const health = {
    postgresOnline: readyJson?.database === "reachable",
    redisOnline: readyJson?.redis?.configured === true && readyJson?.redis?.connected === true,
    healthy: readyJson?.status === "ready" && readyJson?.database === "reachable" && readyJson?.redis?.configured === true && readyJson?.redis?.connected === true,
  };

  if (!params.auditReceipt || params.auditReceipt.releaseSha !== params.commitSha || params.auditReceipt.protectedDataUnchanged !== true || params.auditReceipt.leastPrivilege !== true) {
    throw Object.assign(new Error("Verified read-only protected-row database audit receipt required."), { code: "SCOPE_OR_POLICY_MISMATCH", status: 409 });
  }

  for (const key of EVIDENCE_KEYS) {
    if (!params.evidence?.[key]?.reference || !params.evidence?.[key]?.digest || !params.evidence?.[key]?.observedAt || !params.evidence?.[key]?.expiresAt) {
      throw Object.assign(new Error(`Missing evidence bundle details for ${key}.`), { code: "SCOPE_OR_POLICY_MISMATCH", status: 409 });
    }
  }

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
    evidence: params.evidence,
    auditReceipt: params.auditReceipt,
  };
}

export async function verifyParityRemote(input, options = {}) {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
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

  const [deployments, readyRes] = await Promise.all([
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
  ]);

  if (!readyRes.ok) {
    throw Object.assign(new Error("Health endpoint failed."), { code: "HEALTH_CHECK_FAILED", status: 409 });
  }
  const readyJson = await readyRes.json();
  const healthy = readyJson?.status === "ready" && readyJson?.database === "reachable" && readyJson?.redis?.connected === true;

  return {
    vercelSha: deployments.vercel.sha,
    vercelState: deployments.vercel.state,
    webSha: deployments.railwayWeb.sha,
    webStatus: deployments.railwayWeb.status,
    operationsSha: deployments.railwayOperations.sha,
    operationsStatus: deployments.railwayOperations.status,
    querySha: deployments.railwayQuery.sha,
    queryStatus: deployments.railwayQuery.status,
    auditReleaseSha: input.releaseSha,
    protectedDataUnchanged: Boolean(healthy),
    leastPrivilege: Boolean(healthy),
    auditDigest: sha256Hex(canonicalBytes({ deployments, readyJson, ref: input.protectedDataAuditReference })),
  };
}
