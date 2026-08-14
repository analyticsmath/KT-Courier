ALTER TABLE "LegalDocumentVersion" ADD COLUMN "content" TEXT;
ALTER TABLE "LegalDocumentVersion" ADD COLUMN "contentReference" TEXT;
ALTER TABLE "LegalDocumentAcceptance" ADD COLUMN "evidenceType" TEXT NOT NULL DEFAULT 'TERMS_ACCEPTANCE';
CREATE INDEX "LegalDocumentVersion_documentType_publicationStatus_effectiveAt_idx" ON "LegalDocumentVersion"("documentType", "publicationStatus", "effectiveAt");
CREATE INDEX "LegalDocumentAcceptance_documentVersionId_evidenceType_idx" ON "LegalDocumentAcceptance"("documentVersionId", "evidenceType");
