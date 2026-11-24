import { verifyAuditReceipt } from "./audit-receipt.mjs";
import { collectVerifiedReleaseContext, verifyParityRemote } from "./collectors.mjs";
import {
  extractBearerToken,
  timingSafeTokenMatch,
  verifySignedEnvelope,
} from "./security.mjs";

const MAX_BODY_BYTES = 524_288;

async function readJsonBody(req) {
  let total = 0;
  const chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      throw Object.assign(new Error("Request body exceeded maximum allowed bytes."), { status: 413, code: "PAYLOAD_TOO_LARGE" });
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error("Malformed JSON payload."), { status: 400, code: "MALFORMED_JSON" });
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(`${JSON.stringify(payload)}\n`);
}

export function createReleaseAuthorityHandler({
  store,
  readToken,
  adminToken,
  env = process.env,
  fetchImpl = fetch,
  allowLoopbackForTest = false,
  resolveDns = undefined,
  now = () => new Date(),
}) {
  if (!store) throw new Error("Release authority handler requires a durable store.");
  if (typeof readToken !== "string" || readToken.trim().length < 16) {
    throw new Error("RELEASE_AUTHORITY_BEARER_TOKEN (>= 16 chars) is required.");
  }

  return async function handleRequest(req, res) {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");

    if (req.method === "GET" && url.pathname === "/healthz") {
      return sendJson(res, 200, { ok: true, service: "kt-courier-release-authority" });
    }

    if (!url.pathname.startsWith("/v1/release-authority/")) {
      return sendJson(res, 404, { code: "NOT_FOUND", error: "Route not found." });
    }

    const token = extractBearerToken(req.headers.authorization);
    const isAdminRoute = url.pathname.startsWith("/v1/release-authority/admin/");

    if (isAdminRoute) {
      if (typeof adminToken !== "string" || adminToken.trim().length < 16 || !timingSafeTokenMatch(token, adminToken)) {
        return sendJson(res, 403, { code: "ADMIN_UNAUTHORIZED", error: "Unauthorized administrative bearer credential." });
      }
    } else if (!timingSafeTokenMatch(token, readToken)) {
      return sendJson(res, 401, { code: "UNAUTHORIZED", error: "Invalid release authority bearer token." });
    }

    try {
      // Admin endpoints (ingest trust/contexts/envelopes, trigger collector, revoke keys/issuances)
      if (req.method === "PUT" && url.pathname === "/v1/release-authority/admin/trust") {
        const body = await readJsonBody(req);
        if (!body?.trust || typeof body.trust !== "object" || Array.isArray(body.trust)) {
          return sendJson(res, 400, { code: "INVALID_TRUST", error: "Expected trust map." });
        }
        await store.putTrustBundle(body.trust);
        return sendJson(res, 200, { updated: true, keyCount: Object.keys(body.trust).length });
      }

      if (req.method === "PUT" && url.pathname === "/v1/release-authority/admin/contexts") {
        const body = await readJsonBody(req);
        await store.putReleaseContext(body?.context ?? body);
        return sendJson(res, 200, { stored: true });
      }

      if (req.method === "POST" && url.pathname === "/v1/release-authority/admin/collect") {
        const body = await readJsonBody(req);
        const context = await collectVerifiedReleaseContext(body, { store, env, fetchImpl, allowLoopbackForTest, resolveDns, now });
        await store.putReleaseContext(context);
        return sendJson(res, 201, { stored: true, context });
      }

      if (req.method === "PUT" && url.pathname === "/v1/release-authority/admin/audits") {
        const body = await readJsonBody(req);
        const receipt = body?.receipt ?? body;
        const verifiedReceipt = verifyAuditReceipt(receipt, {
          nowMs: now().getTime(),
          enforceFreshness: true,
          requireParityEligibility: receipt?.window?.captureMode === "BEFORE_AND_AFTER_COMPARISON",
        });
        const stored = await store.putAuditReceipt({
          receipt: verifiedReceipt,
          ingestedBy: verifiedReceipt.provenance.auditorPrincipal,
        });
        return sendJson(res, 201, {
          stored: true,
          receiptReference: stored.receiptReference,
          receiptDigest: stored.receiptDigest,
          releaseSha: stored.releaseSha,
          eligibleForParity: verifiedReceipt.comparison.eligibleForParity,
        });
      }

      if (req.method === "PUT" && url.pathname === "/v1/release-authority/admin/envelopes") {
        const body = await readJsonBody(req);
        const envelope = body?.envelope ?? body;
        const trust = await store.getTrustBundle();
        const payload = verifySignedEnvelope(envelope, trust, {
          enforceTimeWindow: false,
          nowMs: now().getTime(),
        });
        const evidenceReference = body?.evidenceReference ?? payload.issuanceId;
        await store.putEvidenceEnvelope({
          releaseSha: payload.commitSha,
          evidenceReference,
          envelope,
          revoked: false,
        });
        return sendJson(res, 201, { stored: true, releaseSha: payload.commitSha, evidenceReference, issuanceId: payload.issuanceId });
      }

      if (req.method === "POST" && url.pathname === "/v1/release-authority/admin/revocations") {
        const body = await readJsonBody(req);
        await store.recordRevocation({ kind: body?.kind, targetId: body?.targetId, reason: body?.reason });
        return sendJson(res, 200, { revoked: true, kind: body?.kind, targetId: body?.targetId });
      }

      // Read endpoints consumed by scripts/verify-release-authorization.mjs & verification-adapters.server.ts
      if (req.method === "GET" && url.pathname === "/v1/release-authority/trust") {
        const trust = await store.getTrustBundle();
        return sendJson(res, 200, { trust });
      }

      const evidenceMatch = /^\/v1\/release-authority\/releases\/([^/]+)\/evidence\/([^/]+)$/.exec(url.pathname);
      if (req.method === "GET" && evidenceMatch) {
        const releaseSha = decodeURIComponent(evidenceMatch[1]);
        const evidenceReference = decodeURIComponent(evidenceMatch[2]);
        const record = await store.getEvidenceEnvelope({ releaseSha, evidenceReference });
        if (!record) {
          return sendJson(res, 404, { code: "EVIDENCE_NOT_FOUND", error: "Signed evidence envelope not found." });
        }
        const rev = await store.getRevocationStatus({
          releaseSha,
          evidenceReference,
          issuanceId: record.issuanceId,
        });
        if (record.revoked || rev.revokedEvidenceReferences.includes(evidenceReference) || rev.revokedIssuanceIds.includes(record.issuanceId)) {
          return sendJson(res, 410, { code: "EVIDENCE_REVOKED", error: "Evidence reference or issuance has been revoked." });
        }
        return sendJson(res, 200, {
          releaseSha: record.releaseSha,
          evidenceReference: record.evidenceReference,
          envelope: record.envelope,
        });
      }

      const contextMatch = /^\/v1\/release-authority\/releases\/([^/]+)\/context$/.exec(url.pathname);
      if (req.method === "GET" && contextMatch) {
        const releaseSha = decodeURIComponent(contextMatch[1]);
        const treeSha = url.searchParams.get("treeSha") ?? "";
        const evidenceReference = url.searchParams.get("evidenceReference") ?? "";
        if (!evidenceReference) {
          return sendJson(res, 400, { code: "EVIDENCE_REFERENCE_REQUIRED", error: "evidenceReference query parameter is required." });
        }
        const context = await store.getReleaseContext({ releaseSha, treeSha, evidenceReference });
        if (!context) {
          return sendJson(res, 404, { code: "CONTEXT_NOT_FOUND", error: "Verified release context not found." });
        }
        return sendJson(res, 200, { context });
      }

      const auditMatch = /^\/v1\/release-authority\/audits\/([^/]+)$/.exec(url.pathname);
      if (req.method === "GET" && auditMatch) {
        const ref = decodeURIComponent(auditMatch[1]);
        const stored = await store.getAuditReceipt(ref);
        if (!stored) {
          return sendJson(res, 404, { code: "AUDIT_RECEIPT_NOT_FOUND", error: "Protected-row audit receipt not found." });
        }
        const rev = await store.getRevocationStatus({ auditReference: ref });
        if (
          stored.revoked ||
          rev.revokedAuditReceiptIds?.includes(stored.receiptReference) ||
          rev.revokedAuditReceiptIds?.includes(stored.receiptDigest)
        ) {
          return sendJson(res, 410, { code: "AUDIT_RECEIPT_REVOKED", error: "Protected-row audit receipt has been revoked." });
        }
        return sendJson(res, 200, {
          receiptReference: stored.receiptReference,
          receiptDigest: stored.receiptDigest,
          ingestedBy: stored.ingestedBy,
          ingestedAt: stored.ingestedAt,
          receipt: stored.receipt,
        });
      }

      if (req.method === "GET" && url.pathname === "/v1/release-authority/revocations") {
        const releaseSha = url.searchParams.get("releaseSha") ?? undefined;
        const evidenceReference = url.searchParams.get("evidenceReference") ?? undefined;
        const issuanceId = url.searchParams.get("issuanceId") ?? undefined;
        const auditReference = url.searchParams.get("auditReference") ?? undefined;
        const status = await store.getRevocationStatus({ releaseSha, evidenceReference, issuanceId, auditReference });
        return sendJson(res, 200, status);
      }

      if (req.method === "POST" && url.pathname === "/v1/release-authority/issuances/claim") {
        const body = await readJsonBody(req);
        const receipt = await store.claimSingleUseIssuance(body);
        return sendJson(res, 201, receipt);
      }

      if (req.method === "POST" && url.pathname === "/v1/release-authority/parity/verify") {
        const body = await readJsonBody(req);
        const verified = await verifyParityRemote(body, { store, env, fetchImpl, allowLoopbackForTest, resolveDns, now });
        return sendJson(res, 200, verified);
      }

      return sendJson(res, 404, { code: "NOT_FOUND", error: "Release authority route not found." });
    } catch (error) {
      const status = typeof error?.status === "number" ? error.status : 500;
      const code = typeof error?.code === "string" ? error.code : "INTERNAL_ERROR";
      return sendJson(res, status, { code, error: error instanceof Error ? error.message : "Internal release authority error." });
    }
  };
}
