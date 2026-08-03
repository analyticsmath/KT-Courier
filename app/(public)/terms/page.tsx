import { LegalDocumentPage } from "@/components/public-v2/legal";
import { legalDocumentMetadata } from "@/lib/public-legal/legal-document-registry";

export const metadata = legalDocumentMetadata("website-terms");

export default function TermsPage() {
  return <LegalDocumentPage documentId="website-terms" />;
}
