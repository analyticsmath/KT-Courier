import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { PlatformError } from "@/lib/client-platform/contracts";
import { reviewedProtectedRowAudit } from "@/scripts/audit-reviewed-production";
import type { AcceptanceVerificationOptions, VerifiedParityInfo } from "./evidence";

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
    auditRunner?: typeof reviewedProtectedRowAudit;
  }> = {},
): Promise<VerifiedParityInfo> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;

  // Optional external independent parity verifier (e.g., release-authority service context endpoint)
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
      throw new PlatformError("PARITY_VERIFICATION_UNAVAILABLE", "External deployment parity verifier returned an error.", 409);
    }
    const data = (await res.json()) as Partial<VerifiedParityInfo>;
    if (
      !data ||
      typeof data.vercelSha !== "string" ||
      typeof data.webSha !== "string" ||
      typeof data.operationsSha !== "string" ||
      typeof data.querySha !== "string" ||
      typeof data.auditDigest !== "string"
    ) {
      throw new PlatformError("PARITY_VERIFICATION_MISMATCH", "External deployment parity response is incomplete.", 409);
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
      auditReleaseSha: String(data.auditReleaseSha ?? ""),
      protectedDataUnchanged: data.protectedDataUnchanged === true,
      leastPrivilege: data.leastPrivilege === true,
      auditDigest: data.auditDigest,
    };
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

  const [vercel, railway, readyResponse, audit] = await Promise.all([
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
    (options.auditRunner ?? reviewedProtectedRowAudit)(),
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

  const leastPrivilege = Boolean((audit.database as { leastPrivilegeVerified?: boolean } | undefined)?.leastPrivilegeVerified);
  const protectedUnchanged = Boolean(audit.readOnly) && audit.migrationCount !== null;
  const auditDigest = typeof audit.receiptDigest === "string"
    ? audit.receiptDigest
    : createHash("sha256").update(JSON.stringify(audit)).digest("hex");

  if (
    /^[a-f0-9]{64}$/.test(input.protectedDataAuditReference) &&
    input.protectedDataAuditReference !== auditDigest
  ) {
    throw new PlatformError("PARITY_VERIFICATION_MISMATCH", "Protected-row audit reference digest does not match.", 409);
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
    auditReleaseSha: audit.releaseSha ?? input.releaseSha,
    protectedDataUnchanged: protectedUnchanged,
    leastPrivilege,
    auditDigest,
  };
}

export function buildProductionVerificationOptions(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): AcceptanceVerificationOptions {
  return {
    env,
    adapters: {
      verifyParity: (input) => verifyProductionParityRemote(input, { env, fetchImpl }),
    },
  };
}
