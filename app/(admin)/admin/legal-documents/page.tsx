import { LegalDocumentsManager, type LegalDocumentVersionItem } from "@/components/admin/LegalDocumentsManager";
import { ProtectedPageFrame, ProtectedPageHeader } from "@/components/protected-v2";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listLegalDocumentVersions } from "@/lib/services/legal-documents.service";

export default async function LegalDocumentsPage() {
  await requireAdminPagePermission(PERMISSIONS.LEGAL_DOCUMENTS_READ);
  const documents = await listLegalDocumentVersions().catch(() => []);
  const initialDocuments: LegalDocumentVersionItem[] = documents.flatMap((document) => {
    const id = stringValue(document.id);
    const publicReference = stringValue(document.publicReference);
    const documentType = stringValue(document.documentType);
    const version = stringValue(document.version);
    const jurisdiction = stringValue(document.jurisdiction);
    const contentHash = stringValue(document.contentHash);
    if (!id || !publicReference || !documentType || !version || !jurisdiction || !contentHash) return [];
    return [{
      id,
      publicReference,
      documentType,
      version,
      jurisdiction,
      contentHash,
      publicationStatus: stringValue(document.publicationStatus) ?? "DRAFT",
      effectiveAt: optionalDateValue(document.effectiveAt),
      publishedAt: optionalDateValue(document.publishedAt),
      createdAt: dateValue(document.createdAt),
    }];
  });

  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Governance"
        title="Legal Document & Terms Governance"
        description="Author, hash, and publish immutable legal document versions across jurisdictions."
      />

      <LegalDocumentsManager initialDocuments={initialDocuments} />
    </ProtectedPageFrame>
  );
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function dateValue(value: unknown): string {
  return value instanceof Date ? value.toISOString() : typeof value === "string" ? value : new Date(0).toISOString();
}

function optionalDateValue(value: unknown): string | null {
  return value instanceof Date ? value.toISOString() : typeof value === "string" ? value : null;
}
