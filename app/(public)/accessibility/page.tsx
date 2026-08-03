import { LegalDocumentPage } from "@/components/public-v2/legal";
import { legalDocumentMetadata } from "@/lib/public-legal/legal-document-registry";

export const metadata = legalDocumentMetadata("accessibility-statement");

export default function AccessibilityStatementPage() {
  return <LegalDocumentPage documentId="accessibility-statement" />;
}
