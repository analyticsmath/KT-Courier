import { createHash, createSign } from "node:crypto";

export type GithubAuthResolution = Readonly<{
  mode: "STATIC_TOKEN" | "GITHUB_APP" | "PUBLIC_ANONYMOUS";
  token: string | null;
}>;

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function createGithubAppJwt(
  appId: string,
  privateKeyPem: string,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
): string {
  const normalizedPem = privateKeyPem.replace(/\\n/g, "\n").trim();
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iat: nowEpochSeconds - 60,
      exp: nowEpochSeconds + 540,
      iss: appId.trim(),
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256").update(unsigned).end().sign(normalizedPem);
  return `${unsigned}.${base64UrlEncode(signature)}`;
}

/**
 * Resolves GitHub read authorization without requiring a fine-grained PAT:
 * 1) Explicit GITHUB_RELEASE_READ_TOKEN if present (legacy / CI test harnesses)
 * 2) Scoped GitHub App installation token (GITHUB_APP_ID + GITHUB_APP_PRIVATE_KEY + GITHUB_APP_INSTALLATION_ID)
 * 3) Unauthenticated public REST access for public repositories such as analyticsmath/KT-Courier
 */
export async function resolveGithubReadAuthorization(
  env: Readonly<Record<string, string | undefined>> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<GithubAuthResolution> {
  const staticToken = (env.GITHUB_RELEASE_READ_TOKEN ?? "").trim();
  if (staticToken) {
    return { mode: "STATIC_TOKEN", token: staticToken };
  }

  const appId = (env.GITHUB_APP_ID ?? "").trim();
  const privateKey = (env.GITHUB_APP_PRIVATE_KEY ?? "").trim();
  const installationId = (env.GITHUB_APP_INSTALLATION_ID ?? "").trim();
  if (appId && privateKey && installationId) {
    const jwt = createGithubAppJwt(appId, privateKey);
    const res = await fetchImpl(
      `https://api.github.com/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
      {
        method: "POST",
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${jwt}`,
          "user-agent": "KT-Courier-Acceptance-Verifier",
          "x-github-api-version": "2022-11-28",
        },
        body: JSON.stringify({
          permissions: {
            actions: "read",
            contents: "read",
            metadata: "read",
          },
        }),
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (res.ok) {
      const json = (await res.json()) as { token?: string };
      if (typeof json.token === "string" && json.token.trim()) {
        return { mode: "GITHUB_APP", token: json.token.trim() };
      }
    }
  }

  return { mode: "PUBLIC_ANONYMOUS", token: null };
}

export function buildGithubApiHeaders(
  token: string | null | undefined,
): Record<string, string> {
  const clean = (token ?? "").trim();
  return {
    accept: "application/vnd.github+json",
    "user-agent": "KT-Courier-Acceptance-Verifier",
    "x-github-api-version": "2022-11-28",
    ...(clean ? { authorization: `Bearer ${clean}` } : {}),
  };
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
