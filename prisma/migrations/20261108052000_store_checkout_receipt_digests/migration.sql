-- Preserve the independent reviewer proof fingerprints as durable evidence.
-- Existing legacy certificates remain unapproved until genuine digests are supplied.
ALTER TABLE "StoreCheckoutCertification"
  ADD COLUMN "routeEvidenceDigest" TEXT,
  ADD COLUMN "checkoutEvidenceDigest" TEXT;
