import { LegalDocumentPage } from "@/components/public-v2/legal";
import { legalDocumentMetadata } from "@/lib/public-legal/legal-document-registry";

export const metadata = legalDocumentMetadata("privacy-notice");

export default function PrivacyPolicyPage() {
  return <LegalDocumentPage documentId="privacy-notice" />;
}
