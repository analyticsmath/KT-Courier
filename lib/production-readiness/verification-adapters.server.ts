import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { PlatformError } from "@/lib/client-platform/contracts";
import { verifyAuditReceipt } from "@/services/release-authority/src/audit-receipt.mjs";
import {
  fetchGithubCiRun,
  type AcceptanceVerificationOptions,
  type VerifiedCiRunInfo,
  type VerifiedParityInfo,
} from "./evidence";
import { resolveGithubReadAuthorization } from "./github-auth";

const ALLOWED_PARITY_VERIFIER_HOSTS = new Set<string>(
  (process.env.KT_PARITY_VERIFIER_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean),
);

function isPrivateOrReservedIp(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("::ffff:")) {
    if (normalized.startsWith("::ffff:")) {
      return isPrivateOrReservedIp(normalized.slice(7));
    }
    return true;
  }
  if (normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(normalized);
  if (!v4) return isIP(ip) !== 0 ? false : true;
  const [a, b] = [Number(v4[1]), Number(v4[2])];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

export async function assertSafeRemoteUrl(
  rawUrl: string,
  options: Readonly<{
    allowedHosts?: ReadonlySet<string>;
    allowLoopbackForTest?: boolean;
    resolveDns?: (hostname: string, options: { all: true }) => Promise<Array<{ address: string; family: number }>>;
  }> = {},
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new PlatformError("UNSAFE_VERIFIER_URL", "Configured verifier URL is invalid.", 409);
  }
  if (parsed.username || parsed.password || parsed.hash) {
    throw new PlatformError("UNSAFE_VERIFIER_URL", "Configured verifier URL contains forbidden credentials or fragment.", 409);
  }
  const hostname = parsed.hostname.toLowerCase();
  const isLoopbackHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  if (options.allowLoopbackForTest && isLoopbackHost) {
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new PlatformError("UNSAFE_VERIFIER_URL", "Verifier URL protocol must be HTTP or HTTPS.", 409);
    }
    return parsed;
  }
  if (parsed.protocol !== "https:") {
    throw new PlatformError("UNSAFE_VERIFIER_URL", "Verifier endpoint must use HTTPS.", 409);
  }
  if (options.allowedHosts && options.allowedHosts.size > 0 && !options.allowedHosts.has(hostname)) {
    throw new PlatformError("UNSAFE_VERIFIER_URL", "Verifier host is not in the configured allowlist.", 409);
  }
  if (isIP(hostname) !== 0) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new PlatformError("UNSAFE_VERIFIER_URL", "Private or reserved verifier IP is forbidden.", 409);
    }
    return parsed;
  }
  const dnsLookup = options.resolveDns ?? lookup;
  const rawResolved = await dnsLookup(hostname, { all: true }).catch(() => {
    throw new PlatformError("PARITY_VERIFICATION_UNAVAILABLE", "Unable to resolve verifier endpoint host.", 409);
  });
  const resolved = Array.isArray(rawResolved) ? rawResolved : [rawResolved];
  if (!resolved.length || resolved.some((record) => isPrivateOrReservedIp(record.address))) {
    throw new PlatformError("UNSAFE_VERIFIER_URL", "Verifier endpoint resolved to a private or reserved address.", 409);
  }
  return parsed;
}

function extractCommitSha(meta: Record<string, unknown> | undefined | null): string {
  if (!meta) return "";
  for (const key of ["commitHash", "githubCommitSha", "RAILWAY_GIT_COMMIT_SHA", "VERCEL_GIT_COMMIT_SHA", "sha"]) {
    const val = meta[key];
    if (typeof val === "string" && /^[a-f0-9]{40}$/.test(val.trim())) {
      return val.trim();
    }
  }
  return "";
}

async function queryVercelDeployment(
  deploymentId: string,
  token: string,
  teamId: string | undefined,
  fetchImpl: typeof fetch,
): Promise<{ sha: string; state: string }> {
  const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
  const response = await fetchImpl(
    `https://api.vercel.com/v13/deployments/${encodeURIComponent(deploymentId)}${query}`,
    {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    throw new PlatformError("PARITY_VERIFICATION_UNAVAILABLE", "Unable to query Vercel deployment parity.", 409);
  }
  const payload = (await response.json()) as {
    id?: string;
    readyState?: string;
    meta?: Record<string, unknown>;
    gitSource?: { sha?: string };
  };
  if (payload.id !== deploymentId) {
    throw new PlatformError("PARITY_VERIFICATION_MISMATCH", "Vercel deployment ID mismatch.", 409);
  }
  const sha = extractCommitSha(payload.meta) || (typeof payload.gitSource?.sha === "string" ? payload.gitSource.sha : "");
  return { sha, state: String(payload.readyState ?? "") };
}

async function queryRailwayDeployments(
  ids: Readonly<{ webDeploymentId: string; operationsDeploymentId: string; queryDeploymentId: string }>,
  token: string,
  fetchImpl: typeof fetch,
): Promise<{
  web: { sha: string; status: string; serviceName: string };
  operations: { sha: string; status: string; serviceName: string };
  query: { sha: string; status: string; serviceName: string };
}> {
  const graphql = `
    query DeploymentParity($webId: String!, $opsId: String!, $queryId: String!) {
      web: deployment(id: $webId) { id status meta service { name } }
      operations: deployment(id: $opsId) { id status meta service { name } }
      query: deployment(id: $queryId) { id status meta service { name } }
    }
  `;
  const response = await fetchImpl("https://backboard.railway.com/graphql/v2", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      query: graphql,
      variables: {
        webId: ids.webDeploymentId,
        opsId: ids.operationsDeploymentId,
        queryId: ids.queryDeploymentId,
      },
    }),
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new PlatformError("PARITY_VERIFICATION_UNAVAILABLE", "Unable to query Railway deployments.", 409);
  }
  const json = (await response.json()) as {
    data?: Record<string, { id?: string; status?: string; meta?: Record<string, unknown>; service?: { name?: string } } | null>;
    errors?: Array<{ message?: string }>;
  };
  if (json.errors?.length || !json.data?.web || !json.data?.operations || !json.data?.query) {
    throw new PlatformError("PARITY_VERIFICATION_UNAVAILABLE", "Railway API did not return all three service deployments.", 409);
  }
  const parseNode = (
    node: { id?: string; status?: string; meta?: Record<string, unknown>; service?: { name?: string } },
    expectedId: string,
  ) => {
    if (node.id !== expectedId) {
      throw new PlatformError("PARITY_VERIFICATION_MISMATCH", "Railway deployment ID mismatch.", 409);
    }
    return {
      sha: extractCommitSha(node.meta),
      status: String(node.status ?? ""),
      serviceName: String(node.service?.name ?? ""),
    };
  };
  return {
    web: parseNode(json.data.web, ids.webDeploymentId),
    operations: parseNode(json.data.operations, ids.operationsDeploymentId),
    query: parseNode(json.data.query, ids.queryDeploymentId),
  };
}

export async function verifyProductionParityRemote(
  input: Readonly<{
    releaseSha: string;
    vercelDeploymentId: string;
    webDeploymentId: string;
    operationsDeploymentId: string;
    queryDeploymentId: string;
    protectedDataAuditReference: string;
  }>,
  options: Readonly<{
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
    allowLoopbackForTest?: boolean;
    now?: Date;
    auditReceiptResolver?: (reference: string) => unknown | Promise<unknown>;
  }> = {},
): Promise<VerifiedParityInfo> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const nowMs = (options.now ?? new Date()).getTime();
  const configuredClassification = env.KT_EXPECTED_AUDIT_CLASSIFICATION?.trim();
  const allowIsolatedForTest = env.KT_ALLOW_ISOLATED_AUDIT_CLASSIFICATION_FOR_TEST === "true";
  const expectedClassification =
    configuredClassification === "isolated_test" && allowIsolatedForTest ? "isolated_test" : "production";
  const expectedDatabase = env.KT_EXPECTED_AUDIT_DATABASE?.trim() || undefined;

  // Authoritative external release-authority parity verifier (`POST /v1/release-authority/parity/verify`)
  const externalUrl = env.KT_PARITY_VERIFIER_URL?.trim();
  if (externalUrl) {
    const allowedHosts = new Set<string>([
      ...ALLOWED_PARITY_VERIFIER_HOSTS,
      ...(env.KT_PARITY_VERIFIER_ALLOWED_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean),
    ]);
    const url = await assertSafeRemoteUrl(externalUrl, {
      allowedHosts: allowedHosts.size > 0 ? allowedHosts : undefined,
      allowLoopbackForTest: options.allowLoopbackForTest,
    });
    const verifierToken = env.KT_PARITY_VERIFIER_TOKEN?.trim();
    const res = await fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...(verifierToken ? { authorization: `Bearer ${verifierToken}` } : {}),
      },
      body: JSON.stringify(input),
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const errBody = (await res.json().catch(() => null)) as { code?: string; error?: string } | null;
      const passthroughCodes = new Set([
        "PARITY_VERIFICATION_MISMATCH",
        "AUDIT_LEAST_PRIVILEGE_REQUIRED",
        "AUDIT_INVENTORY_INCOMPLETE",
        "AUDIT_BASELINE_MISSING",
        "AUDIT_PROTECTED_CHANGES_UNVERIFIED",
        "AUDIT_RECEIPT_INVALID",
        "AUDIT_RECEIPT_NOT_FOUND",
        "AUDIT_RECEIPT_REVOKED",
        "EVIDENCE_REVOKED",
        "STALE_EVIDENCE",
        "INDEPENDENT_REVIEW_REQUIRED",
      ]);
      const errCode =
        res.status >= 400 && res.status < 500 && errBody?.code && passthroughCodes.has(errBody.code)
          ? errBody.code
          : "PARITY_VERIFICATION_UNAVAILABLE";
      throw new PlatformError(
        errCode,
        String(errBody?.error ?? "External deployment parity verifier returned an error."),
        409,
      );
    }
    const data = (await res.json()) as Partial<VerifiedParityInfo>;
    if (
      !data ||
      typeof data.vercelSha !== "string" ||
      typeof data.webSha !== "string" ||
      typeof data.operationsSha !== "string" ||
      typeof data.querySha !== "string" ||
      typeof data.auditReleaseSha !== "string" ||
      !/^[a-f0-9]{40}$/.test(data.auditReleaseSha) ||
      typeof data.auditReference !== "string" ||
      !data.auditReference.trim() ||
      typeof data.auditDatabase !== "string" ||
      !data.auditDatabase.trim() ||
      typeof data.auditClassification !== "string" ||
      typeof data.auditObservedAt !== "string" ||
      typeof data.auditExpiresAt !== "string" ||
      typeof data.auditDigest !== "string" ||
      !/^[a-f0-9]{64}$/.test(data.auditDigest)
    ) {
      throw new PlatformError("PARITY_VERIFICATION_MISMATCH", "External deployment parity response is incomplete.", 409);
    }
    if (data.leastPrivilege !== true) {
      throw new PlatformError("AUDIT_LEAST_PRIVILEGE_REQUIRED", "External parity audit was not verified under a least-privilege read-only role.", 409);
    }
    if (data.auditInventoryComplete !== true) {
      throw new PlatformError("AUDIT_INVENTORY_INCOMPLETE", "External parity audit inventory is incomplete.", 409);
    }
    if (data.auditBaselinePresent !== true) {
      throw new PlatformError("AUDIT_BASELINE_MISSING", "External parity audit lacks a pre-deployment baseline comparison.", 409);
    }
    if (data.auditParityEligible !== true) {
      throw new PlatformError("AUDIT_PROTECTED_CHANGES_UNVERIFIED", "External parity audit is not eligible for parity sign-off.", 409);
    }
    if (data.auditClassification !== expectedClassification) {
      throw new PlatformError("PARITY_VERIFICATION_MISMATCH", "External parity audit database classification mismatch.", 409);
    }
    if (expectedDatabase && data.auditDatabase !== expectedDatabase) {
      throw new PlatformError("PARITY_VERIFICATION_MISMATCH", "External parity audit database name mismatch.", 409);
    }
    const auditObsMs = Date.parse(data.auditObservedAt);
    const auditExpMs = Date.parse(data.auditExpiresAt);
    if (!Number.isFinite(auditObsMs) || !Number.isFinite(auditExpMs) || auditExpMs <= auditObsMs) {
      throw new PlatformError("AUDIT_RECEIPT_INVALID", "External parity audit receipt timestamps are malformed.", 409);
    }
    if (auditObsMs > nowMs || auditExpMs <= nowMs) {
      throw new PlatformError("STALE_EVIDENCE", "External parity audit receipt is expired or observed in the future.", 409);
    }
    return {
      vercelSha: data.vercelSha,
      vercelState: String(data.vercelState ?? ""),
      webSha: data.webSha,
      webStatus: String(data.webStatus ?? ""),
      operationsSha: data.operationsSha,
      operationsStatus: String(data.operationsStatus ?? ""),
      querySha: data.querySha,
      queryStatus: String(data.queryStatus ?? ""),
      auditReference: data.auditReference,
      auditBaselineReference: typeof data.auditBaselineReference === "string" ? data.auditBaselineReference : null,
      auditReleaseSha: data.auditReleaseSha,
      auditDatabase: data.auditDatabase,
      auditClassification: data.auditClassification,
      auditBaselinePresent: true,
      auditInventoryComplete: true,
      auditParityEligible: true,
      protectedDataUnchanged: data.protectedDataUnchanged === true,
      auditChangedTables: Array.isArray(data.auditChangedTables) ? data.auditChangedTables.map(String) : [],
      auditUnexpectedChangedTables: Array.isArray(data.auditUnexpectedChangedTables) ? data.auditUnexpectedChangedTables.map(String) : [],
      leastPrivilege: true,
      auditDigest: data.auditDigest,
      auditObservedAt: data.auditObservedAt,
      auditExpiresAt: data.auditExpiresAt,
    };
  }

  // Fail closed unless an explicit test harness supplies a verifiable auditReceiptResolver.
  if (typeof options.auditReceiptResolver !== "function") {
    throw new PlatformError(
      "PARITY_VERIFICATION_UNAVAILABLE",
      "KT_PARITY_VERIFIER_URL is required for deployment parity verification; local application-DB fallback is disabled.",
      409,
    );
  }

  const vercelToken = env.VERCEL_TOKEN?.trim();
  const railwayToken = env.RAILWAY_API_TOKEN?.trim();
  const appOrigin = (env.PAYMENT_APP_ORIGIN ?? env.NEXT_PUBLIC_APP_URL ?? "").trim();
  if (!vercelToken || !railwayToken || !appOrigin) {
    throw new PlatformError(
      "PARITY_VERIFICATION_UNAVAILABLE",
      "Server parity credentials (VERCEL_TOKEN, RAILWAY_API_TOKEN, PAYMENT_APP_ORIGIN) are not configured.",
      409,
    );
  }

  const readyUrl = await assertSafeRemoteUrl(`${appOrigin.replace(/\/$/, "")}/api/infrastructure/ready`, {
    allowLoopbackForTest: options.allowLoopbackForTest,
  });

  const [vercel, railway, readyResponse, rawReceipt] = await Promise.all([
    queryVercelDeployment(input.vercelDeploymentId, vercelToken, env.VERCEL_TEAM_ID?.trim(), fetchImpl),
    queryRailwayDeployments(
      {
        webDeploymentId: input.webDeploymentId,
        operationsDeploymentId: input.operationsDeploymentId,
        queryDeploymentId: input.queryDeploymentId,
      },
      railwayToken,
      fetchImpl,
    ),
    fetchImpl(readyUrl, {
      headers: { accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    }),
    Promise.resolve().then(() => options.auditReceiptResolver!(input.protectedDataAuditReference)),
  ]);

  if (!readyResponse.ok) {
    throw new PlatformError("PARITY_VERIFICATION_MISMATCH", "Production infrastructure readiness endpoint is not healthy.", 409);
  }
  const readyJson = (await readyResponse.json()) as {
    status?: string;
    database?: string;
    redis?: string | { configured?: boolean; connected?: boolean };
  };
  const redisReady =
    readyJson.redis === "connected" ||
    (typeof readyJson.redis === "object" &&
      readyJson.redis !== null &&
      readyJson.redis.configured === true &&
      readyJson.redis.connected === true);
  if (readyJson.status !== "ready" || readyJson.database !== "reachable" || !redisReady) {
    throw new PlatformError("PARITY_VERIFICATION_MISMATCH", "Production database or Redis health check is not ready.", 409);
  }

  if (
    railway.web.serviceName !== "web" ||
    railway.operations.serviceName !== "operations" ||
    railway.query.serviceName !== "query-storefront-categories"
  ) {
    throw new PlatformError(
      "PARITY_VERIFICATION_MISMATCH",
      "Railway deployment IDs must match the web, operations, and query-storefront-categories services.",
      409,
    );
  }

  let verifiedReceipt: ReturnType<typeof verifyAuditReceipt>;
  try {
    verifiedReceipt = verifyAuditReceipt(rawReceipt, {
      releaseSha: input.releaseSha,
      reference: input.protectedDataAuditReference,
      deployments: {
        vercelDeploymentId: input.vercelDeploymentId,
        webDeploymentId: input.webDeploymentId,
        operationsDeploymentId: input.operationsDeploymentId,
        queryDeploymentId: input.queryDeploymentId,
      },
      database: expectedDatabase,
      classification: expectedClassification,
      nowMs,
      enforceFreshness: true,
      requireParityEligibility: true,
    });
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err && typeof err.code === "string"
        ? err.code
        : "PARITY_VERIFICATION_MISMATCH";
    throw new PlatformError(code, err instanceof Error ? err.message : "Audit receipt verification failed.", 409);
  }

  return {
    vercelSha: vercel.sha,
    vercelState: vercel.state,
    webSha: railway.web.sha,
    webStatus: railway.web.status,
    operationsSha: railway.operations.sha,
    operationsStatus: railway.operations.status,
    querySha: railway.query.sha,
    queryStatus: railway.query.status,
    auditReference: verifiedReceipt.receiptReference,
    auditBaselineReference: verifiedReceipt.baselineReference ?? null,
    auditReleaseSha: verifiedReceipt.releaseSha,
    auditDatabase: verifiedReceipt.databaseIdentity.database,
    auditClassification: verifiedReceipt.databaseIdentity.classification,
    auditBaselinePresent: verifiedReceipt.comparison.baselinePresent === true,
    auditInventoryComplete: verifiedReceipt.inventory.inventoryComplete === true,
    auditParityEligible: verifiedReceipt.comparison.eligibleForParity === true,
    protectedDataUnchanged: verifiedReceipt.comparison.unchanged === true,
    auditChangedTables: verifiedReceipt.comparison.changedTables,
    auditUnexpectedChangedTables: verifiedReceipt.comparison.unexpectedChangedTables,
    leastPrivilege: verifiedReceipt.databaseIdentity.leastPrivilegeVerified === true,
    auditDigest: verifiedReceipt.receiptDigest,
    auditObservedAt: verifiedReceipt.observedAt,
    auditExpiresAt: verifiedReceipt.expiresAt,
  };
}

function deriveCiVerifierUrl(parityUrl: string): string {
  const parsed = new URL(parityUrl);
  if (/\/parity\/verify\/?$/.test(parsed.pathname)) {
    parsed.pathname = parsed.pathname.replace(/\/parity\/verify\/?$/, "/ci/verify");
  } else {
    parsed.pathname = "/v1/release-authority/ci/verify";
  }
  parsed.search = "";
  return parsed.toString();
}

export async function verifyCiCertificationRemote(
  input: Readonly<{ runId: string; releaseSha: string }>,
  options: Readonly<{
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
    allowLoopbackForTest?: boolean;
  }> = {},
): Promise<VerifiedCiRunInfo> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const externalUrl = env.KT_PARITY_VERIFIER_URL?.trim();

  if (externalUrl) {
    const allowedHosts = new Set<string>([
      ...ALLOWED_PARITY_VERIFIER_HOSTS,
      ...(env.KT_PARITY_VERIFIER_ALLOWED_HOSTS ?? "")
        .split(",")
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean),
    ]);
    const url = await assertSafeRemoteUrl(deriveCiVerifierUrl(externalUrl), {
      allowedHosts: allowedHosts.size > 0 ? allowedHosts : undefined,
      allowLoopbackForTest: options.allowLoopbackForTest,
    });
    const verifierToken = env.KT_PARITY_VERIFIER_TOKEN?.trim();
    let res: Response | null = null;
    try {
      res = await fetchImpl(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          ...(verifierToken ? { authorization: `Bearer ${verifierToken}` } : {}),
        },
        body: JSON.stringify(input),
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      res = null;
    }

    if (res) {
      if (res.ok) {
        const data = (await res.json()) as Partial<VerifiedCiRunInfo>;
        if (
          !data ||
          typeof data.headSha !== "string" ||
          typeof data.status !== "string" ||
          typeof data.conclusion !== "string" ||
          typeof data.completedAt !== "string" ||
          typeof data.jobsPassed !== "number" ||
          typeof data.skippedJobs !== "number"
        ) {
          throw new PlatformError("CI_VERIFICATION_MISMATCH", "Release authority CI verification payload is incomplete.", 409);
        }
        return {
          ...(typeof (data as { repository?: unknown }).repository === "string"
            ? { repository: (data as { repository: string }).repository }
            : {}),
          headSha: data.headSha,
          headBranch: data.headBranch,
          workflowPath: data.workflowPath,
          status: data.status,
          conclusion: data.conclusion,
          completedAt: data.completedAt,
          jobsPassed: data.jobsPassed,
          skippedJobs: data.skippedJobs,
          missingJobs: data.missingJobs,
          primaryCiVerified: data.primaryCiVerified,
          verifiedTestsPassed: data.verifiedTestsPassed ?? null,
          artifactsVerified: data.artifactsVerified,
          missingArtifacts: data.missingArtifacts,
          artifactDownloadVerified: data.artifactDownloadVerified,
          artifactDownloadStatus: data.artifactDownloadStatus,
          authMode: data.authMode,
        };
      }

      const errBody = (await res.json().catch(() => null)) as { code?: string; error?: string } | null;
      if (res.status === 409 || errBody?.code === "CI_VERIFICATION_MISMATCH" || errBody?.code === "SOURCE_CONTEXT_MISMATCH") {
        throw new PlatformError(
          "CI_VERIFICATION_MISMATCH",
          String(errBody?.error ?? "CI certification does not match release authority verification."),
          409,
        );
      }
      if (res.status !== 404 && res.status !== 501 && res.status !== 503) {
        throw new PlatformError(
          "CI_VERIFICATION_UNAVAILABLE",
          String(errBody?.error ?? "Release authority CI verification endpoint returned an error."),
          409,
        );
      }
      // If release-authority does not yet expose /ci/verify (404/501) or returns 503,
      // fall through cleanly to public/GitHub-App verified read below without relaxing any CI invariant.
    }
  }

  const githubAuth = await resolveGithubReadAuthorization(env, fetchImpl);
  return fetchGithubCiRun(input.runId, githubAuth.token, input.releaseSha, fetchImpl);
}

export function buildProductionVerificationOptions(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): AcceptanceVerificationOptions {
  return {
    env,
    adapters: {
      verifyCiRun: (input) => verifyCiCertificationRemote(input, { env, fetchImpl }),
      verifyParity: (input) => verifyProductionParityRemote(input, { env, fetchImpl }),
    },
  };
}
