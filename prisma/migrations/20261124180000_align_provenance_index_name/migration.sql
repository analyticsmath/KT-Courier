-- Rename PostgreSQL-truncated 67-char index name from 20261124160000 to an explicit <=63-byte name.
ALTER INDEX IF EXISTS "PaymentReleaseProvenance_provider_providerEnvironment_releaseSh"
  RENAME TO "PaymentReleaseProvenance_provider_env_sha_idx";
