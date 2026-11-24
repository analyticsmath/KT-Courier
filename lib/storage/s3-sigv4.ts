import { createHash, createHmac } from "node:crypto";
import { isActualProductionInstance } from "@/lib/promotions/production-lock";

export interface S3CompatibleConfig {
  readonly endpoint: URL;
  readonly bucket: string;
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

export class S3SigV4Error extends Error {
  constructor(
    public readonly code: "S3_CONFIG_INVALID" | "S3_REQUEST_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "S3SigV4Error";
  }
}

export type S3EnvSource = Readonly<Record<string, string | undefined>>;

export function parseS3ConfigFromEnv(
  prefix: "PRIVATE_MEDIA_S3" | "REPORT_ARTIFACT_S3",
  options: Readonly<{ defaultRegion?: string; requireHttpsInProd?: boolean; env?: S3EnvSource }> = {},
): S3CompatibleConfig | null {
  const env = options.env ?? process.env;
  const endpointRaw = env[`${prefix}_ENDPOINT`]?.trim();
  const bucket = env[`${prefix}_BUCKET`]?.trim();
  const region = env[`${prefix}_REGION`]?.trim() || options.defaultRegion || "";
  const accessKeyId = env[`${prefix}_ACCESS_KEY_ID`]?.trim();
  const secretAccessKey = env[`${prefix}_SECRET_ACCESS_KEY`]?.trim();
  if (!endpointRaw || !bucket || !region || !accessKeyId || !secretAccessKey) {
    return null;
  }
  let endpoint: URL;
  try {
    endpoint = new URL(endpointRaw);
  } catch {
    return null;
  }
  const prod =
    env.VERCEL_ENV === "production" ||
    env.RAILWAY_ENVIRONMENT_NAME === "production" ||
    isActualProductionInstance(env);
  const requireHttps = options.requireHttpsInProd !== false && prod;
  if (requireHttps && endpoint.protocol !== "https:") {
    return null;
  }
  if (!requireHttps && endpoint.protocol !== "https:" && endpoint.protocol !== "http:") {
    return null;
  }
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    return null;
  }
  return Object.freeze({ endpoint, bucket, region, accessKeyId, secretAccessKey });
}

function hmacSha256(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function formatAwsTimestamps(now: Date): Readonly<{ stamp: string; timestamp: string }> {
  const timestamp = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { stamp: timestamp.slice(0, 8), timestamp };
}

export async function signedS3Fetch(
  config: S3CompatibleConfig,
  input: Readonly<{
    method: "GET" | "PUT" | "DELETE" | "HEAD";
    key: string;
    body?: Uint8Array;
    contentType?: string;
    timeoutMs?: number;
  }>,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const encodedKey = input.key.split("/").map(encodeURIComponent).join("/");
  const base = config.endpoint.pathname.replace(/\/$/, "");
  const canonicalUri = `${base}/${encodeURIComponent(config.bucket)}/${encodedKey}`.replace(/\/+/g, "/");
  const url = new URL(config.endpoint.toString());
  url.pathname = canonicalUri;

  const payloadHash = sha256Hex(input.body ?? new Uint8Array());
  const { stamp, timestamp } = formatAwsTimestamps(new Date());
  const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${timestamp}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const credentialScope = `${stamp}/${config.region}/s3/aws4_request`;
  const canonicalRequest = `${input.method}\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const stringToSign = `AWS4-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${sha256Hex(canonicalRequest)}`;
  const signingKey = hmacSha256(
    hmacSha256(
      hmacSha256(hmacSha256(`AWS4${config.secretAccessKey}`, stamp), config.region),
      "s3",
    ),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");
  const headers: Record<string, string> = {
    authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": timestamp,
  };
  if (input.contentType) {
    headers["content-type"] = input.contentType;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: input.method,
        headers,
        body: input.body ? Buffer.from(input.body) : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(input.timeoutMs ?? 10_000),
      });
      if (response.status < 500 || attempt === 2) {
        return response;
      }
    } catch {
      if (attempt === 2) {
        throw new S3SigV4Error("S3_REQUEST_FAILED", "Compatible S3 object storage request failed.");
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
  }

  throw new S3SigV4Error("S3_REQUEST_FAILED", "Compatible S3 object storage is unavailable.");
}
