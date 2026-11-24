import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import {
  AUDIENCE,
  ENVIRONMENT,
  EVIDENCE_KEYS,
  EXPECTED_EXCLUDED_CAPABILITIES,
  REPOSITORY,
  SAFE_ID_PATTERN,
  VALID_ROLES,
  canonicalBytes,
  sha256Hex,
  verifySignedEnvelope,
} from "./security.mjs";

export function generateRoleKeypair({ role, principal, keyId }) {
  if (!VALID_ROLES.includes(role)) {
    throw new Error(`Unsupported role ${role}. Expected one of: ${VALID_ROLES.join(", ")}`);
  }
  if (!principal || !SAFE_ID_PATTERN.test(principal)) {
    throw new Error("Valid principal identifier required.");
  }
  const resolvedKeyId = keyId || `key-${role}-${principal}`;
  if (!SAFE_ID_PATTERN.test(resolvedKeyId)) {
    throw new Error("Valid keyId identifier required.");
  }
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    role,
    principal,
    keyId: resolvedKeyId,
    publicKeyPem: publicKey.export({ format: "pem", type: "spki" }).toString(),
    privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
  };
}

export function buildTrustBundle(entries) {
  if (!Array.isArray(entries) || entries.length < VALID_ROLES.length) {
    throw new Error("At least four role-separated public key entries are required.");
  }
  const trust = {};
  for (const entry of entries) {
    if (!entry?.keyId || !entry?.principal || !entry?.publicKeyPem || !VALID_ROLES.includes(entry.role)) {
      throw new Error("Malformed role trust entry.");
    }
    trust[entry.keyId] = {
      roles: [entry.role],
      principal: entry.principal,
      publicKey: entry.publicKeyPem,
      revoked: entry.revoked === true,
    };
  }
  const trustSha256 = sha256Hex(canonicalBytes(trust));
  return { trust, trustSha256 };
}

export function buildUnsignedPayloadV2({
  verifiedContext,
  maker,
  issuanceId,
  issuedAt,
  expiresAt,
}) {
  if (!verifiedContext || typeof verifiedContext !== "object") {
    throw new Error("Verified release context required to build payload.");
  }
  if (!maker || !SAFE_ID_PATTERN.test(maker)) {
    throw new Error("Valid maker identifier required.");
  }
  const resolvedIssuedAt = issuedAt ? new Date(issuedAt).toISOString() : new Date().toISOString();
  const resolvedExpiresAt = expiresAt
    ? new Date(expiresAt).toISOString()
    : new Date(Date.parse(resolvedIssuedAt) + 12 * 60 * 1000).toISOString();

  const resolvedIssuanceId = issuanceId || `issuance-${resolvedIssuedAt.slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 12)}`;
  const evidence = Object.fromEntries(
    EVIDENCE_KEYS.map((key) => [
      key,
      {
        reference: verifiedContext.evidence[key].reference,
        digest: verifiedContext.evidence[key].digest,
      },
    ]),
  );

  return {
    version: 2,
    repository: REPOSITORY,
    environment: ENVIRONMENT,
    audience: AUDIENCE,
    commitSha: verifiedContext.commitSha,
    treeSha: verifiedContext.treeSha,
    ciRunId: String(verifiedContext.certificationRun.id),
    ciEvidenceDigest: verifiedContext.certificationRun.evidenceDigest,
    deployments: {
      vercel: verifiedContext.deployments.vercel.id,
      railwayWeb: verifiedContext.deployments.railwayWeb.id,
      railwayOperations: verifiedContext.deployments.railwayOperations.id,
      railwayQuery: verifiedContext.deployments.railwayQuery.id,
    },
    scope: [...verifiedContext.scope.mandatoryChecks],
    excludedCapabilities: [...(verifiedContext.scope.excludedCapabilities ?? EXPECTED_EXCLUDED_CAPABILITIES)],
    policies: { ...verifiedContext.policies },
    evidence,
    maker,
    issuanceId: resolvedIssuanceId,
    issuedAt: resolvedIssuedAt,
    expiresAt: resolvedExpiresAt,
  };
}

export function signRoleApproval({ payload, role, principal, keyId, privateKeyPem }) {
  if (!VALID_ROLES.includes(role)) {
    throw new Error(`Invalid signing role: ${role}`);
  }
  if (!privateKeyPem || !String(privateKeyPem).includes("BEGIN PRIVATE KEY")) {
    throw new Error("Ed25519 PKCS8 PEM private key is required.");
  }
  const claim = { role, principal, keyId };
  const signature = sign(null, canonicalBytes({ payload, claim }), privateKeyPem).toString("base64");
  return { role, principal, keyId, signature };
}

export function assembleSignedEnvelope({ payload, approvals, trust, nowMs }) {
  const envelope = { payload, approvals };
  verifySignedEnvelope(envelope, trust, {
    enforceTimeWindow: typeof nowMs === "number",
    nowMs,
  });
  return envelope;
}
