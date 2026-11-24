import { createHash } from "node:crypto";
import {
  netmaskMatchesPrivateOrLoopback,
  parseHostLiteral,
  resolveAndVerifyPublicAuthorityHost,
  validateTrustBundle,
} from "./release-authority-helpers.mjs";

const MAX_RESPONSE_BYTES = 262_144;
const REQUEST_TIMEOUT_MS = 10_000;

export function isValidSha(value) {
  return typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
}

export function isValidEvidenceReference(value) {
  if (typeof value !== "string") return false;
  if (!/^[A-Za-z0-9][A-Za-z0-9:._-]{0,199}$/.test(value)) return false;
  if (value.includes("..") || value.includes("://")) return false;
  return true;
}

export function validateAuthorityOrigin(rawOrigin, allowedOrigin, options = {}) {
  if (typeof rawOrigin !== "string" || typeof allowedOrigin !== "string" || !rawOrigin.trim() || !allowedOrigin.trim()) {
    return { ok: false, reason: "INDEPENDENT_AUTHORITY_UNAVAILABLE", detail: "Authority origin is not configured." };
  }
  let parsed;
  let parsedAllowed;
  try {
    parsed = new URL(rawOrigin);
    parsedAllowed = new URL(allowedOrigin);
  } catch {
    return { ok: false, reason: "AUTHORITY_ENDPOINT_INVALID", detail: "Malformed authority URL." };
  }

  if (parsed.username || parsed.password || parsedAllowed.username || parsedAllowed.password) {
    return { ok: false, reason: "AUTHORITY_ENDPOINT_INVALID", detail: "Authority URL must not include embedded credentials." };
  }
  if (parsed.search || parsed.hash || parsed.pathname !== "/" || parsedAllowed.search || parsedAllowed.hash || parsedAllowed.pathname !== "/") {
    return { ok: false, reason: "AUTHORITY_ENDPOINT_INVALID", detail: "Authority URL must be a bare origin without path, query, or fragment." };
  }
  if (parsed.origin !== parsedAllowed.origin) {
    return { ok: false, reason: "AUTHORITY_ENDPOINT_INVALID", detail: "Authority origin is not on the configured allowlist." };
  }

  const hostKind = parseHostLiteral(parsed.hostname);
  const isLoopback = hostKind === "loopback";
  if (options.allowLoopbackForTest === true && isLoopback) {
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, reason: "AUTHORITY_ENDPOINT_INVALID", detail: "Unsupported loopback protocol." };
    }
    return { ok: true, origin: parsed.origin, hostname: parsed.hostname };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "AUTHORITY_ENDPOINT_INVALID", detail: "Authority URL must use HTTPS in standard mode." };
  }
  if (netmaskMatchesPrivateOrLoopback(parsed.hostname)) {
    return { ok: false, reason: "AUTHORITY_ENDPOINT_INVALID", detail: "Private, metadata, and loopback authority addresses are prohibited." };
  }
  return { ok: true, origin: parsed.origin, hostname: parsed.hostname };
}

export async function validateAuthorityOriginWithDns(rawOrigin, allowedOrigin, options = {}) {
  const syncCheck = validateAuthorityOrigin(rawOrigin, allowedOrigin, options);
  if (!syncCheck.ok) return syncCheck;

  const dnsCheck = await resolveAndVerifyPublicAuthorityHost(syncCheck.hostname, options);
  if (!dnsCheck.ok) return dnsCheck;
  return { ok: true, origin: syncCheck.origin };
}

export function resolveConfiguredTrust(env, canonicalBytesFn) {
  const rawAnchors = env.RELEASE_AUTHORITY_TRUST_ANCHORS;
  const pinnedDigest = env.RELEASE_AUTHORITY_TRUST_SHA256;

  if (pinnedDigest !== undefined && pinnedDigest !== "" && !/^[a-f0-9]{64}$/.test(pinnedDigest)) {
    return { ok: false, reason: "TRUST_ANCHOR_INTEGRITY_MISMATCH", detail: "Pinned trust SHA-256 format is invalid." };
  }

  if (!rawAnchors || !String(rawAnchors).trim()) {
    if (pinnedDigest && /^[a-f0-9]{64}$/.test(pinnedDigest)) {
      return { ok: true, trust: null, fetchRemoteTrustWithPinnedSha256: pinnedDigest };
    }
    return { ok: false, reason: "INDEPENDENT_TRUST_UNCONFIGURED", detail: "No independent trust anchors or pinned trust digest are configured." };
  }

  let parsed;
  try {
    parsed = JSON.parse(rawAnchors);
  } catch {
    return { ok: false, reason: "TRUST_ANCHOR_INTEGRITY_MISMATCH", detail: "Trust anchor configuration is malformed JSON." };
  }

  const validated = validateTrustBundle(parsed);
  if (!validated.ok) {
    return { ok: false, reason: "TRUST_ANCHOR_INTEGRITY_MISMATCH", detail: validated.detail };
  }

  if (pinnedDigest) {
    const actualDigest = createHash("sha256").update(canonicalBytesFn(parsed)).digest("hex");
    if (actualDigest !== pinnedDigest) {
      return { ok: false, reason: "TRUST_ANCHOR_INTEGRITY_MISMATCH", detail: "Configured trust anchors do not match pinned SHA-256 digest." };
    }
  }

  return { ok: true, trust: validated.trust, fetchRemoteTrustWithPinnedSha256: null };
}

async function readBoundedJsonResponse(response) {
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) {
    throw Object.assign(new Error("Authority response exceeded bounded payload size."), { code: "AUTHORITY_RESPONSE_INVALID" });
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw Object.assign(new Error("Authority response was not valid JSON."), { code: "AUTHORITY_RESPONSE_INVALID" });
  }
}

export function createHttpReleaseAuthorityAdapter({
  origin,
  bearerToken,
  fetchImpl = globalThis.fetch,
}) {
  if (typeof bearerToken !== "string" || bearerToken.trim().length < 16) {
    throw Object.assign(new Error("Missing independent authority credential."), { code: "INDEPENDENT_AUTHORITY_UNAVAILABLE" });
  }

  async function requestJson(routePath, init = {}) {
    if (!routePath.startsWith("/v1/release-authority/")) {
      throw Object.assign(new Error("Disallowed authority route."), { code: "AUTHORITY_ENDPOINT_INVALID" });
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;
    try {
      response = await fetchImpl(`${origin}${routePath}`, {
        ...init,
        redirect: "error",
        signal: controller.signal,
        headers: {
          accept: "application/json",
          authorization: `Bearer ${bearerToken}`,
          ...(init.body ? { "content-type": "application/json" } : {}),
        },
      });
    } catch (error) {
      throw Object.assign(new Error("Independent authority request failed."), {
        code: "AUTHORITY_UNREACHABLE",
        cause: error instanceof Error ? error.name : "NETWORK_ERROR",
      });
    } finally {
      clearTimeout(timer);
    }

    const body = await readBoundedJsonResponse(response);
    return { status: response.status, body };
  }

  return {
    async getTrustBundle() {
      const res = await requestJson("/v1/release-authority/trust", { method: "GET" });
      if (res.status === 401 || res.status === 403) {
        throw Object.assign(new Error("Authority denied trust fetch."), { code: "AUTHORITY_UNAUTHORIZED" });
      }
      if (res.status !== 200 || !res.body || typeof res.body.trust !== "object") {
        throw Object.assign(new Error("Authority returned invalid trust bundle."), { code: "AUTHORITY_UNREACHABLE" });
      }
      return res.body.trust;
    },

    async getSignedEvidenceEnvelope({ releaseSha, evidenceReference }) {
      const route = `/v1/release-authority/releases/${encodeURIComponent(releaseSha)}/evidence/${encodeURIComponent(evidenceReference)}`;
      const res = await requestJson(route, { method: "GET" });
      if (res.status === 401 || res.status === 403) {
        throw Object.assign(new Error("Authority rejected evidence request credentials."), { code: "AUTHORITY_UNAUTHORIZED" });
      }
      if (res.status === 410) {
        throw Object.assign(new Error("Evidence reference has been revoked."), { code: "EVIDENCE_REVOKED" });
      }
      if (res.status !== 200 || !res.body || typeof res.body.envelope !== "object") {
        throw Object.assign(new Error(`Authority could not supply signed evidence (${res.status}).`), {
          code: res.status === 404 ? "EVIDENCE_NOT_FOUND" : "AUTHORITY_UNREACHABLE",
        });
      }
      if (res.body.evidenceReference && res.body.evidenceReference !== evidenceReference) {
        throw Object.assign(new Error("Authority returned evidence for a different reference."), { code: "SOURCE_CONTEXT_MISMATCH" });
      }
      return res.body.envelope;
    },

    async getVerifiedReleaseContext({ releaseSha, treeSha, evidenceReference }) {
      const query = new URLSearchParams({ treeSha: String(treeSha ?? "") });
      if (evidenceReference) {
        query.set("evidenceReference", String(evidenceReference));
      }
      const route = `/v1/release-authority/releases/${encodeURIComponent(releaseSha)}/context?${query.toString()}`;
      const res = await requestJson(route, { method: "GET" });
      if (res.status === 401 || res.status === 403) {
        throw Object.assign(new Error("Authority rejected context credentials."), { code: "AUTHORITY_UNAUTHORIZED" });
      }
      if (res.status !== 200 || !res.body || typeof res.body.context !== "object") {
        throw Object.assign(new Error(`Authority could not supply verified context (${res.status}).`), { code: "AUTHORITY_UNREACHABLE" });
      }
      return res.body.context;
    },

    async getRevocationStatus({ releaseSha, evidenceReference, issuanceId }) {
      const route = `/v1/release-authority/revocations?releaseSha=${encodeURIComponent(releaseSha)}&evidenceReference=${encodeURIComponent(evidenceReference)}&issuanceId=${encodeURIComponent(issuanceId)}`;
      const res = await requestJson(route, { method: "GET" });
      if (res.status === 401 || res.status === 403) {
        throw Object.assign(new Error("Authority rejected revocation lookup."), { code: "AUTHORITY_UNAUTHORIZED" });
      }
      if (res.status !== 200 || !res.body || typeof res.body !== "object") {
        throw Object.assign(new Error("Authority revocation lookup unavailable."), { code: "AUTHORITY_UNREACHABLE" });
      }
      return {
        revokedKeyIds: Array.isArray(res.body.revokedKeyIds) ? res.body.revokedKeyIds.map(String) : [],
        revokedIssuanceIds: Array.isArray(res.body.revokedIssuanceIds) ? res.body.revokedIssuanceIds.map(String) : [],
        revokedEvidenceReferences: Array.isArray(res.body.revokedEvidenceReferences) ? res.body.revokedEvidenceReferences.map(String) : [],
      };
    },

    async claimSingleUseIssuance(claimPayload) {
      const res = await requestJson("/v1/release-authority/issuances/claim", {
        method: "POST",
        body: JSON.stringify(claimPayload),
      });
      if (res.status === 409) {
        const code = res.body?.code === "ISSUANCE_CONCURRENT" ? "CONCURRENT_AUTHORIZATION_CONFLICT" : "ISSUANCE_REPLAYED";
        throw Object.assign(new Error("Single-use issuance claim rejected."), { code });
      }
      if (res.status === 403 || res.status === 410) {
        if (res.body?.code === "REVOKED" || res.body?.code === "ISSUANCE_REVOKED" || res.body?.code === "EVIDENCE_REVOKED") {
          throw Object.assign(new Error("Issuance revoked at claim."), { code: "EVIDENCE_REVOKED" });
        }
        throw Object.assign(new Error("Authority rejected issuance claim credentials."), { code: "AUTHORITY_UNAUTHORIZED" });
      }
      if ((res.status !== 200 && res.status !== 201) || res.body?.claimed !== true || res.body?.issuanceId !== claimPayload.issuanceId || typeof res.body?.receiptId !== "string" || res.body.receiptId.length < 8) {
        throw Object.assign(new Error("Atomic issuance receipt could not be persisted."), { code: "ISSUANCE_PERSISTENCE_FAILED" });
      }
      return {
        claimed: true,
        issuanceId: res.body.issuanceId,
        receiptId: res.body.receiptId,
        claimedAt: typeof res.body.claimedAt === "string" ? res.body.claimedAt : new Date().toISOString(),
      };
    },
  };
}
