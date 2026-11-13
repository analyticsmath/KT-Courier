-- Retain artifact metadata and download audit references after storage expiry.
ALTER TABLE "ReportExportArtifact" ADD COLUMN "storageDeletedAt" TIMESTAMP(3);
CREATE INDEX "ReportExportArtifact_storageDeletedAt_expiresAt_idx" ON "ReportExportArtifact"("storageDeletedAt", "expiresAt");
