-- KT Couriers Independent Release Authority Durable Schema
-- Compatible with PostgreSQL 15+ (and PGlite for disposable automated tests).

CREATE TABLE IF NOT EXISTS ra_trust_keys (
  key_id TEXT PRIMARY KEY,
  principal TEXT NOT NULL,
  roles JSONB NOT NULL,
  public_key_pem TEXT NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ra_release_contexts (
  release_sha TEXT NOT NULL,
  tree_sha TEXT NOT NULL,
  evidence_reference TEXT NOT NULL,
  context_json JSONB NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (release_sha, tree_sha, evidence_reference)
);

CREATE TABLE IF NOT EXISTS ra_evidence_envelopes (
  release_sha TEXT NOT NULL,
  evidence_reference TEXT NOT NULL,
  issuance_id TEXT NOT NULL UNIQUE,
  payload_json JSONB NOT NULL,
  approvals_json JSONB NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (release_sha, evidence_reference)
);

CREATE TABLE IF NOT EXISTS ra_revocations (
  kind TEXT NOT NULL CHECK (kind IN ('key', 'issuance', 'evidence_reference', 'audit_receipt')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (kind, target_id)
);

CREATE TABLE IF NOT EXISTS ra_audit_receipts (
  receipt_reference TEXT PRIMARY KEY,
  receipt_digest TEXT NOT NULL UNIQUE,
  release_sha TEXT NOT NULL,
  database_name TEXT NOT NULL,
  classification TEXT NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  receipt_json JSONB NOT NULL,
  ingested_by TEXT NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ra_audit_release_sha ON ra_audit_receipts (release_sha);

CREATE TABLE IF NOT EXISTS ra_issuance_claims (
  issuance_id TEXT PRIMARY KEY,
  receipt_id TEXT NOT NULL UNIQUE,
  repository TEXT NOT NULL,
  environment TEXT NOT NULL,
  audience TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  tree_sha TEXT NOT NULL,
  evidence_reference_digest TEXT NOT NULL,
  ci_run_id BIGINT NOT NULL,
  certification_run_id BIGINT NOT NULL,
  ci_evidence_digest TEXT NOT NULL,
  deployments_json JSONB NOT NULL,
  scope_digest TEXT NOT NULL,
  policy_digest TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ra_claims_commit_sha ON ra_issuance_claims (commit_sha);
