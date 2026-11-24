import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exactCertificationSourceMatches } from "./check-closure-engineering-gates.mjs";
import { canonicalBytes, verifyReleaseAttestation } from "./release-attestation.mjs";
import { validateTrustBundle } from "./release-authority-helpers.mjs";
import {
  createHttpReleaseAuthorityAdapter,
  isValidEvidenceReference,
  isValidSha,
  resolveConfiguredTrust,
  validateAuthorityOrigin,
} from "./release-authority-client.mjs";

const REPO = "analyticsmath/KT-Courier";
const EXPECTED_EXCLUDED_CAPABILITIES = ["ADVERTISING", "PROMOTERS", "SUBSCRIPTIONS"];
const REQUIRED_EVIDENCE_KEYS = [
  "provider",
  "packing",
  "driver_store",
  "physical_pod",
  "tax_finance",
  "notification",
  "media",
  "database_audit",
];

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableEqual(a, b) {
  return Buffer.compare(canonicalBytes(a), canonicalBytes(b)) === 0;
}

/** Static baseline classification helper preserved for explicit refusal classification. */
export function classifyReleaseAttempt({ releaseSha, workflowSha, sourceSha, evidenceReference }) {
  let reason = "INDEPENDENT_AUTHORITY_UNAVAILABLE";
  if (!exactCertificationSourceMatches(sourceSha, workflowSha) || !exactCertificationSourceMatches(sourceSha, releaseSha)) {
    reason = "SOURCE_MISMATCH";
  } else if (!isValidEvidenceReference(evidenceReference)) {
    reason = "INVALID_EVIDENCE_REFERENCE";
  }
  return {
    schemaVersion: 1,
    releaseAuthorized: false,
    status: "RELEASE_NOT_AUTHORIZED",
    reason,
    sourceSha: isValidSha(sourceSha) ? sourceSha : null,
    evidenceReferenceDigest:
      typeof evidenceReference === "string" && evidenceReference.length <= 200 ? sha256Hex(evidenceReference) : null,
  };
}

function writeArtifact(outputDir, filename, payload) {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, filename), `${JSON.stringify(payload, null, 2)}\n`);
}

function refusalResult({ sourceSha, treeSha, evidenceReference, reason, detail, outputDir }) {
  const refusal = {
    schemaVersion: 2,
    releaseAuthorized: false,
    status: "RELEASE_NOT_AUTHORIZED",
    reason,
    detail,
    sourceSha: isValidSha(sourceSha) ? sourceSha : null,
    treeSha: isValidSha(treeSha) ? treeSha : null,
    evidenceReferenceDigest:
      typeof evidenceReference === "string" && evidenceReference.length <= 200 ? sha256Hex(evidenceReference) : null,
    evaluatedAt: new Date().toISOString(),
  };
  if (outputDir) {
    writeArtifact(outputDir, "release-authorization-refusal.json", refusal);
  }
  return refusal;
}

function verifyIndependentContext(context, { sourceSha, treeSha, evidenceReference, nowMs }) {
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    return { ok: false, reason: "AUTHORITY_UNREACHABLE", detail: "Verified release context missing." };
  }
  if (context.repository !== REPO || context.environment !== "production" || context.audience !== "kt-couriers-release") {
    return { ok: false, reason: "SCOPE_OR_POLICY_MISMATCH", detail: "Repository, environment, or audience mismatch in verified context." };
  }
  if (context.commitSha !== sourceSha || !isValidSha(context.treeSha) || context.treeSha !== treeSha) {
    return { ok: false, reason: "SOURCE_CONTEXT_MISMATCH", detail: "Commit SHA or tree SHA mismatch against verified release context." };
  }
  if (context.evidenceReference && context.evidenceReference !== evidenceReference) {
    return { ok: false, reason: "SOURCE_CONTEXT_MISMATCH", detail: "Evidence reference mismatch in verified context." };
  }

  const ciRun = context.ciRun;
  if (
    !ciRun ||
    ciRun.headSha !== sourceSha ||
    ciRun.status !== "completed" ||
    ciRun.conclusion !== "success" ||
    ciRun.mandatoryJobsSucceeded !== true ||
    ciRun.skippedCriticalJobs !== 0 ||
    typeof ciRun.artifactDigest !== "string" ||
    !/^[a-f0-9]{64}$/.test(ciRun.artifactDigest)
  ) {
    return { ok: false, reason: "CI_VERIFICATION_FAILED", detail: "Exact-SHA primary CI run did not pass all mandatory gates." };
  }

  const certRun = context.certificationRun;
  if (
    !certRun ||
    !Number.isInteger(certRun.id) ||
    certRun.id <= 0 ||
    certRun.headSha !== sourceSha ||
    certRun.status !== "completed" ||
    certRun.conclusion !== "success" ||
    !Number.isInteger(certRun.jobsTotal) ||
    certRun.jobsTotal < 26 ||
    certRun.jobsPassed !== certRun.jobsTotal ||
    certRun.skippedJobs !== 0 ||
    typeof certRun.evidenceDigest !== "string" ||
    !/^[a-f0-9]{64}$/.test(certRun.evidenceDigest)
  ) {
    return { ok: false, reason: "CERTIFICATION_VERIFICATION_FAILED", detail: "Exact-SHA 26-job Engineering Certification run not verified." };
  }

  const deployments = context.deployments;
  const vercel = deployments?.vercel;
  const web = deployments?.railwayWeb;
  const ops = deployments?.railwayOperations;
  const query = deployments?.railwayQuery;
  if (
    !vercel?.id ||
    vercel.sha !== sourceSha ||
    vercel.state !== "READY" ||
    vercel.target !== "production" ||
    !web?.id ||
    web.sha !== sourceSha ||
    web.status !== "SUCCESS" ||
    !ops?.id ||
    ops.sha !== sourceSha ||
    ops.status !== "SUCCESS" ||
    (query && (!query.id || query.sha !== sourceSha || query.status !== "SUCCESS"))
  ) {
    return { ok: false, reason: "DEPLOYMENT_PARITY_MISMATCH", detail: "Production Vercel and Railway deployments do not match the candidate SHA in ready state." };
  }

  const health = context.health;
  if (!health || health.postgresOnline !== true || health.redisOnline !== true || health.healthy !== true) {
    return { ok: false, reason: "HEALTH_CHECK_FAILED", detail: "Production PostgreSQL/Redis runtime health check is not healthy." };
  }

  const excluded = Array.isArray(context.scope?.excludedCapabilities) ? [...context.scope.excludedCapabilities].sort() : [];
  if (
    !Array.isArray(context.scope?.mandatoryChecks) ||
    context.scope.mandatoryChecks.length === 0 ||
    !stableEqual(excluded, EXPECTED_EXCLUDED_CAPABILITIES)
  ) {
    return { ok: false, reason: "SCOPE_OR_POLICY_MISMATCH", detail: "Scope must preserve mandatory checks and only the three approved exclusions." };
  }

  if (!context.policies || typeof context.policies !== "object" || Array.isArray(context.policies)) {
    return { ok: false, reason: "SCOPE_OR_POLICY_MISMATCH", detail: "Verified policy digests missing." };
  }

  for (const key of REQUIRED_EVIDENCE_KEYS) {
    const entry = context.evidence?.[key];
    if (!entry || typeof entry.reference !== "string" || !entry.reference || typeof entry.digest !== "string" || !entry.digest) {
      return { ok: false, reason: "SCOPE_OR_POLICY_MISMATCH", detail: `Missing verified evidence digest for ${key}.` };
    }
    if (entry.observedAt && (!Number.isFinite(Date.parse(entry.observedAt)) || Date.parse(entry.observedAt) > nowMs)) {
      return { ok: false, reason: "STALE_EVIDENCE", detail: `Evidence timestamp invalid for ${key}.` };
    }
    if (entry.expiresAt && (!Number.isFinite(Date.parse(entry.expiresAt)) || Date.parse(entry.expiresAt) <= nowMs)) {
      return { ok: false, reason: "STALE_EVIDENCE", detail: `Evidence expired for ${key}.` };
    }
  }

  return { ok: true };
}

export async function authorizeProductionRelease({
  releaseSha,
  workflowSha,
  sourceSha,
  treeSha,
  evidenceReference,
  env = process.env,
  now = new Date(),
  outputDir = null,
  authorityAdapter = null,
  allowLoopbackForTest = false,
  trackedDirty = false,
}) {
  const staticAttempt = classifyReleaseAttempt({ releaseSha, workflowSha, sourceSha, evidenceReference });
  if (staticAttempt.reason !== "INDEPENDENT_AUTHORITY_UNAVAILABLE") {
    return refusalResult({
      sourceSha,
      treeSha,
      evidenceReference,
      reason: staticAttempt.reason,
      detail: "Source commit parity or evidence reference validation failed.",
      outputDir,
    });
  }
  if (!isValidSha(treeSha)) {
    return refusalResult({
      sourceSha,
      treeSha,
      evidenceReference,
      reason: "SOURCE_MISMATCH",
      detail: "Valid git tree SHA is required.",
      outputDir,
    });
  }

  let adapter = authorityAdapter;
  const originConfig = env.RELEASE_AUTHORITY_ORIGIN;
  const allowedOriginConfig = env.RELEASE_AUTHORITY_ALLOWED_ORIGIN || originConfig;
  const tokenConfig = env.RELEASE_AUTHORITY_TOKEN;

  if (!adapter) {
    if (!originConfig && !tokenConfig && !env.RELEASE_AUTHORITY_TRUST_ANCHORS && !env.RELEASE_AUTHORITY_TRUST_SHA256) {
      return refusalResult({
        sourceSha,
        treeSha,
        evidenceReference,
        reason: "INDEPENDENT_AUTHORITY_UNAVAILABLE",
        detail: "Independent release authority credentials and trust configuration are unavailable.",
        outputDir,
      });
    }
    if (trackedDirty) {
      return refusalResult({
        sourceSha,
        treeSha,
        evidenceReference,
        reason: "DIRTY_WORKTREE",
        detail: "Refusing release authorization in a worktree with uncommitted tracked modifications.",
        outputDir,
      });
    }
    const endpointCheck = validateAuthorityOrigin(originConfig, allowedOriginConfig, { allowLoopbackForTest });
    if (!endpointCheck.ok) {
      return refusalResult({
        sourceSha,
        treeSha,
        evidenceReference,
        reason: endpointCheck.reason,
        detail: endpointCheck.detail,
        outputDir,
      });
    }
    if (!tokenConfig || String(tokenConfig).trim().length < 16) {
      return refusalResult({
        sourceSha,
        treeSha,
        evidenceReference,
        reason: "INDEPENDENT_AUTHORITY_UNAVAILABLE",
        detail: "Independent authority bearer credential is not configured.",
        outputDir,
      });
    }
    adapter = createHttpReleaseAuthorityAdapter({
      origin: endpointCheck.origin,
      bearerToken: tokenConfig,
    });
  }

  const trustConfig = resolveConfiguredTrust(env, canonicalBytes);
  if (!trustConfig.ok) {
    return refusalResult({
      sourceSha,
      treeSha,
      evidenceReference,
      reason: trustConfig.reason,
      detail: trustConfig.detail,
      outputDir,
    });
  }

  const nowMs = now.getTime();
  let trustMap = trustConfig.trust;
  try {
    if (!trustMap && trustConfig.fetchRemoteTrustWithPinnedSha256) {
      const remoteTrustRaw = await adapter.getTrustBundle();
      const validated = validateTrustBundle(remoteTrustRaw);
      if (!validated.ok || sha256Hex(canonicalBytes(remoteTrustRaw)) !== trustConfig.fetchRemoteTrustWithPinnedSha256) {
        return refusalResult({
          sourceSha,
          treeSha,
          evidenceReference,
          reason: "TRUST_ANCHOR_INTEGRITY_MISMATCH",
          detail: "Remote trust bundle failed validation or pinned digest check.",
          outputDir,
        });
      }
      trustMap = validated.trust;
    }

    const [verifiedContext, envelope] = await Promise.all([
      adapter.getVerifiedReleaseContext({ releaseSha: sourceSha, treeSha, evidenceReference }),
      adapter.getSignedEvidenceEnvelope({ releaseSha: sourceSha, evidenceReference }),
    ]);

    const contextCheck = verifyIndependentContext(verifiedContext, { sourceSha, treeSha, evidenceReference, nowMs });
    if (!contextCheck.ok) {
      return refusalResult({
        sourceSha,
        treeSha,
        evidenceReference,
        reason: contextCheck.reason,
        detail: contextCheck.detail,
        outputDir,
      });
    }

    if (verifiedContext.evidenceReference && verifiedContext.evidenceReference !== evidenceReference) {
      return refusalResult({
        sourceSha,
        treeSha,
        evidenceReference,
        reason: "SOURCE_CONTEXT_MISMATCH",
        detail: "Verified release context reference does not match requested evidence reference.",
        outputDir,
      });
    }

    const issuanceId = envelope?.payload?.issuanceId;
    if (typeof issuanceId !== "string" || issuanceId.length < 16 || issuanceId.length > 200) {
      return refusalResult({
        sourceSha,
        treeSha,
        evidenceReference,
        reason: "ATTESTATION_INVALID",
        detail: "Envelope payload issuanceId is missing or malformed.",
        outputDir,
      });
    }

    const revocations = await adapter.getRevocationStatus({ releaseSha: sourceSha, evidenceReference, issuanceId });
    if (
      revocations.revokedIssuanceIds.includes(issuanceId) ||
      revocations.revokedEvidenceReferences.includes(evidenceReference) ||
      envelope.payload.revoked === true
    ) {
      return refusalResult({
        sourceSha,
        treeSha,
        evidenceReference,
        reason: "EVIDENCE_REVOKED",
        detail: "Attestation issuance or evidence reference is revoked.",
        outputDir,
      });
    }

    const effectiveTrust = Object.fromEntries(
      Object.entries(trustMap).map(([keyId, entry]) => [
        keyId,
        revocations.revokedKeyIds.includes(keyId) ? { ...entry, revoked: true } : entry,
      ]),
    );

    const attestationContext = {
      commitSha: verifiedContext.commitSha,
      treeSha: verifiedContext.treeSha,
      ciRunId: String(verifiedContext.certificationRun.id),
      ciEvidenceDigest: verifiedContext.certificationRun.evidenceDigest,
      ciStatus: "success",
      deployments: {
        vercel: verifiedContext.deployments.vercel.id,
        railwayWeb: verifiedContext.deployments.railwayWeb.id,
        railwayOperations: verifiedContext.deployments.railwayOperations.id,
      },
      policies: verifiedContext.policies,
      evidence: Object.fromEntries(
        REQUIRED_EVIDENCE_KEYS.map((key) => [
          key,
          { reference: verifiedContext.evidence[key].reference, digest: verifiedContext.evidence[key].digest },
        ]),
      ),
      requestedScope: verifiedContext.scope.mandatoryChecks,
      now: nowMs,
    };

    try {
      verifyReleaseAttestation(envelope, effectiveTrust, attestationContext);
    } catch {
      return refusalResult({
        sourceSha,
        treeSha,
        evidenceReference,
        reason: "ATTESTATION_INVALID",
        detail: "Release attestation signature, principal separation, freshness, or bound context verification failed.",
        outputDir,
      });
    }

    const claimReceipt = await adapter.claimSingleUseIssuance({
      repository: REPO,
      environment: "production",
      audience: "kt-couriers-release",
      commitSha: sourceSha,
      treeSha,
      issuanceId,
      evidenceReferenceDigest: sha256Hex(evidenceReference),
      ciRunId: verifiedContext.ciRun.id,
      certificationRunId: verifiedContext.certificationRun.id,
      ciEvidenceDigest: verifiedContext.certificationRun.evidenceDigest,
      deployments: attestationContext.deployments,
      railwayQueryDeploymentId: verifiedContext.deployments.railwayQuery?.id ?? null,
      scopeDigest: sha256Hex(canonicalBytes(verifiedContext.scope)),
      policyDigest: sha256Hex(canonicalBytes(verifiedContext.policies)),
      claimedAt: new Date(nowMs).toISOString(),
    });

    const redactedSigners = envelope.approvals.map((approval) => ({
      role: approval.role,
      keyIdDigest: sha256Hex(approval.keyId),
      signerDigest: sha256Hex(approval.principal),
    }));

    const successResult = {
      schemaVersion: 2,
      releaseAuthorized: true,
      status: "RELEASE_AUTHORIZED",
      reason: "AUTHORIZED",
      repository: REPO,
      environment: "production",
      audience: "kt-couriers-release",
      sourceSha,
      treeSha,
      issuanceId: claimReceipt.issuanceId,
      receiptId: claimReceipt.receiptId,
      evidenceReferenceDigest: sha256Hex(evidenceReference),
      ciRunId: verifiedContext.ciRun.id,
      certificationRunId: verifiedContext.certificationRun.id,
      ciEvidenceDigest: verifiedContext.certificationRun.evidenceDigest,
      deployments: {
        vercel: verifiedContext.deployments.vercel.id,
        railwayWeb: verifiedContext.deployments.railwayWeb.id,
        railwayOperations: verifiedContext.deployments.railwayOperations.id,
        railwayQuery: verifiedContext.deployments.railwayQuery?.id ?? null,
      },
      signers: redactedSigners,
      issuedAt: envelope.payload.issuedAt,
      expiresAt: envelope.payload.expiresAt,
      authorizedAt: claimReceipt.claimedAt,
    };

    if (outputDir) {
      writeArtifact(outputDir, "release-authorization-result.json", successResult);
    }
    return successResult;
  } catch (error) {
    const reason =
      error && typeof error === "object" && "code" in error && typeof error.code === "string"
        ? error.code
        : "AUTHORITY_UNREACHABLE";
    return refusalResult({
      sourceSha,
      treeSha,
      evidenceReference,
      reason,
      detail: error instanceof Error ? error.message : "Independent authority verification failed.",
      outputDir,
    });
  }
}

export async function runReleaseAuthorizationCli({ env = process.env, outputDir = "output/production-closure" } = {}) {
  let sourceSha = null;
  let treeSha = null;
  let trackedDirty = false;
  try {
    sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", timeout: 5000 }).trim();
    treeSha = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8", timeout: 5000 }).trim();
    trackedDirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8", timeout: 5000 }).trim().length > 0;
  } catch {
    /* refusal below handles missing git state */
  }

  const result = await authorizeProductionRelease({
    sourceSha,
    treeSha,
    releaseSha: env.RELEASE_SHA,
    workflowSha: env.WORKFLOW_SHA,
    evidenceReference: env.EVIDENCE_REFERENCE,
    trackedDirty,
    env,
    outputDir,
  });

  if (!result.releaseAuthorized) {
    console.error(`${result.status}: ${result.reason}. ${result.detail}`);
    return { exitCode: 1, result };
  }

  console.log(`${result.status}: issuance=${result.issuanceId} receipt=${result.receiptId} sha=${result.sourceSha}`);
  return { exitCode: 0, result };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { exitCode } = await runReleaseAuthorizationCli();
  process.exitCode = exitCode;
}
