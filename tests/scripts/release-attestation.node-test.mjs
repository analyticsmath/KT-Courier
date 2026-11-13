import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { canonicalBytes, verifyReleaseAttestation } from "../../scripts/release-attestation.mjs";

const roles = ["operator", "finance", "database", "security"];
const evidenceKinds = ["provider", "packing", "driver_store", "physical_pod", "tax_finance", "notification", "media", "database_audit"];
function fixture() {
  const now = Date.parse("2026-11-13T12:00:00.000Z");
  const keys = Object.fromEntries(roles.map(role => [role, generateKeyPairSync("ed25519")]));
  const trust = Object.fromEntries(roles.map(role => [`key-${role}`, { publicKey: keys[role].publicKey, principal: `reviewer-${role}`, roles: [role], revoked: false }]));
  const evidence = Object.fromEntries(evidenceKinds.map((kind, i) => [kind, { reference: `evidence-${kind}`, digest: String(i + 1).repeat(64) }]));
  const payload = {
    version: 1, repository: "analyticsmath/KT-Courier", environment: "production", audience: "kt-couriers-release",
    commitSha: "a".repeat(40), treeSha: "b".repeat(40), ciRunId: "12345", ciEvidenceDigest: "c".repeat(64),
    deployments: { vercel: "vercel-1", railwayWeb: "web-1", railwayOperations: "ops-1" },
    scope: ["deployment"], policies: { pricing: "v1" }, evidence,
    maker: "initiator", issuanceId: "release-1234567890", issuedAt: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 300000).toISOString(),
  };
  const approvals = roles.map(role => {
    const claim = { role, principal: `reviewer-${role}`, keyId: `key-${role}` };
    return { ...claim, signature: sign(null, canonicalBytes({ payload, claim }), keys[role].privateKey).toString("base64") };
  });
  return { envelope: { payload, approvals }, trust, context: { now, commitSha: payload.commitSha, treeSha: payload.treeSha, ciRunId: payload.ciRunId, ciEvidenceDigest: payload.ciEvidenceDigest, ciStatus: "success", deployments: payload.deployments, requestedScope: ["deployment"], policies: payload.policies, evidence } };
}
test("verifies independently signed, exact-scope fixture without authorizing release", () => {
  const f = fixture();
  assert.deepEqual(verifyReleaseAttestation(f.envelope, f.trust, f.context), { status: "ATTESTATION_VERIFIED", issuanceId: f.envelope.payload.issuanceId, releaseAuthorized: false });
});
test("rejects tampering, missing, revoked and untrusted signatures", () => {
  for (const mutate of [f => { f.envelope.payload.commitSha = "c".repeat(40); }, f => { f.envelope.approvals.pop(); }, f => { f.envelope.approvals[0].signature = Buffer.alloc(64).toString("base64"); }, f => { f.trust["key-operator"].revoked = true; }, f => { delete f.trust["key-finance"]; }, f => { f.trust["key-security"].roles = ["operator"]; }]) {
    const f = fixture(); mutate(f); assert.throws(() => verifyReleaseAttestation(f.envelope, f.trust, f.context));
  }
});
test("rejects stale, wrong-environment, mismatched deployments, evidence and scope", () => {
  for (const mutate of [f => { f.context.now += 600000; }, f => { f.envelope.payload.environment = "test"; }, f => { f.context.commitSha = "d".repeat(40); }, f => { f.context.treeSha = "d".repeat(40); }, f => { f.context.ciRunId = "999"; }, f => { f.context.ciEvidenceDigest = "e".repeat(64); }, f => { f.context.ciStatus = "failure"; }, f => { f.context.deployments = { ...f.context.deployments, railwayWeb: "other" }; }, f => { f.context.requestedScope = ["payout"]; }, f => { f.context.policies = { pricing: "v2" }; }, f => { f.context.evidence = { ...f.context.evidence, provider: { reference: "other", digest: "f".repeat(64) } }; }]) {
    const f = fixture(); mutate(f); assert.throws(() => verifyReleaseAttestation(f.envelope, f.trust, f.context));
  }
});
test("rejects repeated reviewers, maker approvals and malformed source values", () => {
  for (const mutate of [f => { f.envelope.approvals[1].principal = f.envelope.approvals[0].principal; }, f => { f.envelope.payload.maker = f.envelope.approvals[0].principal; }, f => { f.envelope.payload.commitSha = "abc"; }, f => { delete f.envelope.payload.evidence.provider; }, f => { f.envelope.extra = "unexpected"; }]) {
    const f = fixture(); mutate(f); assert.throws(() => verifyReleaseAttestation(f.envelope, f.trust, f.context));
  }
});
