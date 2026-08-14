import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("Privacy Notice and Terms version evidence authority", () => {
  it("extends the shared legal version/evidence models with public content and typed evidence", () => {
    const schema = read("prisma/schema.prisma");
    const migration = read("prisma/migrations/20260811177000_phase_b_legal_policy_version_evidence/migration.sql");
    expect(schema).toMatch(/model LegalDocumentVersion[\s\S]*content\s+String\?[\s\S]*contentReference\s+String\?/);
    expect(schema).toMatch(/model LegalDocumentAcceptance[\s\S]*evidenceType/);
    expect(migration).toMatch(/contentReference/);
    expect(migration).toMatch(/evidenceType/);
  });

  it("resolves effective immutable policies and keeps Privacy acknowledgement separate from Terms acceptance", () => {
    const service = read("lib/services/legal-documents.service.ts");
    expect(service).toMatch(/LEGAL_DOCUMENT_TYPES = \{ PRIVACY_NOTICE/);
    expect(service).toMatch(/resolveEffectiveLegalDocument/);
    expect(service).toMatch(/publicationStatus: "SUPERSEDED"/);
    expect(service).toMatch(/acknowledgePrivacyNotice/);
    expect(service).toMatch(/acceptTerms/);
    expect(service).toMatch(/PRIVACY_NOTICE_ACKNOWLEDGEMENT/);
    expect(service).toMatch(/TERMS_ACCEPTANCE/);
    expect(service).toMatch(/getTermsStatusForUser/);
  });

  it("exposes safe public policy and self-service evidence contracts while retaining guarded administration", () => {
    const privacy = read("app/api/legal/privacy-notice/route.ts");
    const terms = read("app/api/legal/terms/route.ts");
    const admin = read("app/api/admin/legal-documents/route.ts");
    const retire = read("app/api/admin/legal-documents/[reference]/retire/route.ts");
    expect(privacy).toMatch(/getCurrentPrivacyNotice/);
    expect(privacy).toMatch(/getCurrentUser/);
    expect(terms).toMatch(/getTermsStatusForUser/);
    expect(terms).toMatch(/acceptTerms/);
    expect(admin).toMatch(/LEGAL_DOCUMENTS_MANAGE/);
    expect(retire).toMatch(/LEGAL_DOCUMENTS_PUBLISH/);
  });
});
