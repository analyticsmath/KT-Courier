import { createHash, createPublicKey, timingSafeEqual, verify } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const REPOSITORY = "analyticsmath/KT-Courier";
export const ENVIRONMENT = "production";
export const AUDIENCE = "kt-couriers-release";
export const VALID_ROLES = Object.freeze(["operator", "finance", "database", "security"]);
export const EVIDENCE_KEYS = Object.freeze([
  "provider",
  "packing",
  "driver_store",
  "physical_pod",
  "tax_finance",
  "notification",
  "media",
  "database_audit",
]);
export const REQUIRED_LAUNCH_SCOPE = Object.freeze([
  "audit",
  "checkout",
  "cod",
  "commissions",
  "notifications",
  "retention",
  "store_operational_policy",
]);
export const EXPECTED_EXCLUDED_CAPABILITIES = Object.freeze(["ADVERTISING", "PROMOTERS", "SUBSCRIPTIONS"]);
export const REQUIRED_DEPLOYMENTS = Object.freeze([
  "vercel",
  "railwayWeb",
  "railwayOperations",
  "railwayQuery",
]);

export const SHA_PATTERN = /^[a-f0-9]{40}$/;
export const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
export const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,199}$/;

export function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}

export function canonicalString(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
  if (Array.isArray(value)) return `[${value.map(canonicalString).join(",")}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalString(value[key])}`)
      .join(",")}}`;
  }
  throw new Error("RELEASE_AUTHORITY_CANONICAL_ERROR");
}

export function canonicalBytes(value) {
  return Buffer.from(canonicalString(value), "utf8");
}

export function timingSafeTokenMatch(presented, expected) {
  if (typeof presented !== "string" || typeof expected !== "string" || expected.trim().length < 16) {
    return false;
  }
  const digestPresented = createHash("sha256").update(presented).digest();
  const digestExpected = createHash("sha256").update(expected).digest();
  return timingSafeEqual(digestPresented, digestExpected);
}

export function extractBearerToken(authorizationHeader) {
  if (typeof authorizationHeader !== "string") return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorizationHeader.trim());
  return match ? match[1] : null;
}

export function isPrivateOrReservedIp(hostname) {
  const host = String(hostname ?? "").replace(/^\[|\]$/g, "").toLowerCase();
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  const ipVersion = isIP(host);
  if (ipVersion === 4) {
    const [a, b] = host.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (ipVersion === 6) {
    if (host === "::" || host === "::1") return true;
    if (host.startsWith("::ffff:")) return isPrivateOrReservedIp(host.slice(7));
    if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("ff")) return true;
    return false;
  }
  return false;
}

export async function assertSafeTargetUrl(rawUrl, options = {}) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw Object.assign(new Error("Invalid remote endpoint URL."), { code: "UNSAFE_REMOTE_URL", status: 400 });
  }
  if (parsed.username || parsed.password || parsed.hash) {
    throw Object.assign(new Error("Remote URL contains forbidden credentials or fragment."), { code: "UNSAFE_REMOTE_URL", status: 400 });
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const isLoopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  if (options.allowLoopbackForTest === true && isLoopback) {
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw Object.assign(new Error("Loopback endpoint requires HTTP or HTTPS."), { code: "UNSAFE_REMOTE_URL", status: 400 });
    }
    return parsed;
  }
  if (parsed.protocol !== "https:") {
    throw Object.assign(new Error("Remote endpoint must use HTTPS."), { code: "UNSAFE_REMOTE_URL", status: 400 });
  }
  if (options.allowedHosts && options.allowedHosts.size > 0 && !options.allowedHosts.has(hostname)) {
    throw Object.assign(new Error("Remote host is not in allowlist."), { code: "UNSAFE_REMOTE_URL", status: 400 });
  }
  if (isIP(hostname) !== 0) {
    if (isPrivateOrReservedIp(hostname)) {
      throw Object.assign(new Error("Private or loopback IP forbidden."), { code: "UNSAFE_REMOTE_URL", status: 400 });
    }
    return parsed;
  }
  const resolveDns = options.resolveDns ?? lookup;
  const raw = await resolveDns(hostname, { all: true }).catch(() => {
    throw Object.assign(new Error("Unable to resolve remote endpoint host."), { code: "UPSTREAM_UNREACHABLE", status: 502 });
  });
  const records = Array.isArray(raw) ? raw : [raw];
  if (records.length === 0 || records.some((entry) => !entry?.address || isPrivateOrReservedIp(entry.address))) {
    throw Object.assign(new Error("Remote endpoint resolved to private or loopback IP."), { code: "UNSAFE_REMOTE_URL", status: 400 });
  }
  return parsed;
}

function assertExactKeys(value, expected) {
  if (!isPlainObject(value) || Object.keys(value).sort().join("|") !== [...expected].sort().join("|")) {
    throw Object.assign(new Error("ATTESTATION_INVALID"), { code: "ATTESTATION_INVALID", status: 400 });
  }
}

export function verifySignedEnvelope(envelope, trust, options = {}) {
  assertExactKeys(envelope, ["payload", "approvals"]);
  const p = envelope.payload;
  assertExactKeys(p, [
    "version",
    "repository",
    "environment",
    "audience",
    "commitSha",
    "treeSha",
    "ciRunId",
    "ciEvidenceDigest",
    "deployments",
    "scope",
    "excludedCapabilities",
    "policies",
    "evidence",
    "maker",
    "issuanceId",
    "issuedAt",
    "expiresAt",
  ]);
  assertExactKeys(p.deployments, REQUIRED_DEPLOYMENTS);
  assertExactKeys(p.evidence, EVIDENCE_KEYS);

  if (
    p.version !== 2 ||
    p.repository !== REPOSITORY ||
    p.environment !== ENVIRONMENT ||
    p.audience !== AUDIENCE ||
    typeof p.commitSha !== "string" ||
    !SHA_PATTERN.test(p.commitSha) ||
    typeof p.treeSha !== "string" ||
    !SHA_PATTERN.test(p.treeSha) ||
    typeof p.ciRunId !== "string" ||
    !/^\d{1,24}$/.test(p.ciRunId) ||
    typeof p.ciEvidenceDigest !== "string" ||
    !DIGEST_PATTERN.test(p.ciEvidenceDigest) ||
    typeof p.maker !== "string" ||
    !SAFE_ID_PATTERN.test(p.maker) ||
    typeof p.issuanceId !== "string" ||
    !SAFE_ID_PATTERN.test(p.issuanceId) ||
    p.issuanceId.length < 16 ||
    !Object.values(p.deployments).every((v) => typeof v === "string" && SAFE_ID_PATTERN.test(v)) ||
    !Array.isArray(p.scope) ||
    p.scope.length === 0 ||
    new Set(p.scope).size !== p.scope.length ||
    !p.scope.every((x) => typeof x === "string" && SAFE_ID_PATTERN.test(x)) ||
    !Array.isArray(p.excludedCapabilities) ||
    canonicalString([...p.excludedCapabilities].sort()) !== canonicalString([...EXPECTED_EXCLUDED_CAPABILITIES]) ||
    !isPlainObject(p.policies) ||
    Object.keys(p.policies).length === 0 ||
    !Object.entries(p.policies).every(([k, v]) => SAFE_ID_PATTERN.test(k) && typeof v === "string" && SAFE_ID_PATTERN.test(v))
  ) {
    throw Object.assign(new Error("Invalid attestation payload shape."), { code: "ATTESTATION_INVALID", status: 400 });
  }

  for (const entry of Object.values(p.evidence)) {
    assertExactKeys(entry, ["reference", "digest"]);
    if (typeof entry.reference !== "string" || !SAFE_ID_PATTERN.test(entry.reference) || typeof entry.digest !== "string" || !DIGEST_PATTERN.test(entry.digest)) {
      throw Object.assign(new Error("Invalid domain evidence digest entry."), { code: "ATTESTATION_INVALID", status: 400 });
    }
  }

  const issuedMs = Date.parse(p.issuedAt);
  const expiresMs = Date.parse(p.expiresAt);
  if (
    !Number.isFinite(issuedMs) ||
    !Number.isFinite(expiresMs) ||
    new Date(issuedMs).toISOString() !== p.issuedAt ||
    new Date(expiresMs).toISOString() !== p.expiresAt ||
    expiresMs <= issuedMs ||
    expiresMs - issuedMs > 900_000
  ) {
    throw Object.assign(new Error("Attestation timestamps or 15-minute validity window invalid."), { code: "ATTESTATION_INVALID", status: 400 });
  }

  if (options.enforceTimeWindow !== false) {
    const nowMs = typeof options.nowMs === "number" ? options.nowMs : Date.now();
    if (issuedMs > nowMs || nowMs >= expiresMs) {
      throw Object.assign(new Error("Attestation is expired or not yet active."), { code: "ATTESTATION_EXPIRED", status: 409 });
    }
  }

  if (!Array.isArray(envelope.approvals) || envelope.approvals.length !== VALID_ROLES.length || !isPlainObject(trust)) {
    throw Object.assign(new Error("Four role approvals and valid trust bundle required."), { code: "ATTESTATION_INVALID", status: 400 });
  }

  const seenRoles = new Set();
  const seenPrincipals = new Set();
  const seenKeys = new Set();

  for (const approval of envelope.approvals) {
    assertExactKeys(approval, ["role", "principal", "keyId", "signature"]);
    const { role, principal, keyId, signature } = approval;
    if (
      !VALID_ROLES.includes(role) ||
      typeof principal !== "string" ||
      !SAFE_ID_PATTERN.test(principal) ||
      typeof keyId !== "string" ||
      !SAFE_ID_PATTERN.test(keyId) ||
      principal === p.maker ||
      seenRoles.has(role) ||
      seenPrincipals.has(principal) ||
      seenKeys.has(keyId)
    ) {
      throw Object.assign(new Error("Role separation, principal separation, or uniqueness failed."), { code: "ATTESTATION_INVALID", status: 400 });
    }
    const trustEntry = Object.hasOwn(trust, keyId) ? trust[keyId] : null;
    if (
      !trustEntry ||
      trustEntry.revoked === true ||
      trustEntry.principal !== principal ||
      !Array.isArray(trustEntry.roles) ||
      !trustEntry.roles.includes(role) ||
      typeof signature !== "string" ||
      !/^[A-Za-z0-9+/]{86}==$/.test(signature)
    ) {
      throw Object.assign(new Error("Trust entry invalid, revoked, or signature malformed."), { code: "ATTESTATION_INVALID", status: 400 });
    }
    try {
      const publicKey = trustEntry.publicKey?.type === "public" ? trustEntry.publicKey : createPublicKey(trustEntry.publicKey);
      const ok =
        publicKey.asymmetricKeyType === "ed25519" &&
        verify(null, canonicalBytes({ payload: p, claim: { role, principal, keyId } }), publicKey, Buffer.from(signature, "base64"));
      if (!ok) {
        throw Object.assign(new Error("Ed25519 approval signature verification failed."), { code: "ATTESTATION_INVALID", status: 400 });
      }
    } catch (error) {
      if (error && error.code === "ATTESTATION_INVALID") throw error;
      throw Object.assign(new Error("Unable to verify Ed25519 public key."), { code: "ATTESTATION_INVALID", status: 400 });
    }
    seenRoles.add(role);
    seenPrincipals.add(principal);
    seenKeys.add(keyId);
  }

  return p;
}
