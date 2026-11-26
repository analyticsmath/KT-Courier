-- Additive schema extension for canonical Waybill & Proof of Delivery (POD)
-- document issuance and scoped, revocable status-only recipient tracking grants.

CREATE TYPE "ShipmentDocumentType" AS ENUM ('WAYBILL', 'POD');
CREATE TYPE "ShipmentDocumentStatus" AS ENUM ('ISSUED', 'SUPERSEDED', 'VOID');
CREATE TYPE "TrackingGrantScope" AS ENUM ('STATUS_ONLY');

CREATE TABLE "ShipmentDocument" (
  "id" TEXT NOT NULL,
  "documentRef" VARCHAR(80) NOT NULL,
  "orderId" TEXT NOT NULL,
  "type" "ShipmentDocumentType" NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "status" "ShipmentDocumentStatus" NOT NULL DEFAULT 'ISSUED',
  "issuerSnapshotId" TEXT NOT NULL,
  "proofOfDeliveryId" TEXT,
  "payloadSnapshot" JSONB NOT NULL,
  "payloadSha256" VARCHAR(64) NOT NULL,
  "rendererVersion" VARCHAR(40) NOT NULL DEFAULT 'kt-pdf-v1',
  "sourceEventRef" VARCHAR(160),
  "issuedByUserId" TEXT,
  "issuedByRole" VARCHAR(40),
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "supersedesId" TEXT,
  "revisionReason" VARCHAR(300),

  CONSTRAINT "ShipmentDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShipmentDocument_revision_positive_check" CHECK ("revision" >= 1),
  CONSTRAINT "ShipmentDocument_sha256_check" CHECK ("payloadSha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "ShipmentDocument_pod_requires_proof_check" CHECK ("type" <> 'POD' OR "proofOfDeliveryId" IS NOT NULL)
);

CREATE UNIQUE INDEX "ShipmentDocument_documentRef_key" ON "ShipmentDocument"("documentRef");
CREATE UNIQUE INDEX "ShipmentDocument_supersedesId_key" ON "ShipmentDocument"("supersedesId");
CREATE UNIQUE INDEX "ShipmentDocument_orderId_type_revision_key" ON "ShipmentDocument"("orderId", "type", "revision");
CREATE INDEX "ShipmentDocument_orderId_type_status_idx" ON "ShipmentDocument"("orderId", "type", "status");
CREATE INDEX "ShipmentDocument_proofOfDeliveryId_idx" ON "ShipmentDocument"("proofOfDeliveryId");
CREATE INDEX "ShipmentDocument_issuedAt_idx" ON "ShipmentDocument"("issuedAt");
CREATE UNIQUE INDEX "ShipmentDocument_one_active_issued_idx" ON "ShipmentDocument"("orderId", "type") WHERE "status" = 'ISSUED';

ALTER TABLE "ShipmentDocument"
  ADD CONSTRAINT "ShipmentDocument_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ShipmentDocument"
  ADD CONSTRAINT "ShipmentDocument_issuerSnapshotId_fkey"
  FOREIGN KEY ("issuerSnapshotId") REFERENCES "CompanyIssuerSnapshot"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ShipmentDocument"
  ADD CONSTRAINT "ShipmentDocument_proofOfDeliveryId_fkey"
  FOREIGN KEY ("proofOfDeliveryId") REFERENCES "ProofOfDelivery"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ShipmentDocument"
  ADD CONSTRAINT "ShipmentDocument_issuedByUserId_fkey"
  FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShipmentDocument"
  ADD CONSTRAINT "ShipmentDocument_supersedesId_fkey"
  FOREIGN KEY ("supersedesId") REFERENCES "ShipmentDocument"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ShipmentTrackingGrant" (
  "id" TEXT NOT NULL,
  "grantRef" VARCHAR(80) NOT NULL,
  "orderId" TEXT NOT NULL,
  "tokenSha256" VARCHAR(64) NOT NULL,
  "scope" "TrackingGrantScope" NOT NULL DEFAULT 'STATUS_ONLY',
  "issuedByUserId" TEXT,
  "issuedByRole" VARCHAR(40),
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "revokedByUserId" TEXT,
  "revokeReason" VARCHAR(300),

  CONSTRAINT "ShipmentTrackingGrant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShipmentTrackingGrant_sha256_check" CHECK ("tokenSha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "ShipmentTrackingGrant_expiry_after_issue_check" CHECK ("expiresAt" > "issuedAt")
);

CREATE UNIQUE INDEX "ShipmentTrackingGrant_grantRef_key" ON "ShipmentTrackingGrant"("grantRef");
CREATE UNIQUE INDEX "ShipmentTrackingGrant_tokenSha256_key" ON "ShipmentTrackingGrant"("tokenSha256");
CREATE INDEX "ShipmentTrackingGrant_orderId_revokedAt_expiresAt_idx" ON "ShipmentTrackingGrant"("orderId", "revokedAt", "expiresAt");

ALTER TABLE "ShipmentTrackingGrant"
  ADD CONSTRAINT "ShipmentTrackingGrant_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShipmentTrackingGrant"
  ADD CONSTRAINT "ShipmentTrackingGrant_issuedByUserId_fkey"
  FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShipmentTrackingGrant"
  ADD CONSTRAINT "ShipmentTrackingGrant_revokedByUserId_fkey"
  FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
