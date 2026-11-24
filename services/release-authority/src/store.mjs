import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { mkdir, open, readdir, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,199}$/;
const SHA_HEX = /^[a-f0-9]{40}$/;

function assertSegment(value, label) {
  if (typeof value !== "string" || !SAFE_SEGMENT.test(value) || value.includes("..")) {
    throw Object.assign(new Error(`Invalid ${label}.`), { status: 400, code: "INVALID_IDENTIFIER" });
  }
}

function assertSha(value) {
  if (typeof value !== "string" || !SHA_HEX.test(value)) {
    throw Object.assign(new Error("Invalid commit or tree SHA."), { status: 400, code: "INVALID_IDENTIFIER" });
  }
}

function sha256Short(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function safeFileKey(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function isErrorWithCode(error, code) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === code);
}

async function readJsonOrNull(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (isErrorWithCode(error, "ENOENT")) return null;
    throw error;
  }
}

async function atomicWriteFile(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const handle = await open(tempPath, "w", 0o600);
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(tempPath, filePath);
}

export function createDurableFileStore(dataDir, options = {}) {
  const rootDir = path.resolve(dataDir);
  const nowFn = options.now ?? (() => new Date());

  const trustPath = path.join(rootDir, "trust.json");
  const contextsDir = path.join(rootDir, "contexts");
  const envelopesDir = path.join(rootDir, "envelopes");
  const auditsDir = path.join(rootDir, "audits");
  const revocationsPath = path.join(rootDir, "revocations.json");
  const claimsDir = path.join(rootDir, "claims");
  const locksDir = path.join(rootDir, "locks");

  async function init() {
    await mkdir(contextsDir, { recursive: true });
    await mkdir(envelopesDir, { recursive: true });
    await mkdir(auditsDir, { recursive: true });
    await mkdir(claimsDir, { recursive: true });
    await mkdir(locksDir, { recursive: true });
  }

  async function getTrustBundle() {
    const raw = await readJsonOrNull(trustPath);
    return raw ?? {};
  }

  async function putTrustBundle(trust) {
    await init();
    await atomicWriteFile(trustPath, `${JSON.stringify(trust, null, 2)}\n`);
    return trust;
  }

  async function getReleaseContext({ releaseSha, treeSha, evidenceReference }) {
    assertSha(releaseSha);
    assertSha(treeSha);
    assertSegment(evidenceReference, "evidenceReference");
    const key = safeFileKey(`${releaseSha}:${treeSha}:${evidenceReference}`);
    return readJsonOrNull(path.join(contextsDir, `${key}.json`));
  }

  async function putReleaseContext(context) {
    assertSha(context?.commitSha);
    assertSha(context?.treeSha);
    assertSegment(context?.evidenceReference, "evidenceReference");
    await init();
    const key = safeFileKey(`${context.commitSha}:${context.treeSha}:${context.evidenceReference}`);
    await atomicWriteFile(path.join(contextsDir, `${key}.json`), `${JSON.stringify(context, null, 2)}\n`);
    return context;
  }

  async function getEvidenceEnvelope({ releaseSha, evidenceReference }) {
    assertSha(releaseSha);
    assertSegment(evidenceReference, "evidenceReference");
    const key = safeFileKey(`${releaseSha}:${evidenceReference}`);
    return readJsonOrNull(path.join(envelopesDir, `${key}.json`));
  }

  async function putEvidenceEnvelope({ releaseSha, evidenceReference, envelope, revoked = false }) {
    assertSha(releaseSha);
    assertSegment(evidenceReference, "evidenceReference");
    await init();
    const key = safeFileKey(`${releaseSha}:${evidenceReference}`);
    const stored = {
      releaseSha,
      evidenceReference,
      issuanceId: envelope.payload.issuanceId,
      envelope,
      revoked: Boolean(revoked),
      storedAt: nowFn().toISOString(),
    };
    await atomicWriteFile(path.join(envelopesDir, `${key}.json`), `${JSON.stringify(stored, null, 2)}\n`);
    return stored;
  }

  async function getAuditReceipt(ref) {
    assertSegment(ref, "auditReference");
    const direct = await readJsonOrNull(path.join(auditsDir, `${safeFileKey(`ref:${ref}`)}.json`));
    if (direct) return direct;
    const byDigest = await readJsonOrNull(path.join(auditsDir, `${safeFileKey(`digest:${ref}`)}.json`));
    return byDigest;
  }

  async function putAuditReceipt({ receipt, ingestedBy }) {
    assertSegment(receipt?.receiptReference, "receiptReference");
    assertSha(receipt?.releaseSha);
    await init();

    const refPath = path.join(auditsDir, `${safeFileKey(`ref:${receipt.receiptReference}`)}.json`);
    const digestPath = path.join(auditsDir, `${safeFileKey(`digest:${receipt.receiptDigest}`)}.json`);
    const existingByRef = await readJsonOrNull(refPath);
    if (existingByRef && existingByRef.receipt?.receiptDigest !== receipt.receiptDigest) {
      throw Object.assign(new Error("Audit receipt reference already exists with a different digest."), {
        status: 409,
        code: "AUDIT_RECEIPT_CONFLICT",
      });
    }
    const existingByDigest = await readJsonOrNull(digestPath);
    if (existingByDigest && existingByDigest.receipt?.receiptReference !== receipt.receiptReference) {
      throw Object.assign(new Error("Audit receipt digest already registered under a different reference."), {
        status: 409,
        code: "AUDIT_RECEIPT_CONFLICT",
      });
    }
    if (existingByRef) return existingByRef;

    const stored = {
      receiptReference: receipt.receiptReference,
      receiptDigest: receipt.receiptDigest,
      releaseSha: receipt.releaseSha,
      databaseName: receipt.databaseIdentity.database,
      classification: receipt.databaseIdentity.classification,
      revoked: false,
      ingestedBy: String(ingestedBy ?? "admin-ingest"),
      ingestedAt: nowFn().toISOString(),
      receipt,
    };
    await atomicWriteFile(refPath, `${JSON.stringify(stored, null, 2)}\n`);
    await atomicWriteFile(digestPath, `${JSON.stringify(stored, null, 2)}\n`);
    return stored;
  }

  async function readRevocationsState() {
    const raw = await readJsonOrNull(revocationsPath);
    return (
      raw ?? {
        revokedKeyIds: [],
        revokedIssuanceIds: [],
        revokedEvidenceReferences: [],
        revokedAuditReceiptIds: [],
        entries: [],
      }
    );
  }

  async function getRevocationStatus({ releaseSha, evidenceReference, issuanceId, auditReference } = {}) {
    const state = await readRevocationsState();
    const trust = await getTrustBundle();
    const trustRevokedKeys = Object.entries(trust)
      .filter(([, entry]) => entry?.revoked === true)
      .map(([keyId]) => keyId);

    let envelopeRevoked = false;
    if (releaseSha && evidenceReference) {
      const envRecord = await getEvidenceEnvelope({ releaseSha, evidenceReference });
      if (envRecord?.revoked === true) envelopeRevoked = true;
    }

    const revokedEvidenceReferences = [...new Set(state.revokedEvidenceReferences ?? [])];
    if (envelopeRevoked && evidenceReference && !revokedEvidenceReferences.includes(evidenceReference)) {
      revokedEvidenceReferences.push(evidenceReference);
    }

    const revokedIssuanceIds = [...new Set(state.revokedIssuanceIds ?? [])];
    if (envelopeRevoked && issuanceId && !revokedIssuanceIds.includes(issuanceId)) {
      revokedIssuanceIds.push(issuanceId);
    }

    const revokedAuditReceiptIds = [...new Set(state.revokedAuditReceiptIds ?? [])];
    if (auditReference) {
      const auditRec = await getAuditReceipt(auditReference);
      if (auditRec?.revoked && !revokedAuditReceiptIds.includes(auditReference)) {
        revokedAuditReceiptIds.push(auditReference);
      }
    }

    return {
      revokedKeyIds: [...new Set([...(state.revokedKeyIds ?? []), ...trustRevokedKeys])],
      revokedIssuanceIds,
      revokedEvidenceReferences,
      revokedAuditReceiptIds,
    };
  }

  async function recordRevocation({ kind, targetId, reason }) {
    assertSegment(targetId, "targetId");
    if (!["key", "issuance", "evidence_reference", "audit_receipt"].includes(kind)) {
      throw Object.assign(new Error("Unsupported revocation kind."), { status: 400, code: "INVALID_REVOCATION" });
    }
    await init();
    const state = await readRevocationsState();
    state.revokedAuditReceiptIds = state.revokedAuditReceiptIds ?? [];
    if (kind === "key" && !state.revokedKeyIds.includes(targetId)) {
      state.revokedKeyIds.push(targetId);
    } else if (kind === "issuance" && !state.revokedIssuanceIds.includes(targetId)) {
      state.revokedIssuanceIds.push(targetId);
    } else if (kind === "evidence_reference" && !state.revokedEvidenceReferences.includes(targetId)) {
      state.revokedEvidenceReferences.push(targetId);
    } else if (kind === "audit_receipt") {
      if (!state.revokedAuditReceiptIds.includes(targetId)) {
        state.revokedAuditReceiptIds.push(targetId);
      }
      const existingAudit = await getAuditReceipt(targetId);
      if (existingAudit) {
        const updatedAudit = { ...existingAudit, revoked: true };
        await atomicWriteFile(
          path.join(auditsDir, `${safeFileKey(`ref:${existingAudit.receiptReference}`)}.json`),
          `${JSON.stringify(updatedAudit, null, 2)}\n`,
        );
        await atomicWriteFile(
          path.join(auditsDir, `${safeFileKey(`digest:${existingAudit.receiptDigest}`)}.json`),
          `${JSON.stringify(updatedAudit, null, 2)}\n`,
        );
        if (!state.revokedAuditReceiptIds.includes(existingAudit.receiptReference)) {
          state.revokedAuditReceiptIds.push(existingAudit.receiptReference);
        }
        if (!state.revokedAuditReceiptIds.includes(existingAudit.receiptDigest)) {
          state.revokedAuditReceiptIds.push(existingAudit.receiptDigest);
        }
      }
    }
    state.entries.push({ kind, targetId, reason: String(reason ?? ""), revokedAt: nowFn().toISOString() });
    await atomicWriteFile(revocationsPath, `${JSON.stringify(state, null, 2)}\n`);
    return state;
  }

  async function claimSingleUseIssuance(claimPayload) {
    assertSegment(claimPayload?.issuanceId, "issuanceId");
    assertSha(claimPayload?.commitSha);
    await init();

    const issuanceKey = safeFileKey(claimPayload.issuanceId);
    const lockPath = path.join(locksDir, `${issuanceKey}.lock`);
    const claimPath = path.join(claimsDir, `${issuanceKey}.json`);

    let lockHandle;
    try {
      lockHandle = await open(lockPath, "wx", 0o600);
    } catch (error) {
      if (isErrorWithCode(error, "EEXIST")) {
        throw Object.assign(new Error("Concurrent issuance claim already in flight."), {
          status: 409,
          code: "ISSUANCE_CONCURRENT",
        });
      }
      throw error;
    }

    try {
      const existing = await readJsonOrNull(claimPath);
      if (existing) {
        throw Object.assign(new Error("Issuance ID already consumed."), {
          status: 409,
          code: "ISSUANCE_ALREADY_CLAIMED",
        });
      }

      const rev = await getRevocationStatus({ issuanceId: claimPayload.issuanceId });
      if (rev.revokedIssuanceIds.includes(claimPayload.issuanceId)) {
        throw Object.assign(new Error("Issuance ID has been revoked."), {
          status: 410,
          code: "ISSUANCE_REVOKED",
        });
      }

      const envelopeFiles = await readdir(envelopesDir).catch(() => []);
      for (const file of envelopeFiles) {
        const record = await readJsonOrNull(path.join(envelopesDir, file));
        if (record?.issuanceId === claimPayload.issuanceId) {
          if (record.revoked || rev.revokedEvidenceReferences.includes(record.evidenceReference)) {
            throw Object.assign(new Error("Envelope or evidence reference has been revoked."), {
              status: 410,
              code: "ISSUANCE_REVOKED",
            });
          }
          break;
        }
      }

      if (typeof options.claimHoldMs === "number" && options.claimHoldMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, options.claimHoldMs));
      }

      const claimedAt = claimPayload.claimedAt ?? nowFn().toISOString();
      const receiptId = `rcpt_${sha256Short(`${claimPayload.issuanceId}:${claimedAt}:${claimPayload.commitSha}`)}`;
      const receipt = {
        claimed: true,
        issuanceId: claimPayload.issuanceId,
        receiptId,
        claimedAt,
        payload: claimPayload,
      };

      const handle = await open(claimPath, "wx", 0o600);
      try {
        await handle.writeFile(`${JSON.stringify(receipt, null, 2)}\n`, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }

      return {
        claimed: true,
        issuanceId: receipt.issuanceId,
        receiptId: receipt.receiptId,
        claimedAt: receipt.claimedAt,
      };
    } finally {
      await lockHandle.close().catch(() => {});
      await unlink(lockPath).catch(() => {});
    }
  }

  return {
    init,
    getTrustBundle,
    putTrustBundle,
    getReleaseContext,
    putReleaseContext,
    getEvidenceEnvelope,
    putEvidenceEnvelope,
    getAuditReceipt,
    putAuditReceipt,
    getRevocationStatus,
    recordRevocation,
    claimSingleUseIssuance,
  };
}

export function createPostgresStore({ pool, schemaSql, now } = {}) {
  if (!pool || typeof pool.query !== "function") {
    throw new Error("createPostgresStore requires a queryable pg/PGlite pool.");
  }
  const nowFn = now ?? (() => new Date());

  async function init() {
    const ddlPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "schema.sql");
    const sql = schemaSql ?? readFileSync(ddlPath, "utf8");
    const stripped = sql
      .split(/\r?\n/)
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");
    const statements = stripped
      .split(/;\s*(?:\r?\n|$)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      await pool.query(stmt);
    }
  }

  async function withClient(fn) {
    if (typeof pool.connect === "function") {
      const client = await pool.connect();
      try {
        return await fn(client);
      } finally {
        client.release();
      }
    }
    return fn(pool);
  }

  async function getTrustBundle() {
    const res = await pool.query("SELECT key_id, principal, roles, public_key_pem, revoked FROM ra_trust_keys");
    const trust = {};
    for (const row of res.rows) {
      trust[row.key_id] = {
        roles: typeof row.roles === "string" ? JSON.parse(row.roles) : row.roles,
        principal: row.principal,
        publicKey: row.public_key_pem,
        revoked: Boolean(row.revoked),
      };
    }
    return trust;
  }

  async function putTrustBundle(trust) {
    await withClient(async (client) => {
      await client.query("BEGIN");
      try {
        for (const [keyId, entry] of Object.entries(trust)) {
          await client.query(
            `INSERT INTO ra_trust_keys (key_id, principal, roles, public_key_pem, revoked, revoked_at, updated_at)
             VALUES ($1, $2, $3::jsonb, $4, $5::boolean, CASE WHEN $5::boolean THEN NOW() ELSE NULL END, NOW())
             ON CONFLICT (key_id) DO UPDATE SET
               principal = EXCLUDED.principal,
               roles = EXCLUDED.roles,
               public_key_pem = EXCLUDED.public_key_pem,
               revoked = EXCLUDED.revoked,
               revoked_at = EXCLUDED.revoked_at,
               updated_at = NOW()`,
            [keyId, entry.principal, JSON.stringify(entry.roles), entry.publicKey, entry.revoked === true],
          );
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      }
    });
    return trust;
  }

  async function getReleaseContext({ releaseSha, treeSha, evidenceReference }) {
    assertSha(releaseSha);
    assertSha(treeSha);
    assertSegment(evidenceReference, "evidenceReference");
    const res = await pool.query(
      `SELECT context_json FROM ra_release_contexts WHERE release_sha = $1 AND tree_sha = $2 AND evidence_reference = $3`,
      [releaseSha, treeSha, evidenceReference],
    );
    const row = res.rows[0];
    if (!row) return null;
    return typeof row.context_json === "string" ? JSON.parse(row.context_json) : row.context_json;
  }

  async function putReleaseContext(context) {
    assertSha(context?.commitSha);
    assertSha(context?.treeSha);
    assertSegment(context?.evidenceReference, "evidenceReference");
    await pool.query(
      `INSERT INTO ra_release_contexts (release_sha, tree_sha, evidence_reference, context_json, collected_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())
       ON CONFLICT (release_sha, tree_sha, evidence_reference) DO UPDATE SET
         context_json = EXCLUDED.context_json,
         collected_at = NOW()`,
      [context.commitSha, context.treeSha, context.evidenceReference, JSON.stringify(context)],
    );
    return context;
  }

  async function getEvidenceEnvelope({ releaseSha, evidenceReference }) {
    assertSha(releaseSha);
    assertSegment(evidenceReference, "evidenceReference");
    const res = await pool.query(
      `SELECT release_sha, evidence_reference, issuance_id, payload_json, approvals_json, revoked
       FROM ra_evidence_envelopes WHERE release_sha = $1 AND evidence_reference = $2`,
      [releaseSha, evidenceReference],
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      releaseSha: row.release_sha,
      evidenceReference: row.evidence_reference,
      issuanceId: row.issuance_id,
      revoked: Boolean(row.revoked),
      envelope: {
        payload: typeof row.payload_json === "string" ? JSON.parse(row.payload_json) : row.payload_json,
        approvals: typeof row.approvals_json === "string" ? JSON.parse(row.approvals_json) : row.approvals_json,
      },
    };
  }

  async function putEvidenceEnvelope({ releaseSha, evidenceReference, envelope, revoked = false }) {
    assertSha(releaseSha);
    assertSegment(evidenceReference, "evidenceReference");
    await pool.query(
      `INSERT INTO ra_evidence_envelopes (release_sha, evidence_reference, issuance_id, payload_json, approvals_json, revoked)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)
       ON CONFLICT (release_sha, evidence_reference) DO UPDATE SET
         issuance_id = EXCLUDED.issuance_id,
         payload_json = EXCLUDED.payload_json,
         approvals_json = EXCLUDED.approvals_json,
         revoked = EXCLUDED.revoked`,
      [
        releaseSha,
        evidenceReference,
        envelope.payload.issuanceId,
        JSON.stringify(envelope.payload),
        JSON.stringify(envelope.approvals),
        Boolean(revoked),
      ],
    );
    return { releaseSha, evidenceReference, issuanceId: envelope.payload.issuanceId, envelope, revoked: Boolean(revoked) };
  }

  async function getAuditReceipt(ref) {
    assertSegment(ref, "auditReference");
    const [res, revRes] = await Promise.all([
      pool.query(
        `SELECT receipt_reference, receipt_digest, release_sha, database_name, classification, revoked, receipt_json, ingested_by, ingested_at
         FROM ra_audit_receipts WHERE receipt_reference = $1 OR receipt_digest = $1 LIMIT 1`,
        [ref],
      ),
      pool.query(
        `SELECT 1 FROM ra_revocations WHERE kind = 'audit_receipt' AND target_id = $1 LIMIT 1`,
        [ref],
      ),
    ]);
    const row = res.rows[0];
    if (!row) return null;
    const receipt = typeof row.receipt_json === "string" ? JSON.parse(row.receipt_json) : row.receipt_json;
    const extraRev = await pool.query(
      `SELECT 1 FROM ra_revocations WHERE kind = 'audit_receipt' AND target_id IN ($1, $2) LIMIT 1`,
      [row.receipt_reference, row.receipt_digest],
    );
    return {
      receiptReference: row.receipt_reference,
      receiptDigest: row.receipt_digest,
      releaseSha: row.release_sha,
      databaseName: row.database_name,
      classification: row.classification,
      revoked: Boolean(row.revoked) || revRes.rows.length > 0 || extraRev.rows.length > 0,
      ingestedBy: row.ingested_by,
      ingestedAt: new Date(row.ingested_at).toISOString(),
      receipt,
    };
  }

  async function putAuditReceipt({ receipt, ingestedBy }) {
    assertSegment(receipt?.receiptReference, "receiptReference");
    assertSha(receipt?.releaseSha);
    return withClient(async (client) => {
      await client.query("BEGIN");
      try {
        const existing = await client.query(
          `SELECT receipt_reference, receipt_digest, release_sha, database_name, classification, revoked, receipt_json, ingested_by, ingested_at
           FROM ra_audit_receipts WHERE receipt_reference = $1 OR receipt_digest = $2 LIMIT 1`,
          [receipt.receiptReference, receipt.receiptDigest],
        );
        const prior = existing.rows[0];
        if (prior) {
          if (
            prior.receipt_reference !== receipt.receiptReference ||
            prior.receipt_digest !== receipt.receiptDigest
          ) {
            throw Object.assign(new Error("Audit receipt reference or digest conflicts with an existing receipt."), {
              status: 409,
              code: "AUDIT_RECEIPT_CONFLICT",
            });
          }
          await client.query("COMMIT");
          return {
            receiptReference: prior.receipt_reference,
            receiptDigest: prior.receipt_digest,
            releaseSha: prior.release_sha,
            databaseName: prior.database_name,
            classification: prior.classification,
            revoked: Boolean(prior.revoked),
            ingestedBy: prior.ingested_by,
            ingestedAt: new Date(prior.ingested_at).toISOString(),
            receipt: typeof prior.receipt_json === "string" ? JSON.parse(prior.receipt_json) : prior.receipt_json,
          };
        }

        const inserted = await client.query(
          `INSERT INTO ra_audit_receipts (
             receipt_reference, receipt_digest, release_sha, database_name, classification, revoked, receipt_json, ingested_by, ingested_at
           )
           VALUES ($1, $2, $3, $4, $5, FALSE, $6::jsonb, $7, $8::timestamptz)
           RETURNING receipt_reference, receipt_digest, release_sha, database_name, classification, revoked, receipt_json, ingested_by, ingested_at`,
          [
            receipt.receiptReference,
            receipt.receiptDigest,
            receipt.releaseSha,
            receipt.databaseIdentity.database,
            receipt.databaseIdentity.classification,
            JSON.stringify(receipt),
            String(ingestedBy ?? "admin-ingest"),
            nowFn().toISOString(),
          ],
        );
        await client.query("COMMIT");
        const row = inserted.rows[0];
        return {
          receiptReference: row.receipt_reference,
          receiptDigest: row.receipt_digest,
          releaseSha: row.release_sha,
          databaseName: row.database_name,
          classification: row.classification,
          revoked: Boolean(row.revoked),
          ingestedBy: row.ingested_by,
          ingestedAt: new Date(row.ingested_at).toISOString(),
          receipt,
        };
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      }
    });
  }

  async function getRevocationStatus({ releaseSha, evidenceReference, issuanceId } = {}) {
    const [revRes, trustRevRes, auditRevRes, envRes] = await Promise.all([
      pool.query("SELECT kind, target_id FROM ra_revocations"),
      pool.query("SELECT key_id FROM ra_trust_keys WHERE revoked = TRUE"),
      pool.query("SELECT receipt_reference, receipt_digest FROM ra_audit_receipts WHERE revoked = TRUE"),
      releaseSha && evidenceReference
        ? pool.query("SELECT revoked, issuance_id FROM ra_evidence_envelopes WHERE release_sha = $1 AND evidence_reference = $2", [
            releaseSha,
            evidenceReference,
          ])
        : Promise.resolve({ rows: [] }),
    ]);

    const revokedKeyIds = new Set(trustRevRes.rows.map((r) => r.key_id));
    const revokedIssuanceIds = new Set();
    const revokedEvidenceReferences = new Set();
    const revokedAuditReceiptIds = new Set();
    for (const row of auditRevRes.rows) {
      revokedAuditReceiptIds.add(row.receipt_reference);
      revokedAuditReceiptIds.add(row.receipt_digest);
    }
    for (const row of revRes.rows) {
      if (row.kind === "key") revokedKeyIds.add(row.target_id);
      if (row.kind === "issuance") revokedIssuanceIds.add(row.target_id);
      if (row.kind === "evidence_reference") revokedEvidenceReferences.add(row.target_id);
      if (row.kind === "audit_receipt") revokedAuditReceiptIds.add(row.target_id);
    }
    const envRow = envRes.rows[0];
    if (envRow?.revoked) {
      revokedEvidenceReferences.add(evidenceReference);
      if (issuanceId) revokedIssuanceIds.add(issuanceId);
      if (envRow.issuance_id) revokedIssuanceIds.add(envRow.issuance_id);
    }

    return {
      revokedKeyIds: [...revokedKeyIds],
      revokedIssuanceIds: [...revokedIssuanceIds],
      revokedEvidenceReferences: [...revokedEvidenceReferences],
      revokedAuditReceiptIds: [...revokedAuditReceiptIds],
    };
  }

  async function recordRevocation({ kind, targetId, reason }) {
    assertSegment(targetId, "targetId");
    if (!["key", "issuance", "evidence_reference", "audit_receipt"].includes(kind)) {
      throw Object.assign(new Error("Unsupported revocation kind."), { status: 400, code: "INVALID_REVOCATION" });
    }
    await pool.query(
      `INSERT INTO ra_revocations (kind, target_id, reason, revoked_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (kind, target_id) DO UPDATE SET reason = EXCLUDED.reason, revoked_at = NOW()`,
      [kind, targetId, String(reason ?? "")],
    );
    if (kind === "key") {
      await pool.query(`UPDATE ra_trust_keys SET revoked = TRUE, revoked_at = NOW() WHERE key_id = $1`, [targetId]);
    } else if (kind === "issuance") {
      await pool.query(`UPDATE ra_evidence_envelopes SET revoked = TRUE WHERE issuance_id = $1`, [targetId]);
    } else if (kind === "evidence_reference") {
      await pool.query(`UPDATE ra_evidence_envelopes SET revoked = TRUE WHERE evidence_reference = $1`, [targetId]);
    } else if (kind === "audit_receipt") {
      await pool.query(`UPDATE ra_audit_receipts SET revoked = TRUE WHERE receipt_reference = $1 OR receipt_digest = $1`, [targetId]);
    }
  }

  async function claimSingleUseIssuance(claimPayload) {
    assertSegment(claimPayload?.issuanceId, "issuanceId");
    assertSha(claimPayload?.commitSha);
    const claimedAt = claimPayload.claimedAt ?? nowFn().toISOString();
    const receiptId = `rcpt_${sha256Short(`${claimPayload.issuanceId}:${claimedAt}:${claimPayload.commitSha}`)}`;

    return withClient(async (client) => {
      await client.query("BEGIN");
      try {
        const revCheck = await client.query(
          `SELECT 1 FROM ra_revocations WHERE kind = 'issuance' AND target_id = $1
           UNION ALL
           SELECT 1 FROM ra_evidence_envelopes WHERE issuance_id = $1 AND revoked = TRUE
           LIMIT 1`,
          [claimPayload.issuanceId],
        );
        if (revCheck.rows.length > 0) {
          throw Object.assign(new Error("Issuance has been revoked."), { status: 410, code: "ISSUANCE_REVOKED" });
        }

        const inserted = await client.query(
          `INSERT INTO ra_issuance_claims (
             issuance_id, receipt_id, repository, environment, audience,
             commit_sha, tree_sha, evidence_reference_digest,
             ci_run_id, certification_run_id, ci_evidence_digest,
             deployments_json, scope_digest, policy_digest, claimed_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15::timestamptz)
           ON CONFLICT (issuance_id) DO NOTHING
           RETURNING issuance_id, receipt_id, claimed_at`,
          [
            claimPayload.issuanceId,
            receiptId,
            claimPayload.repository,
            claimPayload.environment,
            claimPayload.audience,
            claimPayload.commitSha,
            claimPayload.treeSha,
            claimPayload.evidenceReferenceDigest,
            claimPayload.ciRunId,
            claimPayload.certificationRunId,
            claimPayload.ciEvidenceDigest,
            JSON.stringify(claimPayload.deployments),
            claimPayload.scopeDigest,
            claimPayload.policyDigest,
            claimedAt,
          ],
        );

        if (inserted.rows.length === 0) {
          throw Object.assign(new Error("Issuance ID already consumed."), {
            status: 409,
            code: "ISSUANCE_ALREADY_CLAIMED",
          });
        }

        await client.query("COMMIT");
        const row = inserted.rows[0];
        return {
          claimed: true,
          issuanceId: row.issuance_id,
          receiptId: row.receipt_id,
          claimedAt: new Date(row.claimed_at).toISOString(),
        };
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      }
    });
  }

  return {
    init,
    getTrustBundle,
    putTrustBundle,
    getReleaseContext,
    putReleaseContext,
    getEvidenceEnvelope,
    putEvidenceEnvelope,
    getAuditReceipt,
    putAuditReceipt,
    getRevocationStatus,
    recordRevocation,
    claimSingleUseIssuance,
  };
}

export function ensureSyncDataDir(dataDir) {
  mkdirSync(path.resolve(dataDir), { recursive: true });
}
