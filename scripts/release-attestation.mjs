import { createPublicKey, verify } from "node:crypto";

const ROLES = ["operator", "finance", "database", "security"];
const EVIDENCE = ["provider", "packing", "driver_store", "physical_pod", "tax_finance", "notification", "media", "database_audit"];
const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,199}$/;
const fail = () => { throw new Error("RELEASE_ATTESTATION_INVALID"); };
const object = value => value !== null && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
function fields(value, expected) {
  if (!object(value) || Object.keys(value).sort().join("|") !== [...expected].sort().join("|")) fail();
}
function canonical(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return fail();
}
export function canonicalBytes(value) { return Buffer.from(canonical(value), "utf8"); }

/** Verify a fixture or independently supplied attestation; this is not release authorization.
 * The caller must obtain trust, deployment and evidence state from independent
 * authorities, atomically consume the issuance ID, and enforce human approval.
 */
export function verifyReleaseAttestation(envelope, trust, context) {
  fields(envelope, ["payload", "approvals"]);
  const p = envelope.payload;
  fields(p, ["version", "repository", "environment", "audience", "commitSha", "treeSha", "ciRunId", "ciEvidenceDigest", "deployments", "scope", "policies", "evidence", "maker", "issuanceId", "issuedAt", "expiresAt"]);
  fields(p.deployments, ["vercel", "railwayWeb", "railwayOperations"]);
  fields(p.evidence, EVIDENCE);
  if (p.version !== 1 || p.repository !== "analyticsmath/KT-Courier" || p.environment !== "production" || p.audience !== "kt-couriers-release" ||
      typeof p.commitSha !== "string" || !SHA.test(p.commitSha) || typeof p.treeSha !== "string" || !SHA.test(p.treeSha) ||
      typeof p.ciRunId !== "string" || !/^\d{1,24}$/.test(p.ciRunId) || typeof p.ciEvidenceDigest !== "string" || !DIGEST.test(p.ciEvidenceDigest) || typeof p.maker !== "string" || !ID.test(p.maker) ||
      typeof p.issuanceId !== "string" || !ID.test(p.issuanceId) || p.issuanceId.length < 16 ||
      !Object.values(p.deployments).every(v => typeof v === "string" && ID.test(v)) ||
      !Array.isArray(p.scope) || p.scope.length === 0 || new Set(p.scope).size !== p.scope.length || !p.scope.every(x => typeof x === "string" && ID.test(x)) ||
      !object(p.policies) || Object.keys(p.policies).length === 0 || !Object.entries(p.policies).every(([k,v]) => ID.test(k) && typeof v === "string" && ID.test(v))) fail();
  for (const entry of Object.values(p.evidence)) {
    fields(entry, ["reference", "digest"]);
    if (typeof entry.reference !== "string" || !ID.test(entry.reference) || typeof entry.digest !== "string" || !DIGEST.test(entry.digest)) fail();
  }
  const issued = Date.parse(p.issuedAt), expires = Date.parse(p.expiresAt), now = context?.now;
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || typeof now !== "number" || !Number.isFinite(now) ||
      new Date(issued).toISOString() !== p.issuedAt || new Date(expires).toISOString() !== p.expiresAt || issued > now || now >= expires || expires <= issued || expires - issued > 900000) fail();
  if (context.commitSha !== p.commitSha || context.treeSha !== p.treeSha || context.ciRunId !== p.ciRunId || context.ciEvidenceDigest !== p.ciEvidenceDigest || context.ciStatus !== "success" ||
      canonical(context.deployments) !== canonical(p.deployments) || canonical(context.evidence) !== canonical(p.evidence) || canonical(context.policies) !== canonical(p.policies) ||
      !Array.isArray(context.requestedScope) || canonical([...context.requestedScope].sort()) !== canonical([...p.scope].sort())) fail();
  if (!Array.isArray(envelope.approvals) || envelope.approvals.length !== ROLES.length || !object(trust)) fail();
  const seenRoles = new Set(), seenPrincipals = new Set(), seenKeys = new Set();
  for (const approval of envelope.approvals) {
    fields(approval, ["role", "principal", "keyId", "signature"]);
    const { role, principal, keyId, signature } = approval;
    if (!ROLES.includes(role) || typeof principal !== "string" || !ID.test(principal) || typeof keyId !== "string" || !ID.test(keyId) || principal === p.maker || seenRoles.has(role) || seenPrincipals.has(principal) || seenKeys.has(keyId)) fail();
    const entry = Object.hasOwn(trust, keyId) ? trust[keyId] : null;
    if (!entry || entry.revoked !== false || entry.principal !== principal || !Array.isArray(entry.roles) || !entry.roles.includes(role) ||
        typeof signature !== "string" || !/^[A-Za-z0-9+/]{86}==$/.test(signature)) fail();
    try {
      const key = entry.publicKey?.type === "public" ? entry.publicKey : createPublicKey(entry.publicKey);
      if (key.asymmetricKeyType !== "ed25519" || !verify(null, canonicalBytes({ payload: p, claim: { role, principal, keyId } }), key, Buffer.from(signature, "base64"))) fail();
    } catch { fail(); }
    seenRoles.add(role); seenPrincipals.add(principal); seenKeys.add(keyId);
  }
  return { status: "ATTESTATION_VERIFIED", issuanceId: p.issuanceId, releaseAuthorized: false };
}
